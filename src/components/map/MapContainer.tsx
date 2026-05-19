'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from 'lucide-react';
import { getCategoryColor, getCategoryIcon } from '@/lib/categories';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const defaultCenter: [number, number] = [37.5665, 126.9780];

interface MapProps {
  places: any[];
  onBoundsChange?: (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => void;
}

function createMarkerIcon(category: string): L.DivIcon {
  const color = getCategoryColor(category) || '#10B981';
  const emoji = getCategoryIcon(category);
  
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 36px; height: 42px; position: relative;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    ">
      <svg width="36" height="42" viewBox="0 0 36 42" fill="none">
        <path d="M18 40C18 40 4 28 4 14C4 6.5 10 2 18 2C26 2 32 6.5 32 14C32 28 18 40 18 40Z" fill="${color}" stroke="white" stroke-width="2"/>
      </svg>
      <span style="
        position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
        font-size: 16px; line-height: 1;
      ">${emoji}</span>
    </div>`,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
  });
}

function createUserMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 16px; height: 16px; background: #3B82F6;
      border: 3px solid white; border-radius: 50%;
      box-shadow: 0 2px 8px rgba(59,130,246,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function MapContainerImpl({ places, onBoundsChange }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { showToast } = useAppStore();
  const router = useRouter();

  // Initialize map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // OpenStreetMap tile layer (무료!)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Bounds change → notify parent (300ms debounce)
      let boundsTimer: ReturnType<typeof setTimeout> | null = null;
      map.on('moveend', () => {
        if (boundsTimer) clearTimeout(boundsTimer);
        boundsTimer = setTimeout(() => {
          const b = map.getBounds();
          onBoundsChange?.({
            swLat: b.getSouthWest().lat,
            swLng: b.getSouthWest().lng,
            neLat: b.getNorthEast().lat,
            neLng: b.getNorthEast().lng,
          });
        }, 300);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onBoundsChange]);

  // User location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
          useAppStore.getState().setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => console.log('Geolocation failed')
      );
    }
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user ?? null);
    });
  }, []);

  // User location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    const map = mapRef.current;

    // Remove old
    if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
    if (userCircleRef.current) map.removeLayer(userCircleRef.current);

    userCircleRef.current = L.circle(userLocation, {
      radius: 200,
      color: '#3B82F6',
      fillColor: '#3B82F6',
      fillOpacity: 0.1,
      weight: 1,
      opacity: 0.3,
    }).addTo(map);

    userMarkerRef.current = L.marker(userLocation, {
      icon: createUserMarkerIcon(),
      zIndexOffset: 1000,
    }).addTo(map);
  }, [userLocation]);

  // Place markers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const markerMap = markersRef.current;

    // Remove old markers
    markerMap.forEach((marker) => map.removeLayer(marker));
    markerMap.clear();

    // Add new markers
    places.forEach((place) => {
      const lat = Number(place.lat);
      const lng = Number(place.lng);
      if (!lat || !lng || (lat === 0 && lng === 0)) return;

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(place.category),
      });

      // Create popup content HTML
      const emoji = getCategoryIcon(place.category);
      const popupContent = `
        <div class="map-popup-content">
          <div class="map-popup-header">
            <span class="map-popup-category">${emoji} ${place.category}</span>
            <h3 class="map-popup-title">${place.place_name}</h3>
          </div>
          <div class="map-popup-body">
            <p class="map-popup-address">${place.address || ''}</p>
            ${place.phone ? `<p class="map-popup-phone">${place.phone}</p>` : ''}
            ${place.representative_menu ? `<p class="map-popup-menu">${place.representative_menu}</p>` : ''}
          </div>
          <a href="/place/${place.id}" class="map-popup-link">상세보기 →</a>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 280,
        className: 'custom-map-popup',
        offset: [0, -42],
      });

      marker.on('click', () => {
        marker.openPopup();
        map.flyTo([lat, lng], 16, { duration: 0.5 });
      });

      marker.addTo(map);
      markerMap.set(place.id, marker);
    });
  }, [places]);

  const handleCenterUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 15, { duration: 0.5 });
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Controls - my location */}
      <div className="fixed bottom-28 right-6 z-[9999]">
        <button
          onClick={handleCenterUser}
          className="w-14 h-14 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.25)] border-2 border-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:scale-110 active:scale-90 transition-all duration-200 group"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.25), 0 0 0 4px rgba(16,185,129,0.15)' }}
        >
          <Navigation className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(MapContainerImpl);