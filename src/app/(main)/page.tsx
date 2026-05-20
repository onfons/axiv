'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import PlaceCard from '@/components/place/PlaceCard';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import { List, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), { ssr: false });

export default function MainPage() {
  const [places, setPlaces] = useState<any[]>([]);
  const [mrtDataMap, setMrtDataMap] = useState<Record<string, any>>({});
  const { selectedCategory, searchQuery, userLocation, setMapBounds } = useAppStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  // sessionStorage에서 사이드바 상태 복원 (뒤로가기 시 닫힌 상태 유지)
  useEffect(() => {
    const stored = sessionStorage.getItem('sidebarOpen');
    if (stored !== null) {
      setIsSidebarOpen(stored === 'true');
    }
    setSidebarReady(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => {
      sessionStorage.setItem('sidebarOpen', String(!prev));
      return !prev;
    });
  }, []);
  const [mapBounds, setLocalMapBounds] = useState<{ swLat: number; swLng: number; neLat: number; neLng: number } | null>(null);

  // MyRealTrip 데이터를 병렬로 가져오는 함수
  const fetchMrtData = useCallback(async (placeList: any[]) => {
    if (!placeList || placeList.length === 0) return;

    const results: Record<string, any> = {};
    const batchSize = 5;

    for (let i = 0; i < placeList.length; i += batchSize) {
      const batch = placeList.slice(i, i + batchSize);
      const promises = batch.map(async (place) => {
        const keyword = place.place_name || place.address || '';
        if (!keyword || keyword.length < 2) return;

        try {
          const params = new URLSearchParams({ q: keyword });
          if (place.lat && place.lng) {
            params.set('lat', place.lat.toString());
            params.set('lng', place.lng.toString());
          }

          const res = await fetch(`/api/myrealtrip?${params.toString()}`);
          const data = await res.json();
          if (data.places && data.places.length > 0) {
            results[place.id] = data.places[0];
          }
        } catch (err) {
          console.error(`MRT fetch error for ${keyword}:`, err);
        }
      });

      await Promise.all(promises);
      if (i + batchSize < placeList.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setMrtDataMap(prev => ({ ...prev, ...results }));
  }, []);

  /** Calculate initial bounds from GPS location (반경 ~10km = 약 0.1도) */
  const getInitialBounds = useCallback(() => {
    if (!userLocation) return null;
    const lat = userLocation.lat;
    const lng = userLocation.lng;
    const offset = 0.1; // ~10km
    return {
      swLat: lat - offset,
      swLng: lng - offset,
      neLat: lat + offset,
      neLng: lng + offset,
    };
  }, [userLocation]);

  const handleBoundsChange = useCallback((bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => {
    setLocalMapBounds(bounds);
    setMapBounds(bounds);
  }, [setMapBounds]);

  useEffect(() => {
    const fetchPlaces = async () => {
      let query = supabase.from('places').select(`
        *,
        content_places (
          timeline_seconds,
          creator_review,
          summary,
          contents (
            video_id,
            title,
            creator_name,
            thumbnail_url
          )
        )
      `);

      // Bounds 필터 (우선순위: 지도 bounds > GPS 초기 bounds)
      const activeBounds = mapBounds || getInitialBounds();
      if (activeBounds) {
        query = query
          .gte('lat', activeBounds.swLat)
          .lte('lat', activeBounds.neLat)
          .gte('lng', activeBounds.swLng)
          .lte('lng', activeBounds.neLng);
      }

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
      
      if (error) {
        console.error('Places fetch error:', error);
        return;
      }

      let filtered = data || [];
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = filtered.filter((place: any) => {
          const matchesName = place.place_name?.toLowerCase().includes(lowerQuery);
          const matchesAddress = place.address?.toLowerCase().includes(lowerQuery);
          const matchesCreator = place.content_places?.some((cp: any) => 
            cp.contents?.creator_name?.toLowerCase().includes(lowerQuery)
          );
          // 썸네일 설명에서도 검색
          const matchesDescription = place.place_description?.toLowerCase().includes(lowerQuery);
          const matchesMenu = place.representative_menu?.toLowerCase().includes(lowerQuery);
          return matchesName || matchesAddress || matchesCreator || matchesDescription || matchesMenu;
        });

        // 유튜버 검색 시 관련 장소가 상단에 오도록 정렬 (creator match 우선)
        if (filtered.length > 1) {
          filtered.sort((a: any, b: any) => {
            const aCreator = a.content_places?.some((cp: any) =>
              cp.contents?.creator_name?.toLowerCase().includes(lowerQuery)
            ) ? 1 : 0;
            const bCreator = b.content_places?.some((cp: any) =>
              cp.contents?.creator_name?.toLowerCase().includes(lowerQuery)
            ) ? 1 : 0;
            return bCreator - aCreator;
          });
        }
      }

      setPlaces(filtered);
      fetchMrtData(filtered);
    };
    fetchPlaces();
  }, [selectedCategory, searchQuery, fetchMrtData, mapBounds, getInitialBounds]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      
      {/* Fixed header padding */}
      <div className="pt-[60px] flex-1 flex flex-col overflow-hidden">
        
        <div className="flex flex-1 relative overflow-hidden">
          
          {/* Sidebar */}
          <AnimatePresence initial={false}>
            {sidebarReady && isSidebarOpen && (
              <motion.aside
                initial={{ x: -420 }}
                animate={{ x: 0 }}
                exit={{ x: -420 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute md:absolute bottom-0 left-6 right-0 md:right-auto w-[calc(100%-24px)] md:w-[calc(100%-48px)] h-[50vh] md:h-[45vh] bg-white dark:bg-slate-950 z-[80] shadow-2xl md:shadow-xl border-r border-slate-100 dark:border-slate-900 flex flex-col md:rounded-2xl md:top-[calc(50%+12px)] md:left-6"
              >
                <div className="p-4 pb-2 mt-2">

                  {/* Close button removed — moved outside sidebar */}

                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-20 custom-scrollbar space-y-3">
                  {places.map((place, idx) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <PlaceCard place={place} mrtData={mrtDataMap[place.id]} />
                    </motion.div>
                  ))}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* toggle button */}
          <button
            onClick={toggleSidebar}
            className="absolute left-6 top-16 z-[90] w-9 h-9 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          >
            {isSidebarOpen ? (
              <ChevronLeft className="w-4 h-4 text-slate-900 dark:text-white" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-900 dark:text-white" />
            )}
          </button>

          {/* Map */}
          <div className="flex-1 h-full z-0 relative">
            <MapContainer places={places} onBoundsChange={handleBoundsChange} />

            {/* hotplace button when sidebar closed */}
            {!isSidebarOpen && places.length > 0 && (
              <button
                onClick={toggleSidebar}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.2)] border border-emerald-500/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                이 지역 유튜브 핫플 {places.length}곳 보기
              </button>
            )}
          </div>

        </div>

        {/* ================= FOOTER ================= */}
        <footer className="w-full py-2 px-3 border-t border-emerald-500/20 flex flex-col md:flex-row justify-between items-center gap-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shrink-0">
          <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
            <span className="text-[8px] text-slate-400 tracking-widest uppercase">© 2026 FONS - AXIV Place Curation.</span>
          </div>
          <div className="flex gap-3">
            <Link href="/terms" className="text-[10px] text-slate-400 hover:text-emerald-500 transition-colors font-medium">이용약관</Link>
            <Link href="/privacy" className="text-[10px] text-slate-400 hover:text-emerald-500 transition-colors font-medium">개인정보처리방침</Link>
            <Link href="/contact" className="text-[10px] text-slate-400 hover:text-emerald-500 transition-colors font-medium">문의하기</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}