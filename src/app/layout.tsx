/usr/bin/bash: warning: setlocale: LC_ALL: cannot change locale (ko_KR.UTF-8): No such file or directory
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { PropsWithChildren } from 'react';
import Header from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport = {
  themeColor: '#1DB97C',
};

export const metadata: Metadata = {
  title: 'AXIV | AI 기반 장소 큐레이션',
  description: '유튜브 크리에이터가 소개한 장소를 지도에서 탐색하세요.',
};

import GlobalOverlay from '@/components/layout/GlobalOverlay';

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ko" className={`${inter.variable} h-full`}> 
      <head>
        <meta name="agd-partner-manual-verification" />
        <meta name="google-adsense-account" content="ca-pub-9783521908231028" />
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
        {/* Google AdSense */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9783521908231028" crossOrigin="anonymous"></script>
      </head>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 h-full flex flex-col font-sans">
        <Header />
        <main className="flex-1 overflow-auto relative">
          {children}
        </main>
        <GlobalOverlay />
      </body>
    </html>
  );
}
