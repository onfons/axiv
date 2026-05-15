'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-10 p-4 flex items-center gap-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800">
        <button onClick={() => router.back()} className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-md border border-slate-100 dark:border-slate-800">
          <ChevronLeft className="w-5 h-5 text-slate-900 dark:text-white" />
        </button>
        <h1 className="text-lg font-black text-slate-900 dark:text-white">이용약관</h1>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-10 text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-6">
        <h2 className="text-base font-black text-slate-900 dark:text-white">제1조 (목적)</h2>
        <p>본 약관은 AXIV(이하 &quot;회사&quot;)가 제공하는 장소 추천 및 큐레이션 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">제2조 (용어의 정의)</h2>
        <p>① &quot;회원&quot;이란 본 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자를 말합니다.<br />
        ② &quot;콘텐츠&quot;란 회원이 서비스 내에서 등록, 게시, 공유하는 모든 정보 및 자료를 말합니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">제3조 (서비스의 제공 및 변경)</h2>
        <p>① 회사는 유튜브 크리에이터 기반 장소 추천 지도 서비스를 제공합니다.<br />
        ② 회사는 필요한 경우 서비스의 내용을 변경할 수 있으며, 변경사항은 서비스 내 공지사항을 통해 사전 통지합니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">제4조 (회원의 의무)</h2>
        <p>① 회원은 서비스 이용 시 관련 법령 및 본 약관을 준수하여야 합니다.<br />
        ② 회원은 타인의 권리나 명예를 침해하는 내용을 게시하여서는 안 됩니다.<br />
        ③ 회원은 서비스를 영리 목적으로 무단 사용할 수 없습니다.</p>

        <h2 className="text-base font-black text-slate-900 dark:text-white">제5조 (저작권 및 지식재산권)</h2>
        <p>① 서비스에 게시된 콘텐츠의 저작권은 해당 콘텐츠의 창작자에게 있습니다.<br />
        ② 회사는 서비스 운영 목적으로 회원이 게시한 콘텐츠를 활용할 수 있습니다.</p>

<h2 className="text-base font-black text-slate-900 dark:text-white">제6조 (면책조항)</h2>
        <p>① 회사는 서비스에 포함된 장소 정보, 리뷰, 평가 등의 정확성이나 신뢰도를 보증하지 않습니다.<br />
        ② 회사는 천재지변 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임을 면합니다.</p>

        <p className="text-[10px] text-slate-400">
          <Link href="/privacy" className="underline underline-offset-2 decoration-1 hover:text-emerald-500">개인정보처리방침</Link>
        </p>
        <p className="text-[10px] text-slate-400 pt-6">공포일: 2026년 1월 1일</p>
      </div>
    </div>
  );
}