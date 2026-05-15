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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
      fetchMrtData(filtered);
    };
    fetchPlaces();
  }, [selectedCategory, searchQuery, fetchMrtData]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      
      {/* Fixed header padding */}
      <div className="pt-[60px] flex-1 flex flex-col overflow-hidden">
        
        <div className="flex flex-1 relative overflow-hidden">
          
          {/* Sidebar */}
          <AnimatePresence initial={false}>
            {isSidebarOpen && (
              <motion.aside
                initial={{ x: -420 }}
                animate={{ x: 0 }}
                exit={{ x: -420 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute md:relative bottom-0 left-0 right-0 md:right-auto w-full md:w-[400px] h-[55vh] md:h-full bg-white dark:bg-slate-950 z-[80] shadow-2xl md:shadow-none border-r border-slate-100 dark:border-slate-900 flex flex-col"
              >
                <div className="p-4 pb-2 mt-2">

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tighter leading-none">Discover</h2>
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">
                        {places.length} Places
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-center transition-colors group"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white" />
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

          {/* Toggle Trigger */}
          {!isSidebarOpen && (
            <motion.button 
              initial={{ scale: 0, x: -10 }}
              animate={{ scale: 1, x: 0 }}
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-6 bottom-6 z-[85] w-10 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
            >
              <ChevronRight className="w-5 h-5 text-slate-900 dark:text-white" />
            </motion.button>
          )}

          {/* Map */}
          <div className="flex-1 h-full z-0">
            <MapContainer places={places} />
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