'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Star, Phone, Clock, ShoppingBag, Play, ChevronRight } from 'lucide-react';
import { getCategoryIcon, getCategoryLabel, getCategoryColor } from '@/lib/categories';

/** 실제 의미 있는 웨이팅/주차 정보인지 확인 */
function isValidInfo(val: string | undefined | null): boolean {
  if (!val) return false;
  const cleaned = val.trim();
  if (cleaned.length < 5) return false;
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

/** 초 → HH:MM:SS */
function toTimestamp(sec?: number): string {
  if (!sec && sec !== 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** summary/creator_review 중 짧은 거 하나 추출 */
function getOneLiner(cp: Place['content_places']): string | null {
  if (!cp || cp.length === 0) return null;
  const first = cp[0];
  const text = first.summary || first.creator_review || '';
  const cleaned = text.trim();
  if (!cleaned || cleaned.length < 4) return null;
  // 너무 긴 건 앞 60자
  return cleaned.length > 70 ? cleaned.slice(0, 67) + '...' : cleaned;
}

export default function PlaceCard({ place, mrtData }: { place: Place; mrtData?: MrtData | null }) {
  const displayTitle = place.place_name || place.title;
  const hasMrt = mrtData && (mrtData.rating || mrtData.price || mrtData.description);
  const hasWaiting = isValidInfo(place.waiting_tip);
  const hasParking = isValidInfo(place.parking_info);

  // 유튜버 정보 + 첫 번째 콘텐츠
  const firstCp = place.content_places?.[0];
  const creators = place.content_places
    ?.map(cp => cp.contents?.creator_name)
    .filter(Boolean) as string[] || [];
  const uniqueCreators = [...new Set(creators)];
  const creatorBadge = uniqueCreators.length > 0
    ? uniqueCreators.slice(0, 2).join(', ') + (uniqueCreators.length > 2 ? ` 외 ${uniqueCreators.length - 2}명` : '')
    : null;

  const oneLiner = getOneLiner(place.content_places);

  // 유튜브 타임스탬프 링크
  const videoId = firstCp?.contents?.video_id;
  const timelineSec = firstCp?.timeline_seconds;
  const ytUrl = videoId
    ? `https://youtube.com/watch?v=${videoId}${timelineSec ? `&t=${timelineSec}s` : ''}`
    : null;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="group"
    >
      <Link href={`/place/${place.id}`} className="block">
        <div className="flex gap-3 p-3 rounded-[20px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 transition-all duration-300 shadow-sm hover:shadow-md">

          {/* Thumbnail — 유튜버 썸네일 우선 */}
          <div className="relative w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-[16px] overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
            {(firstCp?.contents?.thumbnail_url || place.thumbnail_url || mrtData?.image) ? (
              <Image
                src={firstCp?.contents?.thumbnail_url || place.thumbnail_url || mrtData?.image || defaultThumb}
                alt={displayTitle || ''}
                fill
                className="object-cover transition-all duration-300 group-hover:scale-110"
                sizes="88px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                {getCategoryIcon(place.category || '')}
              </div>
            )}
            {/* 유튜버명 오버레이 */}
            {firstCp?.contents?.creator_name && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-0.5 px-1">
                <span className="text-[7px] font-bold text-white truncate block leading-tight">
                  {firstCp.contents.creator_name}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">

            {/* Badge row — 모바일에서도 안 짤리게 overflow-x-auto */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 no-scrollbar">
              <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-1 py-0.5 rounded" style={{ color: getCategoryColor(place.category || ''), backgroundColor: getCategoryColor(place.category || '') + '15' }}>
                {getCategoryLabel(place.category || '')}
              </span>
              {hasWaiting && (
                <span className="shrink-0 text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">웨이팅</span>
              )}
              {hasParking && (
                <span className="shrink-0 text-[8px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">주차</span>
              )}
              {hasMrt && mrtData?.rating && (
                <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  <Star className="w-2 h-2 fill-amber-500 text-amber-500" />
                  {mrtData.rating.toFixed(1)}
                </span>
              )}
            </div>

            {/* Title + creator badge */}
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">
                {displayTitle}
              </h3>
              {creatorBadge && (
                <span className="shrink-0 text-[8px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                  {creatorBadge}
                </span>
              )}
            </div>

            {/* 한 줄 요약 태그 */}
            {oneLiner && (
              <div className="bg-emerald-50/70 dark:bg-emerald-900/10 rounded-lg px-2 py-1">
                <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 leading-snug line-clamp-1">
                  💡 {oneLiner}
                </p>
              </div>
            )}

            {/* Address + map links */}
            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{place.address || '주소 정보 없음'}</span>
            </p>

            {/* Menu */}
            {place.representative_menu && (
              <p className="text-[10px] text-slate-500 flex items-start gap-1 line-clamp-1">
                <ShoppingBag className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                <span className="truncate">{place.representative_menu}</span>
              </p>
            )}

            {/* Bottom row: 유튜브 바로가기 + 네이버/카카오 */}
            {place.content_places && place.content_places.length > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
                {ytUrl && (
                  <a
                    href={ytUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                    <span className="text-[8px] font-bold text-rose-600">
                      {timelineSec ? `@${toTimestamp(timelineSec)}` : '유튜브'}
                    </span>
                  </a>
                )}
                {timelineSec && videoId && (
                  <a
                    href={`https://youtube.com/watch?v=${videoId}&t=${timelineSec}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="shrink-0 text-[8px] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    이 장면 보기 →
                  </a>
                )}
                {place.place_name && (
                  <>
                    <a
                      href={`https://map.naver.com/v5/search/${encodeURIComponent(place.place_name + ' ' + (place.address || ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold text-green-600 bg-green-50 hover:bg-green-100 transition-colors"
                    >
                      N
                    </a>
                    <a
                      href={`https://map.kakao.com/link/search/${encodeURIComponent(place.place_name + ' ' + (place.address || ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold text-yellow-600 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                    >
                      K
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}