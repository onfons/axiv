'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, LogIn, LogOut, PlusCircle, User, MessageCircle, 
  ChevronRight
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchVal, setSearchVal] = useState('');
  const router = useRouter();
  const { setSearchQuery, selectedCategory, setSelectedCategory } = useAppStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { subscription.unsubscribe(); document.removeEventListener('mousedown', handleClickOutside); };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    setIsOpen(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchVal);
    router.push('/');
    setIsOpen(false);
  };

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id);
    router.push('/');
    setIsOpen(false);
  };

  const isAdmin = user?.email === 'onfons.it@gmail.com';

  const menuSections = [
    ...(user ? [
      { label: '내 활동', items: [
        ...(isAdmin ? [{ icon: PlusCircle, text: '장소 등록', action: () => { router.push('/register'); setIsOpen(false); } }] : []),
        { icon: User, text: '마이페이지', action: () => { router.push('/mypage'); setIsOpen(false); } },
      ]},
    ] : []),
    { label: '고객 지원', items: [
      { icon: MessageCircle, text: '제보 및 문의', action: () => { router.push('/contact'); setIsOpen(false); } },
    ]},
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:shadow-sm active:scale-95"
      >
        {isOpen ? (
          <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        ) : (
          <Menu className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-[280px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-hidden z-[120]"
          >
            {user && (
              <div className="px-4 pb-1">
                <div className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300">
                    {user.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {user.email?.split('@')[0] || '사용자'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Menu Items */}
            <div className="px-2 pb-2 space-y-0.5">
              {menuSections.map((section) => (
                <div key={section.label}>
                  {section.items.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors group text-left"
                    >
                      <item.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors flex-1">
                        {item.text}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Auth Footer */}
            <div className="border-t border-slate-100 dark:border-slate-800">
              <div className="p-2">
                {user ? (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors group text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">로그아웃</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { router.push('/login'); setIsOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>로그인</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}