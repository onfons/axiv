'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Star, Phone, Clock, ShoppingBag } from 'lucide-react';
import { getCategoryIcon, getCategoryLabel, getCategoryColor } from '@/lib/categories';

/** 실제 의미 있는 웨이팅/주차 정보인지 확인 */
function isValidInfo(val: string | undefined | null): boolean {
  if (!val) return false;
  const cleaned = val.trim();
  if (cleaned.length < 5) return false; // 너무 짧으면 의미 없음
  const ignore = ['없음', '정보 없음', '-', 'null', 'none', 'n/a'];
  if (ignore.includes(cleaned.toLowerCase())) return false;
  return true;
}

type MrtData = {
  name?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  url?: string;
  price?: number;
  originalPrice?: number;
  description?: string;
  category?: string;
};

type Place = {
  id: string;
  place_name?: string;
  title?: string;
  thumbnail_url?: string;
  category?: string;
  rating?: number;
  address?: string;
  phone?: string;
  representative_menu?: string;
  business_hours?: string;
  break_time?: string;
  place_description?: string;
  waiting_tip?: string;
  parking_info?: string;
  lat?: number;
  lng?: number;
  content_places?: Array<{
    timeline_seconds?: number;
    creator_review?: string;
    summary?: string;
    contents?: {
      video_id?: string;
      title?: string;
      creator_name?: string;
      thumbnail_url?: string;
    };
  }>;
};

const defaultThumb = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&q=80';

export default function PlaceCard({ place, mrtData }: { place: Place; mrtData?: MrtData | null }) {
  const displayTitle = place.place_name || place.title;
  const hasMrt = mrtData && (mrtData.rating || mrtData.price || mrtData.description);
  const hasWaiting = isValidInfo(place.waiting_tip);
  const hasParking = isValidInfo(place.parking_info);
  
  // 유튜버 정보 추출
  const creators = place.content_places
    ?.map(cp => cp.contents?.creator_name)
    .filter(Boolean) as string[] || [];
  const uniqueCreators = [...new Set(creators)];
  const creatorBadge = uniqueCreators.length > 0 
    ? uniqueCreators.slice(0, 2).join(', ') + (uniqueCreators.length > 2 ? ` 외 ${uniqueCreators.length - 2}명` : '')
    : null;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="group"
    >
      <Link href={`/place/${place.id}`} className="block">
        <div className="flex gap-4 p-4 rounded-[24px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 transition-all duration-300 shadow-sm hover:shadow-md">

          {/* Thumbnail */}
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-[16px] overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
            {(place.thumbnail_url || mrtData?.image) ? (
              <Image
                src={place.thumbnail_url || mrtData?.image || defaultThumb}
                alt={displayTitle || ''}
                fill
                className="object-cover transition-all duration-300 group-hover:scale-110"
                sizes="96px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {getCategoryIcon(place.category || '')}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: getCategoryColor(place.category || '') }}>
                {getCategoryLabel(place.category || '')}
              </span>
              {creatorBadge && (
                <span className="text-[8px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md truncate max-w-[160px]">
                  {creatorBadge}
                </span>
              )}
              {hasMrt && mrtData?.rating && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                  {mrtData.rating.toFixed(1)}
                </span>
              )}
            </div>

            <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">
              {displayTitle}
            </h3>

            <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{place.address || '주소 정보 없음'}</span>
              {place.place_name && (
                <span className="flex gap-0.5 shrink-0 ml-auto">
                  <span
                    onClick={e => { e.stopPropagation(); e.preventDefault(); window.open(`https://map.naver.com/v5/search/${encodeURIComponent(place.place_name + ' ' + (place.address || ''))}`, '_blank', 'noopener,noreferrer'); }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold text-green-600 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer"
                  >
                    네이버지도
                  </span>
                  <span
                    onClick={e => { e.stopPropagation(); e.preventDefault(); window.open(`https://map.kakao.com/link/search/${encodeURIComponent(place.place_name + ' ' + (place.address || ''))}`, '_blank', 'noopener,noreferrer'); }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold text-yellow-600 bg-yellow-50 hover:bg-yellow-100 transition-colors cursor-pointer"
                  >
                    카카오맵
                  </span>
                </span>
              )}
            </p>

            {/* Business hours */}
            {place.business_hours && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{place.business_hours}</span>
              </p>
            )}

            {/* Break time */}
            {place.break_time && (
              <p className="text-[10px] text-amber-500 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span>브레이크타임 {place.break_time}</span>
              </p>
            )}

            {/* Representative menu */}
            {(place.representative_menu || mrtData?.price) && (
              <p className="text-[10px] text-slate-500 flex items-start gap-1 line-clamp-1">
                <ShoppingBag className="w-3 h-3 shrink-0 mt-0.5" />
                {place.representative_menu && <span>{place.representative_menu}</span>}
                {mrtData?.price && (
                  <span className="text-emerald-500 font-semibold shrink-0">
                    · {mrtData.price.toLocaleString()}원
                  </span>
                )}
              </p>
            )}

            {/* Contact + waiting/parking badges */}
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              {place.phone && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {place.phone}
                </span>
              )}
              {hasWaiting && (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  웨이팅
                </span>
              )}
              {hasParking && (
                <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                  주차가능
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}