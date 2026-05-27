import React from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

interface ExternalMapLinksProps {
  googleUrl?: string | null;
  naverUrl?: string | null;
}

export default function ExternalMapLinks({ googleUrl, naverUrl }: ExternalMapLinksProps) {
  if (!googleUrl && !naverUrl) return null;

  return (
    <div className="mt-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-emerald-500" />
        지도에서 보기
      </h3>
      <div className="flex gap-2 flex-wrap">
        {googleUrl && (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4285F4" />
              <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
            <span className="text-gray-700 dark:text-gray-200">Google 지도</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
        )}
        {naverUrl && (
          <a
            href={naverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="4" fill="#03C75A" />
              <path d="M7 7h3.5l4.5 6.5V7H14v10h-3.5L6 10.5V17h3V7z" fill="white" />
            </svg>
            <span className="text-gray-700 dark:text-gray-200">네이버 지도</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
        )}
      </div>
    </div>
  );
}