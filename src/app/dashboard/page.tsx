'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, MapPin, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), { ssr: false });

export default function DashboardPage() {
  const [unverifiedPlaces, setUnverifiedPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const { showToast } = useAppStore();

  const fetchUnverified = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/service-save?action=get_unverified');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUnverifiedPlaces(json.data || []);
    } catch (e: any) {
      console.error('Failed to fetch unverified places:', e);
      showToast('미분류 장소 로딩 실패', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUnverified();
  }, [fetchUnverified]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/service-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_place_verified',
          data: { id, verified: true }
        })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUnverifiedPlaces(prev => prev.filter(p => p.id !== id));
      showToast('장소가 승인되어 지도에 노출됩니다.', 'success');
    } catch (e: any) {
      showToast(`승인 실패: ${e.message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('이 장소를 삭제하시겠습니까?')) return;
    setProcessingId(id);
    try {
      const { error } = await supabase.from('places').delete().eq('id', id);
      if (error) throw error;
      setUnverifiedPlaces(prev => prev.filter(p => p.id !== id));
      showToast('장소가 삭제되었습니다.', 'success');
    } catch (e: any) {
      showToast(`삭제 실패: ${e.message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white">관리자 대시보드</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                미분류 장소 — 수동 확인 후 승인해주세요
              </p>
            </div>
            <button
              onClick={fetchUnverified}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* stats */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {unverifiedPlaces.length}개 미분류
            </span>
          </div>
        </div>

        {/* map */}
        {selectedPlace && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 h-[300px]">
            <MapContainer places={[selectedPlace]} />
          </div>
        )}

        {/* list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : unverifiedPlaces.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">모든 장소가 승인되었습니다</h3>
            <p className="text-sm text-slate-500">미분류된 장소가 없습니다.</p>
          </motion.div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
              {unverifiedPlaces.map((place, i) => (
                <motion.div
                  key={place.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 transition-all cursor-pointer ${
                    selectedPlace?.id === place.id ? 'ring-2 ring-emerald-500' : 'hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                  onClick={() => setSelectedPlace(selectedPlace?.id === place.id ? null : place)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-slate-900 dark:text-white truncate">
                          {place.place_name}
                        </h3>
                        {place.category && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase shrink-0">
                            {place.category}
                          </span>
                        )}
                      </div>
                      {place.address && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3" />
                          {place.address}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        {place.lat && place.lat !== 37.5665 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> 좌표 있음
                          </span>
                        )}
                        {place.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(place.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(place.id); }}
                        disabled={processingId === place.id}
                        className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors disabled:opacity-50"
                        title="승인"
                      >
                        {processingId === place.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(place.id); }}
                        disabled={processingId === place.id}
                        className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/40 transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}