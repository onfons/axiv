'use client';

import { GoogleMap, LoadScriptNext, Marker, Circle, OverlayView } from '@react-google-maps/api';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Phone, Clock, X, Navigation, Heart } from 'lucide-react';
import { getCategoryColor } from '@/lib/categories';
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
  const symbols: Record<string, string> = {
    food: '<circle cx="12" cy="9" r="3.5" fill="white"/><path d="M10 7l4 4M14 7l-4 4" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    cafe: '<path d="M8 10h8M9.5 8h5M10.5 6h3" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    camping: '<path d="M8 11l4-4 4 4M9.5 11v3.5h5V11" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    fishing: '<circle cx="12" cy="8" r="2.5" fill="white"/><path d="M8 12c1.5 0 3-1 4-2" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    travel: '<path d="M12 7l2 3 3 .5-2.5 2.5.8 3L12 14l-3.3 2 .8-3L7 10.5l3-.5z" fill="white"/>',
    accommodation: '<rect x="9" y="11" width="6" height="5" rx="0.8" fill="white"/><path d="M9 8h6v3H9zm1-3h4v2h-4z" fill="white"/>',
  };
  const inner = symbols[category] || '';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" width="48" height="56">' +
    '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="white" stroke-width="2"/>' +
    inner +
    '</svg>';
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
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
                          <span className="shrink-0 px-1.5 py-0.5 bg-emerald-50 rounded-md text-[9px] font-black text-emerald-600">{selectedPlace.category}</span>
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
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1">MENU</p>
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
                        // 약간의 지연 후 페이지 이동 (Google Maps 정리 시간 확보)
                        setTimeout(() => router.push(`/place/${selectedPlace.id}`), 50);
                      }}
                      className="flex-[2] py-2.5 bg-emerald-500 text-white text-[11px] font-black rounded-xl hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                    >
                      상세보기
                    </button>
                    </div>
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