import React from 'react';
import { Search, Menu } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function SearchBar() {
  const { searchQuery, setSearchQuery } = useAppStore();

  return (
    <div className="w-full max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-2">
      <div className="relative flex-1 max-w-md mx-auto w-full">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="유튜버명, 장소명, 메뉴 검색..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white"
        />
      </div>
      <button className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors lg:hidden">
        <Menu className="w-5 h-5" />
      </button>
    </div>
  );
}
