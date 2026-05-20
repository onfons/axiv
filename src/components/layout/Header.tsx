'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import { Search, X } from 'lucide-react';
import { CATEGORIES, getCategoryIcon } from '@/lib/categories';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import UserMenu from './UserMenu';

export default function Header() {
  const [session, setSession] = useState<any>(null);
  const [localSearch, setLocalSearch] = useState('');
  const { searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } = useAppStore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const isHidden = pathname?.startsWith('/place/');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  // 외부에서 searchQuery가 변경되면 (카테고리 클릭 등) 로컬 인풋 동기화
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleCategoryClick = (id: string) => {
    setSelectedCategory(id);
    router.push('/');
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-[110] pointer-events-none ${isHidden ? 'hidden' : ''}`}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-3 sm:pt-4 space-y-2 pointer-events-auto">
        
        {/* Row 1: Logo + Search + UserMenu */}
        <div className="flex items-center gap-2">
          
          {/* Home Button (Left) */}
          <Link href="/" className="shrink-0 flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-white/20 dark:border-slate-800 shadow-xl group hover:scale-[1.02] active:scale-95 transition-all">
            <Image
              src="/onfons_logo.svg"
              alt="OnFons"
              width={72}
              height={20}
              className="h-5 w-auto"
              priority
            />
          </Link>

          {/* Search Bar (Left area, beside logo) */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-[340px] relative">
            <div className="relative">
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="유튜버명, 장소명, 메뉴 검색..."
                className="w-full pl-6 pr-7 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/50 transition-all shadow-xl"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>

          {/* User Menu (Right) */}
          <div className="shrink-0">
            <UserMenu />
          </div>
        </div>

        {/* Row 2: Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => handleCategoryClick('all')}
            className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[13px] font-bold tracking-tight transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                : 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            전체
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCategoryClick(c.id)}
              style={{
                backgroundColor: selectedCategory === c.id ? c.color : undefined,
                borderColor: selectedCategory === c.id ? c.color : undefined,
                color: selectedCategory === c.id ? '#fff' : c.color,
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[13px] font-bold tracking-tight transition-all ${
                selectedCategory === c.id
                  ? 'shadow-lg'
                  : 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 hover:brightness-90'
              }`}
            >
              {getCategoryIcon(c.id)} {c.label}
            </button>
          ))}
        </div>

      </div>
    </header>
  );
}