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
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
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

      marker.on('click', () => {
        setSelectedPlace(place);
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

      {/* Selected Place Info Window */}
      {selectedPlace && (() => {
        const cpList = selectedPlace.content_places || [];
        // youtube_video_id 단일 필드도 content_places에 포함
        const hasContentPlaces = cpList.length > 0;

        return (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-[9998]"
            onClick={() => setSelectedPlace(null)}
          />

          {/* Card */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[360px] max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-y-auto animate-in zoom-in-95 fade-in duration-200">
            {/* Header with close button */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-3 pb-2 bg-white/95 backdrop-blur-sm border-b border-gray-100">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                backgroundColor: `${getCategoryColor(selectedPlace.category)}20`,
                color: getCategoryColor(selectedPlace.category)
              }}>
                {getCategoryIcon(selectedPlace.category)} {selectedPlace.category}
              </span>
              <button
                onClick={() => setSelectedPlace(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            <div className="p-3">
              {/* Place name */}
              <h3 className="text-base font-bold text-gray-900 leading-tight mb-1">{selectedPlace.place_name}</h3>

              {/* Address */}
              <div className="flex items-start gap-1 mb-3 text-xs text-gray-500">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
                <span className="leading-snug">{selectedPlace.address}</span>
              </div>

              {/* YouTube creator list */}
              {hasContentPlaces ? (
                <div className="mb-3 space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">리뷰 유튜버</p>
                  {cpList.map((cp: any, i: number) => {
                    const videoId = cp.contents?.video_id;
                    const thumbnailUrl = cp.contents?.thumbnail_url;
                    const creatorName = cp.contents?.creator_name;
                    const timelineSec = cp.timeline_seconds;
                    const summary = cp.summary || cp.creator_review;
                    const ytUrl = videoId
                      ? `https://youtube.com/watch?v=${videoId}${timelineSec ? `&t=${timelineSec}s` : ''}`
                      : null;

                    const ytThumb = thumbnailUrl || (videoId
                      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                      : null);

                    return (
                      <a
                        key={i}
                        href={ytUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                      >
                        {/* 왼쪽: 썸네일 + 재생버튼 */}
                        <div className="relative w-[88px] h-[50px] rounded-lg overflow-hidden shrink-0 bg-gray-200">
                          {ytThumb && (
                            <img
                              src={ytThumb}
                              alt={creatorName || ''}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <div className="absolute inset-0 bg-black/15 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                            <Play className="w-5 h-5 text-white fill-white drop-shadow-md" />
                          </div>
                          {timelineSec && (
                            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-medium px-1 py-px rounded">
                              {Math.floor(timelineSec / 60)}:{String(Math.floor(timelineSec % 60)).padStart(2, '0')}
                            </span>
                          )}
                        </div>

                        {/* 오른쪽: 채널명 + 리뷰 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {creatorName && (
                              <span className="text-sm font-bold text-gray-900 truncate">{creatorName}</span>
                            )}
                            <span className="text-[10px] text-red-500 font-medium shrink-0">보기</span>
                          </div>
                          {summary && (
                            <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
                              {summary}
                            </p>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : selectedPlace.youtube_video_id ? (
                /* Fallback: 단일 youtube_video_id 필드 */
                <div className="mb-3">
                  <a
                    href={`https://www.youtube.com/watch?v=${selectedPlace.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block w-full aspect-video rounded-xl overflow-hidden bg-gray-900 cursor-pointer group"
                  >
                    <img
                      src={`https://img.youtube.com/vi/${selectedPlace.youtube_video_id}/maxresdefault.jpg`}
                      alt={selectedPlace.place_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = '1';
                          img.src = `https://img.youtube.com/vi/${selectedPlace.youtube_video_id}/hqdefault.jpg`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/95 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 text-red-500 ml-0.5" />
                      </div>
                    </div>
                  </a>
                </div>
              ) : null}

              {/* Business info */}
              <div className="space-y-1.5 mb-3">
                {selectedPlace.representative_menu && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs w-10 flex-shrink-0">메뉴</span>
                    <span className="text-gray-800 font-medium">{selectedPlace.representative_menu}</span>
                  </div>
                )}
                {selectedPlace.business_hours && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{selectedPlace.business_hours}</span>
                  </div>
                )}
                {selectedPlace.break_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-3.5 flex-shrink-0" />
                    <span className="text-orange-500 text-xs font-medium">브레이크타임 {selectedPlace.break_time}</span>
                  </div>
                )}
                {selectedPlace.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{selectedPlace.phone}</span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                {/* Favorite + Detail */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!currentUser) {
                        showToast?.('로그인이 필요한 기능입니다.', 'info');
                        return;
                      }
                      if (favoriteLoading) return;
                      setFavoriteLoading(true);
                      try {
                        const res = await fetch('/api/service-save', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'toggle_favorite',
                            data: {
                              userId: currentUser.id,
                              placeId: selectedPlace.id,
                              currentlyFavorite: isFavorite,
                            }
                          })
                        });
                        const d = await res.json();
                        if (d.success) {
                          setIsFavorite(!isFavorite);
                          showToast?.(isFavorite ? '즐겨찾기에서 제거했습니다.' : '즐겨찾기에 추가했습니다.', 'success');
                        }
                      } catch (e) {
                        console.error('Toggle favorite error:', e);
                      } finally {
                        setFavoriteLoading(false);
                      }
                    }}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isFavorite
                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-red-400'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => router.push(`/place/${selectedPlace.id}`)}
                    className="flex-1 h-10 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: getCategoryColor(selectedPlace.category) }}
                  >
                    상세보기
                  </button>
                </div>

                {/* Map links */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`https://map.naver.com/p/search/${encodeURIComponent(selectedPlace.place_name)}`, '_blank')}
                    className="flex-1 h-10 rounded-xl bg-[#03C75A] text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <span className="text-base font-bold">N</span>
                    <span>네이버 지도</span>
                  </button>
                  <button
                    onClick={() => window.open(`https://map.kakao.com/link/search/${encodeURIComponent(selectedPlace.place_name)}`, '_blank')}
                    className="flex-1 h-10 rounded-xl bg-[#FEE500] text-[#191919] text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <span className="text-base font-bold">K</span>
                    <span>카카오맵</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {/* Floating Controls - my location */}
      <div className="fixed bottom-20 right-5 z-[9999]">
        <button
          onClick={handleCenterUser}
          className="w-11 h-11 bg-white rounded-[14px] shadow-lg border-2 border-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:scale-110 active:scale-90 transition-all duration-200 group"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2), 0 0 0 3px rgba(16,185,129,0.12)' }}
        >
          <Navigation className="w-5 h-5 text-emerald-500 group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(MapContainerImpl);