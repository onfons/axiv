'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useAppStore } from '@/lib/store';
import { motion } from 'framer-motion';
import { PlusCircle, LogOut, Search, Map as MapIcon, User } from 'lucide-react';
import Image from 'next/image';

import UserMenu from './UserMenu';

export default function Header() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-[110] px-4 sm:px-6 py-3 sm:py-4 pointer-events-none">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between pointer-events-auto">
        
        {/* OnFons Logo Home Button — 가운데 정렬 (모바일) / 왼쪽 정렬 (데스크탑) */}
        <div className="flex-1 flex md:hidden justify-center">
          <Link href="/" className="flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/20 dark:border-slate-800 shadow-xl group hover:scale-[1.02] active:scale-95 transition-all">
            <Image
              src="/onfons_logo.svg"
              alt="OnFons"
              width={108}
              height={28}
              className="h-6 sm:h-7 w-auto"
              priority
            />
          </Link>
        </div>
        {/* 데스크탑 로고 (왼쪽) */}
        <Link href="/" className="hidden md:flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/20 dark:border-slate-800 shadow-xl group hover:scale-[1.02] active:scale-95 transition-all">
          <Image
            src="/onfons_logo.svg"
            alt="OnFons"
            width={108}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>

        {/* Global User Menu */}
        <div className="flex-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

