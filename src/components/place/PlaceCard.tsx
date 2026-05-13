'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Star, ChevronRight, Phone, Clock, ShoppingBag } from 'lucide-react';



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
};


const categoryIcons: Record<string, string> = {
  food: '🍕',
  cafe: '☕',
  camping: '⛺',
  fishing: '🎣',
  travel: '✈️',
  hiking: '🥾',
  sightseeing: '🏛️',
  accommodation: '🏨',
};

export default function PlaceCard({ place }: { place: Place }) {
  const displayTitle = place.place_name || place.title;
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="group"
    >
      <Link href={`/place/${place.id}`} className="block">
        <div className="flex gap-4 p-4 rounded-[24px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800 transition-all duration-300 shadow-sm hover:shadow-md">
          
          {/* Compact Thumbnail for Mobile */}
          <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-2xl overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800">
            {place.thumbnail_url ? (
              <Image
                src={place.thumbnail_url}
                alt={displayTitle || 'place'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">
                {categoryIcons[place.category || ''] || '📍'}
              </div>
            )}
          </div>

          {/* Professional Content */}
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">{place.category}</span>
              <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                <span className="text-[9px] font-black text-slate-400">{place.rating || 4.5}</span>
              </div>
            </div>
            
            <h3 className="text-base font-black text-slate-900 dark:text-white truncate mb-1 tracking-tight group-hover:text-emerald-500 transition-colors">
              {displayTitle}
            </h3>
            
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3 h-3 shrink-0 text-emerald-500/50" />
                <p className="text-[10px] font-bold truncate tracking-tight">{place.address || '주소 정보 없음'}</p>
              </div>
              {place.phone && (
                <div className="flex items-center gap-1 text-slate-400">
                  <Phone className="w-3 h-3 shrink-0 text-emerald-500/50" />
                  <p className="text-[10px] font-bold truncate tracking-tight">{place.phone}</p>
                </div>
              )}
              {place.representative_menu && (
                <div className="flex items-center gap-1 text-slate-400">
                  <ShoppingBag className="w-3 h-3 shrink-0 text-emerald-500/50" />
                  <p className="text-[10px] font-bold truncate tracking-tight line-clamp-1">{place.representative_menu}</p>
                </div>
              )}
              {place.business_hours && (
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3 shrink-0 text-emerald-500/50" />
                  <p className="text-[10px] font-bold truncate tracking-tight">{place.business_hours}</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </Link>
    </motion.div>
  );
}

