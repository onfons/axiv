'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MapContainer from '@/components/map/MapContainer';
import PlaceCard from '@/components/place/PlaceCard';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import { List, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function MainPage() {
  const [places, setPlaces] = useState<any[]>([]);
  const [mrtDataMap, setMrtDataMap] = useState<Record<string, any>>({});
  const { selectedCategory, searchQuery } = useAppStore();
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // MyRealTrip 데이터를 병렬로 가져오는 함수
  const fetchMrtData = useCallback(async (placeList: any[]) => {
    if (!placeList || placeList.length === 0) return;

    const results: Record<string, any> = {};
    const batchSize = 5; // 한 번에 5개씩만 (API rate limit)

    for (let i = 0; i < placeList.length; i += batchSize) {
      const batch = placeList.slice(i, i + batchSize);
      const promises = batch.map(async (place) => {
        // 장소명이나 주소로 MyRealTrip 검색
        const keyword = place.place_name || place.address || '';
        if (!keyword || keyword.length < 2) return;

        try {
          const params = new URLSearchParams({ q: keyword });
          // 좌표가 있으면 위치 기반 검색 추가
          if (place.lat && place.lng) {
            params.set('lat', place.lat.toString());
            params.set('lng', place.lng.toString());
          }

          const res = await fetch(`/api/myrealtrip?${params.toString()}`);
          const data = await res.json();
          if (data.places && data.places.length > 0) {
            results[place.id] = data.places[0]; // 첫 번째 결과 사용
          }
        } catch (err) {
          console.error(`MRT fetch error for ${keyword}:`, err);
        }
      });

      await Promise.all(promises);
      // batch 사이에 잠시 대기 (rate limit 회피)
      if (i + batchSize < placeList.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setMrtDataMap(prev => ({ ...prev, ...results }));
  }, []);

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
          return matchesName || matchesAddress || matchesCreator;
        });
      }

      setPlaces(filtered);
      // MyRealTrip 데이터 병렬 조회
      fetchMrtData(filtered);
    };
    fetchPlaces();
  }, [selectedCategory, searchQuery, mapBounds, fetchMrtData]);


  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      
      {/* Header is handled globally in layout.tsx */}

      <div className="flex flex-1 h-full relative overflow-hidden">
        
        {/* Sidebar - Minimalist Sliding interaction */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside
              initial={{ x: -420 }}
              animate={{ x: 0 }}
              exit={{ x: -420 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute md:relative bottom-0 left-0 right-0 md:right-auto w-full md:w-[400px] h-[60vh] md:h-full bg-white dark:bg-slate-950 z-[80] shadow-2xl md:shadow-none border-r border-slate-100 dark:border-slate-900 flex flex-col"
            >
              <div className="p-8 pb-4 mt-4">

                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">Discover</h2>
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">
                      {places.length} Places Found
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="w-10 h-10 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-center transition-colors group"
                  >
                    <ChevronLeft className="w-6 h-6 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white" />
                  </button>
                </div>
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

        {/* Minimal Toggle Trigger */}
        {!isSidebarOpen && (
          <motion.button 
            initial={{ scale: 0, x: -10 }}
            animate={{ scale: 1, x: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-[85] w-12 h-12 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          >
            <ChevronRight className="w-6 h-6 text-slate-900 dark:text-white" />
          </motion.button>
        )}

        {/* Immersive Map Container */}
        <div className="flex-1 h-full z-0">
          <MapContainer 
            places={places} 
            onBoundsChange={(bounds) => setMapBounds(bounds)} 
          />
        </div>

      </div>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 w-full py-10 px-6 border-t border-emerald-500/20 flex flex-col md:flex-row justify-between items-center gap-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <span className="text-[10px] text-slate-400 tracking-widest uppercase">© 2024 AXIV. AI-Powered Place Curation.</span>
        </div>
        <div className="flex gap-10">
          <Link href="/contact" className="text-xs text-slate-400 hover:text-emerald-500 transition-colors font-medium">문의하기</Link>
          <Link href="/privacy" className="text-xs text-slate-400 hover:text-emerald-500 transition-colors font-medium">개인정보처리방침</Link>
        </div>
      </footer>
    </div>
  );
}