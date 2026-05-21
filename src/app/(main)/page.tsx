'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import PlaceCard from '@/components/place/PlaceCard';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import { List, ChevronUp } from 'lucide-react';
import Link from 'next/link';

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), { ssr: false });

export default function MainPage() {
  const [places, setPlaces] = useState<any[]>([]);
  const [mrtDataMap, setMrtDataMap] = useState<Record<string, any>>({});
  const { selectedCategory, searchQuery, userLocation, setMapBounds } = useAppStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const pillTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    // 지도 이동 시 Pill 바 표시, 3초 후 사라짐
    setShowPill(true);
    if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
    pillTimerRef.current = setTimeout(() => setShowPill(false), 3000);
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

          {/* Sidebar - 바텀시트 */}
          <AnimatePresence initial={false}>
            {sidebarReady && isSidebarOpen && (
              <motion.aside
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 h-[55vh] bg-white dark:bg-slate-950 z-[90] shadow-2xl border-t border-slate-200 dark:border-slate-800 flex flex-col rounded-t-2xl"
              >
                {/* 바텀시트 핸들 */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>

                {/* 헤더 */}
                <div className="px-4 pb-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                      유튜브 핫플
                    </span>
                    <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {places.length}곳
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                {/* 리스트 */}
                <div className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar space-y-3">
                  {places.map((place, idx) => (
                    <motion.div
                      key={place.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                    >
                      <PlaceCard place={place} mrtData={mrtDataMap[place.id]} />
                    </motion.div>
                  ))}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Map */}
          <div className="flex-1 h-full z-0 relative">
            <MapContainer places={places} onBoundsChange={handleBoundsChange} />

            {/* 하단 플로팅 Pill 바 */}
            {sidebarReady && !isSidebarOpen && places.length > 0 && showPill && (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                onClick={toggleSidebar}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-white dark:bg-slate-900 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.15)] border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2 hover:shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <List className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  장소 {places.length}곳
                </span>
                <ChevronUp className="w-4 h-4 text-slate-400" />
              </motion.button>
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