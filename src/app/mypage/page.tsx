'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import { 
  Heart,
  Video,
  Trash2,
  ExternalLink,
  MapPin,
  Phone,
  ChevronRight,
  Loader2,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MyPage() {
  const [contents, setContents] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'videos' | 'favorites'>('videos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // 1. Fetch My Contents (본인 것만)
          const { data: contentsData } = await supabase
            .from('contents')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          setContents(contentsData || []);

          // 2. Fetch Favorite Places
          const res = await fetch('/api/service-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_favorites_with_places',
              data: { userId: user.id }
            })
          });
          const json = await res.json();
          if (!json.error) {
            setFavorites(json.data || []);
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const { showToast, showConfirm } = useAppStore();

  const handleDelete = async (id: string) => {
    showConfirm('영상 삭제', '정말 이 영상을 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.', async () => {
      try {
        const res = await fetch('/api/service-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_content', data: { id } })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setContents(contents.filter(c => c.id !== id));
        showToast('정상적으로 삭제되었습니다.', 'success');
      } catch (err: any) {
        showToast(`삭제에 실패했습니다: ${err.message}`, 'error');
      }
    });
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    showConfirm('즐겨찾기 해제', '즐겨찾기 목록에서 삭제하시겠습니까?', async () => {
      const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
      if (!error) {
        setFavorites(favorites.filter(f => f.id !== favoriteId));
        showToast('즐겨찾기가 해제되었습니다.', 'success');
      } else {
        showToast('오류가 발생했습니다.', 'error');
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl font-black text-slate-900 dark:text-white tracking-tight"
            >
              마이페이지
            </motion.h1>
            <p className="text-slate-500 font-medium">활동 내역과 즐겨찾는 장소를 관리하세요.</p>
          </div>
          
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <button 
              onClick={() => setActiveTab('videos')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeTab === 'videos' 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 dark:shadow-none' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Video className="w-4 h-4" />
              나의 영상
            </button>
            <button 
              onClick={() => setActiveTab('favorites')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                activeTab === 'favorites' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className="w-4 h-4" />
              즐겨찾기
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-slate-400 font-bold text-sm">정보를 불러오고 있습니다...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'videos' ? (
                <motion.div 
                  key="videos"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {contents.length === 0 ? (
                    <EmptyState icon={<Video className="w-12 h-12" />} message="등록된 영상이 없습니다." />
                  ) : (
                    contents.map((content) => (
                      <VideoCard key={content.id} content={content} onDelete={() => handleDelete(content.id)} />
                    ))
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="favorites"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                  {favorites.length === 0 ? (
                    <EmptyState icon={<Bookmark className="w-12 h-12" />} message="즐겨찾기한 장소가 없습니다." />
                  ) : (
                    favorites.map((fav) => (
                      <FavoriteCard key={fav.id} favorite={fav} onRemove={() => handleRemoveFavorite(fav.id)} />
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode, message: string }) {
  return (
    <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 bg-white dark:bg-slate-900 rounded-[32px] border-2 border-dashed border-slate-100 dark:border-slate-800">
      <div className="mb-4 opacity-50">{icon}</div>
      <p className="text-lg font-black">{message}</p>
    </div>
  );
}

function VideoCard({ content, onDelete }: { content: any, onDelete: () => void }) {
  // 썸네일 URL이 없을 경우를 대비한 기본 이미지
  const thumbnailUrl = content.thumbnail_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop';

  return (
    <div className="group bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-slate-100 dark:border-slate-800">
      <div className="relative aspect-video overflow-hidden">
        <Image src={thumbnailUrl} alt={content.title} fill className="object-cover transition-transform group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <span className="text-white text-[10px] font-black uppercase tracking-widest">View Details</span>
        </div>
        <div className="absolute top-3 left-3 flex gap-2">
           <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-xl backdrop-blur-md ${
             content.status === 'approved' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
           }`}>
             {content.status === 'approved' ? 'Approved' : 'Pending'}
           </span>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <h3 className="font-black text-slate-900 dark:text-white line-clamp-2 leading-tight mb-1">{content.title}</h3>
          <p className="text-xs font-bold text-slate-400">{content.creator_name}</p>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
          <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(content.created_at).toLocaleDateString()}</span>
          <div className="flex gap-2">
            <button onClick={onDelete} className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button className="p-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FavoriteCard({ favorite, onRemove }: { favorite: any, onRemove: () => void }) {
  const { place } = favorite;
  if (!place) return null;

  return (
    <div className="group bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm hover:shadow-2xl transition-all border border-slate-100 dark:border-slate-800">
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
          <MapPin className="w-6 h-6 text-emerald-500" />
        </div>
        <button onClick={onRemove} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors">
          <Heart className="w-5 h-5 fill-current" />
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{place.place_name}</h3>
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{place.category}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-500">
            <MapPin className="w-3.5 h-3.5" />
            <p className="text-xs font-bold truncate">{place.address}</p>
          </div>
          {place.phone && (
            <div className="flex items-center gap-2 text-slate-500">
              <Phone className="w-3.5 h-3.5" />
              <p className="text-xs font-bold">{place.phone}</p>
            </div>
          )}
        </div>
        
        <div className="pt-4 flex gap-2">
          <button className="flex-1 py-2.5 bg-slate-900 text-white text-[11px] font-black rounded-xl hover:bg-emerald-600 transition-all">
            상세보기
          </button>
          <button className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-all">
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
