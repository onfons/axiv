'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Phone, Clock, X, Navigation, Heart, MapPin } from 'lucide-react';
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

function MapContainerImpl({ places }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
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
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // User location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
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

      marker.on('click', () => {
        setSelectedPlace(place);
      });

      marker.addTo(map);
      markerMap.set(place.id, marker);
    });
  }, [places]);

  // Selected place info window
  useEffect(() => {
    if (!selectedPlace) return;
    // Fly to selected place
    const lat = Number(selectedPlace.lat);
    const lng = Number(selectedPlace.lng);
    if (lat && lng && mapRef.current) {
      mapRef.current.flyTo([lat, lng], 16, { duration: 0.5 });
    }
  }, [selectedPlace]);

  // Favorite check
  useEffect(() => {
    if (!selectedPlace || !currentUser) {
      setIsFavorite(false);
      return;
    }
    fetch('/api/service-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'check_favorite',
        data: { userId: currentUser.id, placeId: selectedPlace.id }
      })
    }).then(r => r.json()).then(d => setIsFavorite(!!d.isFavorite)).catch(() => setIsFavorite(false));
  }, [selectedPlace, currentUser]);

  const handleCenterUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 15, { duration: 0.5 });
    }
  };

  const toggleFavorite = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!selectedPlace) return;
    setFavoriteLoading(true);
    try {
      const res = await fetch('/api/service-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_favorite',
          data: { userId: currentUser.id, placeId: selectedPlace.id, isCurrentlyFavorite: isFavorite }
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setIsFavorite(json.isFavorite);
      showToast(json.isFavorite ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기가 해제되었습니다.', 'success');
    } catch {
      showToast('처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Selected Place Info Window */}
      {selectedPlace && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-[1000] w-[300px] bg-white rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100">
          {/* Header */}
          <div className="p-4 pb-3">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-slate-900 text-base tracking-tight truncate">{selectedPlace.place_name}</h3>
                  <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black" style={{ backgroundColor: getCategoryColor(selectedPlace.category)+'20', color: getCategoryColor(selectedPlace.category) }}>{selectedPlace.category}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 truncate">{selectedPlace.address}</p>
              </div>
              <button
                onClick={() => setSelectedPlace(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0 ml-2 -mt-0.5"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pb-4 space-y-2.5">
            {/* Video thumbnail */}
            {selectedPlace.content_places?.[0]?.contents?.thumbnail_url && (
              <a
                href={`https://youtube.com/watch?v=${selectedPlace.content_places[0].contents.video_id}&t=${selectedPlace.content_places[0].timeline_seconds}s`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block w-full h-28 rounded-xl overflow-hidden group"
              >
                <img src={selectedPlace.content_places[0].contents.thumbnail_url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="thumb" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                    <Play className="w-4 h-4 text-slate-900 ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-[9px] font-bold text-white">
                  {selectedPlace.content_places[0].contents.creator_name}
                </span>
              </a>
            )}

            {/* Menu */}
            {selectedPlace.representative_menu && (
              <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: getCategoryColor(selectedPlace.category) }}>MENU</p>
                <p className="text-xs font-semibold text-slate-700 line-clamp-2 whitespace-pre-line">{selectedPlace.representative_menu}</p>
              </div>
            )}

            {/* Business hours */}
            {selectedPlace.business_hours && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{selectedPlace.business_hours}</span>
              </div>
            )}

            {/* Break time */}
            {selectedPlace.break_time && (
              <div className="flex items-center gap-2 text-[11px] text-amber-500">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>브레이크 {selectedPlace.break_time}</span>
              </div>
            )}

            {/* Contact + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedPlace.phone && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {selectedPlace.phone}
                </span>
              )}
              {selectedPlace.waiting_tip && selectedPlace.waiting_tip !== '없음' && selectedPlace.waiting_tip !== '정보 없음' && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">웨이팅</span>
              )}
              {selectedPlace.parking_info && selectedPlace.parking_info !== '없음' && selectedPlace.parking_info !== '정보 없음' && (
                <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">주차가능</span>
              )}
            </div>

            {/* CTA */}
            <div className="flex gap-2">
              <button
                onClick={toggleFavorite}
                disabled={favoriteLoading}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                  isFavorite
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                {isFavorite ? '즐겨찾기 완료' : '즐겨찾기'}
              </button>
              <button
                onClick={() => {
                  setSelectedPlace(null);
                  setTimeout(() => router.push(`/place/${selectedPlace.id}`), 50);
                }}
                className="flex-[2] py-2.5 text-white text-[11px] font-black rounded-xl hover:brightness-110 transition-all active:scale-95 shadow-lg"
                style={{ backgroundColor: getCategoryColor(selectedPlace.category), boxShadow: `0 4px 14px ${getCategoryColor(selectedPlace.category)}33` }}
              >
                상세보기
              </button>
            </div>

            {/* Map links */}
            {selectedPlace?.place_name && (
              <div className="flex gap-2 mt-2">
                <a
                  href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedPlace.place_name + ' ' + (selectedPlace.address || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-green-200"
                >
                  <MapPin className="w-3 h-3" />
                  네이버 지도
                </a>
                <a
                  href={`https://map.kakao.com/link/search/${encodeURIComponent(selectedPlace.place_name + ' ' + (selectedPlace.address || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-xl text-[10px] font-bold bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-yellow-200"
                >
                  <MapPin className="w-3 h-3" />
                  카카오맵
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Controls — 내 위치 버튼 (fixed로 항상 최상단) */}
      <div className="fixed bottom-8 right-6 z-[9999]">
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