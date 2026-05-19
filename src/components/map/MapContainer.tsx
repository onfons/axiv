'use client';

import { GoogleMap, LoadScriptNext, Marker, Circle, OverlayView } from '@react-google-maps/api';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Phone, Clock, X, Navigation, Heart, MapPin } from 'lucide-react';
import { getCategoryColor, getCategoryIcon } from '@/lib/categories';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';


const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 37.5665, lng: 126.9780 };

const mapStyles = [
  {
    featureType: "all",
    elementType: "geometry",
    stylers: [{ color: "#f8fafc" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e2e8f0" }]
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }]
  }
];

interface MapProps {
  places: any[];
}

function getMarkerIcon(category: string): google.maps.Icon {
  const color = getCategoryColor(category) || '#10B981';
  const emoji = getCategoryIcon(category);
  // Draw emoji on a canvas and return as data URL
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 56;
  const ctx = canvas.getContext('2d')!;
  // Pin shape
  ctx.beginPath();
  ctx.moveTo(24, 54);
  ctx.bezierCurveTo(10, 40, 4, 30, 4, 18);
  ctx.bezierCurveTo(4, 7, 13, 2, 24, 2);
  ctx.bezierCurveTo(35, 2, 44, 7, 44, 18);
  ctx.bezierCurveTo(44, 30, 38, 40, 24, 54);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Emoji in center
  ctx.font = '22px "Apple Color Emoji", "Segoe UI Emoji", Noto Color Emoji, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 24, 19);

  return {
    url: canvas.toDataURL(),
    scaledSize: new google.maps.Size(36, 42),
    anchor: new google.maps.Point(18, 42),
  };
}

function MapContainerImpl({ places }: MapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY as string;
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { showToast } = useAppStore();

  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => console.log('Geolocation failed')
      );
    }
    // 현재 유저 정보 로드
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data?.user ?? null);
    });
  }, []);

  const handleCenterUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.panTo(userLocation);
      mapRef.current.setZoom(15);
    }
  };

// 즐겨찾기 체크 — 서비스 API (RLS 우회)
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

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onIdle = useCallback(() => {
    // mapBounds를 사용하지 않음 — 모든 장소는 초기에 한 번만 로드
  }, []);

  if (!apiKey) return <div className="h-full bg-slate-50 flex items-center justify-center font-black text-slate-300">API Key Missing</div>;

  return (
    <div className="relative h-full w-full">
      <LoadScriptNext googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={userLocation || defaultCenter}
          zoom={13}
          onLoad={onMapLoad}
          onIdle={onIdle}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            styles: mapStyles,
          }}
        >
          {/* User Location Marker */}
          {userLocation && (
            <>
              <Circle
                center={userLocation}
                radius={200}
                options={{
                  fillColor: '#3B82F6',
                  fillOpacity: 0.15,
                  strokeColor: '#3B82F6',
                  strokeOpacity: 0.3,
                  strokeWeight: 1,
                }}
              />
              <Marker
                position={userLocation}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#3B82F6',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                }}
              />
            </>
          )}

          {/* Place Markers */}
          {places.map((place) => (
            <Marker
              key={place.id}
              position={{ lat: Number(place.lat), lng: Number(place.lng) }}
              onClick={() => setSelectedPlace(place)}
              icon={getMarkerIcon(place.category)}
            />
          ))}

          {selectedPlace && (
            <OverlayView
              position={{ lat: Number(selectedPlace.lat), lng: Number(selectedPlace.lng) }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div className="absolute -translate-x-1/2 -translate-y-[calc(100%+60px)] z-[1000]">
                <div className="w-[300px] bg-white rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 relative">
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

                    {/* Contact + waiting/parking badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedPlace.phone && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedPlace.phone}
                        </span>
                      )}
                      {selectedPlace.waiting_tip && selectedPlace.waiting_tip !== '없음' && selectedPlace.waiting_tip !== '정보 없음' && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          웨이팅
                        </span>
                      )}
                      {selectedPlace.parking_info && selectedPlace.parking_info !== '없음' && selectedPlace.parking_info !== '정보 없음' && (
                        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                          주차가능
                        </span>
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
              </div>
            </OverlayView>
          )}
        </GoogleMap>
      </LoadScriptNext>


      {/* Floating Controls */}
      <div className="absolute bottom-10 right-6 z-20 flex flex-col gap-3">
        <button
          onClick={handleCenterUser}
          className="w-12 h-12 bg-white rounded-2xl shadow-2xl border border-slate-100 flex items-center justify-center group hover:bg-emerald-500 transition-all active:scale-90"
        >
          <Navigation className="w-5 h-5 text-slate-600 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
}

export default React.memo(MapContainerImpl);