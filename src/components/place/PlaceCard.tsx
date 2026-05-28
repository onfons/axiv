import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Star, Phone, Clock, ShoppingBag, Play, ChevronRight } from 'lucide-react';
import { getCategoryIcon, getCategoryLabel, getCategoryColor } from '@/lib/categories';

function isValidInfo(val: string | undefined | null): boolean {
  if (!val) return false;
  const cleaned = val.trim();
  if (cleaned.length < 5) return false;
  const ignore = ['없음', '정보 없음', '-', 'null', 'none', 'n/a'];
  if (ignore.includes(cleaned.toLowerCase())) return false;
  return true;
}

type MrtData = {
  name?: string; image?: string; rating?: number; reviewCount?: number;
  address?: string; phone?: string; url?: string; price?: number;
  originalPrice?: number; description?: string; category?: string;
};

type Place = {
  id: string; place_name?: string; title?: string; thumbnail_url?: string;
  category?: string; rating?: number; address?: string; phone?: string;
  representative_menu?: string; business_hours?: string; break_time?: string;
  place_description?: string; waiting_tip?: string; parking_info?: string;
  lat?: number; lng?: number;
  content_places?: Array<{
    timeline_seconds?: number; creator_review?: string; summary?: string;
    contents?: { video_id?: string; title?: string; creator_name?: string; thumbnail_url?: string; };
  }>;
};

const defaultThumb = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80';

function toTimestamp(sec?: number): string {
  if (!sec && sec !== 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getOneLiner(cp: Place['content_places']): string | null {
  if (!cp || cp.length === 0) return null;
  const first = cp[0];
  const text = first.summary || first.creator_review || '';
  const cleaned = text.trim();
  if (!cleaned || cleaned.length < 4) return null;
  return cleaned.length > 70 ? cleaned.slice(0, 67) + '...' : cleaned;
}

export default function PlaceCard({ place, mrtData }: { place: Place; mrtData?: MrtData | null }) {
  const displayTitle = place.place_name || place.title;
  const hasMrt = mrtData && (mrtData.rating || mrtData.price || mrtData.description);
  const hasWaiting = isValidInfo(place.waiting_tip);
  const hasParking = isValidInfo(place.parking_info);
  const firstCp = place.content_places?.[0];
  const creators = place.content_places?.map(cp => cp.contents?.creator_name).filter(Boolean) as string[] || [];
  const uniqueCreators = [...new Set(creators)];
  const creatorBadge = uniqueCreators.length > 0
    ? uniqueCreators.slice(0, 2).join(', ') + (uniqueCreators.length > 2 ? ` 외 ${uniqueCreators.length - 2}명` : '')
    : null;
  const oneLiner = getOneLiner(place.content_places);
  const videoId = firstCp?.contents?.video_id;
  const timelineSec = firstCp?.timeline_seconds;
  const ytUrl = videoId ? `https://youtube.com/watch?v=${videoId}${timelineSec ? `&t=${timelineSec}s` : ''}` : null;

  return (
    <motion.div whileTap={{ scale: 0.98 }} className="group w-full">
      <Link href={`/place/${place.id}`} className="block w-full">
        <div className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 transition-all shadow-sm">
          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
            <Image
              src={firstCp?.contents?.thumbnail_url || place.thumbnail_url || mrtData?.image || defaultThumb}
              alt={displayTitle || ''} fill className="object-cover" sizes="80px"
            />
            {firstCp?.contents?.creator_name && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-2 pb-0.5 px-1">
                <span className="text-[8px] font-bold text-white truncate block">{firstCp.contents.creator_name}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: getCategoryColor(place.category || ''), backgroundColor: getCategoryColor(place.category || '') + '15' }}>
                {getCategoryLabel(place.category || '')}
              </span>
              {hasWaiting && <span className="shrink-0 text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">웨이팅</span>}
              {hasParking && <span className="shrink-0 text-[8px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">주차</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate leading-tight">{displayTitle}</h3>
              {creatorBadge && <span className="shrink-0 text-[8px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">{creatorBadge}</span>}
            </div>
            {oneLiner && (
              <div className="bg-emerald-50/70 dark:bg-emerald-900/10 rounded-lg px-2 py-1">
                <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 truncate">💡 {oneLiner}</p>
              </div>
            )}
            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{place.address || '주소 정보 없음'}</span>
            </p>
            <div className="flex items-center gap-2 pt-1">
              {ytUrl && (
                <span onClick={e => { e.stopPropagation(); e.preventDefault(); window.open(ytUrl, '_blank'); }} className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer">
                  <Play className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                  <span className="text-[8px] font-bold text-rose-600">{timelineSec ? `@${toTimestamp(timelineSec)}` : '유튜브'}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
