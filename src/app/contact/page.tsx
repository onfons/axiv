'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageCircle, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';

export default function ContactPage() {
  const router = useRouter();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    type: 'inquiry',
    subject: '',
    content: '',
    contact: ''
  });

  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = () => {
    const adminEmail = 'onfons.it@gmail.com';
    navigator.clipboard.writeText(adminEmail);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSendMail = (platform: 'default' | 'gmail') => {
    const adminEmail = 'onfons.it@gmail.com';
    const subject = encodeURIComponent(`[${formData.type.toUpperCase()}] ${formData.subject}`);
    const body = encodeURIComponent(`문의 유형: ${formData.type}\n연락처: ${formData.contact}\n\n내용:\n${formData.content}`);
    
    if (platform === 'gmail') {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${adminEmail}&su=${subject}&body=${body}`, '_blank');
    } else {
      window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    }
    setIsSubmitted(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMail('gmail'); // 구글 메일함으로 기본 이동
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />
      
      <main className="max-w-2xl mx-auto px-6 pt-32 pb-20">
        <motion.button 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-emerald-500 transition-colors mb-8 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-black">뒤로가기</span>
        </motion.button>

        {!isSubmitted ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-8 md:p-12">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">문의 및 제보</h1>
                  <p className="text-slate-400 font-bold text-sm">잘못된 정보 정정이나 새로운 장소 제보를 환영합니다.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">문의 유형</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'inquiry'})}
                      className={`py-4 rounded-2xl text-xs font-black transition-all border ${formData.type === 'inquiry' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                    >
                      기타 일반 문의
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'report'})}
                      className={`py-4 rounded-2xl text-xs font-black transition-all border ${formData.type === 'report' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                    >
                      정보 정정 / 제보
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">제목</label>
                  <input 
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    placeholder="문의 내용을 요약해 주세요"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">내용</label>
                  <textarea 
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="상세 내용을 입력해 주세요 (가게 이름, 수정이 필요한 내용 등)"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[200px] resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">연락처 (선택)</label>
                  <input 
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                    placeholder="이메일이나 연락처를 남겨주시면 답변을 드립니다"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-3xl text-sm font-black flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-slate-900/20"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Gmail" />
                    문의 메일 보내기 (Gmail 웹)
                  </button>
                  

                  <button 
                    type="button"
                    onClick={copyToClipboard}
                    className="w-full py-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl text-[11px] font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all border border-emerald-100 dark:border-emerald-800"
                  >
                    {copySuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {copySuccess ? '이메일 주소 복사됨!' : '이메일 주소만 복사하기 (onfons.it@gmail.com)'}
                  </button>
                </div>
              </form>

              <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/50 text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed text-center">
                메일 앱이 반응하지 않을 경우 <b>'Gmail(웹)'</b> 버튼을 누르거나 <br/>
                <b>'복사하기'</b> 버튼을 눌러 직접 <b>onfons.it@gmail.com</b>으로 보내주세요.
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[40px] p-12 text-center shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">메일 전송 준비 완료</h2>
            <p className="text-slate-400 font-bold mb-8">메일 앱에서 '보내기'를 눌러 문의를 완료해 주세요.</p>
            <button 
              onClick={() => router.push('/')}
              className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-black hover:scale-105 transition-all"
            >
              메인으로 돌아가기
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
