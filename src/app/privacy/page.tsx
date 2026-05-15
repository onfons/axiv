'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-10 p-4 flex items-center gap-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-md border border-slate-100 dark:border-slate-800">
          <ChevronLeft className="w-5 h-5 text-slate-900 dark:text-white" />
        </button>
        <h1 className="text-lg font-black text-slate-900 dark:text-white">개인정보처리방침</h1>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-10 text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-6">
        <h2 className="text-base font-black text-slate-900 dark:text-white">1. 개인정보의 수집 및 이용 목적</h2>
        <p>회사는 서비스 제공을 위해 최소한의 개인정보를 수집하며, 구글 로그인 시 이메일 주소와 프로필 정보를 수집합니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">2. 수집하는 개인정보 항목</h2>
        <p>① 필수항목: 이메일 주소, 닉네임, 프로필 이미지<br />
        ② 자동수집항목: 서비스 이용 기록, 접속 로그, 쿠키</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">3. 개인정보의 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시 또는 개인정보 수집 목적 달성 후 지체 없이 파기합니다. 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">4. 개인정보의 제3자 제공</h2>
        <p>회사는 원칙적으로 회원의 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령에 따른 요구가 있거나 회원의 동의를 받은 경우에 한하여 제공합니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">5. 개인정보 처리 위탁</h2>
        <p>회사는 서비스 운영을 위해 Google LLC(구글 로그인), Supabase(데이터베이스) 등에 개인정보 처리를 위탁하고 있습니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">6. 이용자의 권리</h2>
        <p>회원은 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며, 회원 탈퇴를 요청할 수 있습니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">7. 문의처</h2>
        <p>개인정보 관련 문의는 onfons.it@gmail.com으로 연락해 주시기 바랍니다.</p>

        <p className="text-[10px] text-slate-400">
          <Link href="/terms" className="underline underline-offset-2 decoration-1 hover:text-emerald-500">이용약관</Link>
        </p>

        <p className="text-[10px] text-slate-400 pt-6">공포일: 2026년 1월 1일</p>
      </div>
    </div>
  );
}