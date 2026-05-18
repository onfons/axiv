'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { CheckCircle2, AlertCircle, Info, X, Edit3 } from 'lucide-react';

export default function GlobalOverlay() {
  const { toast, hideToast, confirm, hideConfirm, inputModal, hideInputModal } = useAppStore();

  return (
    <>
      {/* Toast Notification */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4 pointer-events-none">
        <AnimatePresence>
          {toast.visible && (
            <motion.div
              initial={{ y: -100, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              className="pointer-events-auto"
            >
              <div className={`
                flex items-center gap-3 p-4 rounded-3xl shadow-2xl backdrop-blur-xl border
                ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 
                  toast.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' : 
                  'bg-slate-900/90 border-slate-700 text-white'}
              `}>
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
                {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
                
                <p className="text-sm font-black flex-1">{toast.message}</p>
                
                <button onClick={hideToast} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirm.visible && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={hideConfirm}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{confirm.title}</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{confirm.message}</p>
                
                <div className="flex gap-3 pt-6">
                  <button
                    onClick={hideConfirm}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-sm font-black hover:bg-slate-200 transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      if (confirm.onConfirm) confirm.onConfirm();
                      hideConfirm();
                    }}
                    className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-black hover:scale-105 transition-all shadow-xl"
                  >
                    확인
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Input Modal */}
      <AnimatePresence>
        {inputModal.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={hideInputModal} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">{inputModal.title}</h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{inputModal.message}</p>
                </div>
              </div>
              <InputForm />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function InputForm() {
  const { inputModal, hideInputModal, showToast } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputModal.visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inputModal.visible]);

  const handleConfirm = () => {
    const value = inputRef.current?.value?.trim() || '';
    if (!value || value.length < 2) {
      showToast('2글자 이상 입력해주세요.', 'error');
      return;
    }
    inputModal.onConfirm?.(value);
    hideInputModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') hideInputModal();
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="text"
        defaultValue={inputModal.defaultValue}
        placeholder={inputModal.placeholder || '입력해주세요'}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
      />
      <div className="flex gap-2">
        <button
          onClick={hideInputModal}
          className="flex-1 py-3 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-3 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
        >
          확인
        </button>
      </div>
    </div>
  );
}
