'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { 
  Play, 
  Search, 
  CheckCircle2, 
  Loader2, 
  MapPin, 
  Sparkles,
  ChevronRight,
  Plus,
  Info,
  Clock,
  Phone,
  ShoppingBag
} from 'lucide-react';
import Image from 'next/image';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        alert('로그인이 필요한 서비스입니다.');
        router.push('/');
      } else {
        setIsAuthChecking(false);
      }
    });
  }, [router]);
  const [result, setResult] = useState<any>(null);
  const [successItems, setSuccessItems] = useState<string[]>([]);
  const [coupangProducts, setCoupangProducts] = useState<any[]>([]);

  const fetchCoupangByPlace = (places: any[]) => {
    if (!places?.length) return;
    const firstPlace = places[0];
    let keyword = firstPlace.place_name || '';
    if (!keyword || keyword.includes('미상') || keyword.length < 2) {
      keyword = firstPlace.category || '맛집추천';
    }
    fetch(`/api/coupang?keyword=${encodeURIComponent(keyword)}`)
      .then(r => r.json())
      .then(d => { if (d.products?.length) setCoupangProducts(d.products); })
      .catch(() => {});
  };

  const { showToast } = useAppStore();

  // 초기 로딩 시 골드박스 상품 조회
  React.useEffect(() => {
    fetch('/api/coupang?goldbox=true')
      .then(r => r.json())
      .then(data => { if (data.products?.length) setCoupangProducts(data.products); })
      .catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50초 타임아웃
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Raw response:', responseText);
        // HTML 응답 (서버 에러 페이지) 처리
        if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
          throw new Error(`서버에서 HTML 응답 반환 (${response.status}). FastAPI 서버가 중단되었을 수 있습니다.`);
        }
        throw new Error(`서버 응답 파싱 실패 (상태 코드: ${response.status}): ${responseText.substring(0, 100)}`);
      }
      
      if (!response.ok || data.error) throw new Error(data.error || '알 수 없는 서버 에러');
      setResult(data);
      fetchCoupangByPlace(data.places);
      showToast('분석이 완료되었습니다.', 'success');
    } catch (error: any) {
      console.error('Analysis failed:', error);
      if (error.name === 'AbortError') {
        showToast('분석 시간이 초과되었습니다. (50초) 영상이 너무 긴 경우 다시 시도해주세요.', 'error');
      } else {
        showToast(`분석 실패: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceChange = (index: number, field: string, value: any) => {
    if (!result) return;
    const newPlaces = [...result.places];
    newPlaces[index] = { ...newPlaces[index], [field]: value };
    setResult({ ...result, places: newPlaces });
  };

  const handleSave = async (place: any, index: number) => {
    if (successItems.includes(place.place_name)) return;
    
    setLoading(true);
    try {
      // 1. Content Upsert (via service API - bypass RLS)
      const contentRes = await fetch('/api/service-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_content',
          data: {
            video_id: result.video_id,
            title: result.metadata.title,
            url: url,
            creator_name: result.metadata.creator_name,
            creator_channel_url: `https://www.youtube.com/channel/${result.video_id}`,
            thumbnail_url: result.metadata.thumbnail_url
          }
        })
      });
      const contentJson = await contentRes.json();
      if (contentJson.error) throw new Error(contentJson.error);
      const contentData = contentJson.data;

      // 2. Place Dedup & Save (위도/경도 포함!)
      let placeId: string;
      const { data: existingPlace } = await supabase
        .from('places')
        .select('id, lat, lng')
        .eq('place_name', place.place_name)
        .eq('address', place.address || place.address_hint)
        .maybeSingle();

      if (existingPlace) {
        placeId = existingPlace.id;
        // 기존 장소의 위도/경도가 없으면 업데이트
        if (!existingPlace.lat && place.lat) {
          await fetch('/api/service-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upsert_content_place',
              data: {
                content_id: contentData.id,
                place_id: placeId,
                timeline_seconds: place.timeline_seconds,
                creator_review: place.creator_review,
                summary: `${place.place_description || '정보 없음'}\n\n${place.summary || ''}`
              }
            })
          });
        }
      } else {
        // Place Insert (via service API) - lat/lng 포함!!
        const placeRes = await fetch('/api/service-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert_place',
            data: {
              place_name: place.place_name,
              address: place.address || place.address_hint,
              category: place.category,
              lat: place.lat || 0,
              lng: place.lng || 0,
              phone: place.phone,
              business_hours: place.business_hours || null,
              representative_menu: place.menu_with_prices || null,
              place_description: place.place_description || null,
              waiting_tip: place.waiting_tip || null,
              parking_info: place.parking_info || null
            }
          })
        });
        const placeJson = await placeRes.json();
        if (placeJson.error) throw new Error(placeJson.error);
        placeId = placeJson.data.id;
      }

      // 3. Link 저장 (가게 상세 설명 + AI 요약만)
      const linkRes = await fetch('/api/service-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_content_place',
          data: {
            content_id: contentData.id,
            place_id: placeId,
            timeline_seconds: place.timeline_seconds,
            creator_review: place.creator_review,
            summary: `${place.place_description || '정보 없음'}\n\n${place.summary || ''}`
          }
        })
      });
      const linkJson = await linkRes.json();
      if (linkJson.error) throw new Error(linkJson.error);

      setSuccessItems([...successItems, place.place_name]);
      showToast(`${place.place_name} 등록 성공!`, 'success');
    } catch (error: any) {
      console.error('Save error detailed:', error);
      showToast(`저장 실패: ${error.message || JSON.stringify(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400">인증 정보를 확인하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 pt-20 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto px-4 pb-40">

        {/* Header Section */}
        <div className="mb-8 pt-4">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <Sparkles className="w-4 h-4 fill-emerald-500/20" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Automated Content Curation</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
            영상 속 장소 <span className="text-emerald-500 font-black">발굴</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold max-w-xl leading-relaxed">
            AI가 영상 속 모든 장소를 찾아 상세 정보를 자동 정리합니다.
          </p>
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 shadow-xl border border-gray-100 dark:border-slate-800 mb-10">
          <div className="flex flex-col gap-3">
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Play className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="유튜브 URL 주소를 입력하세요"
                className="w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 focus:bg-white dark:focus:bg-slate-900 outline-none rounded-2xl transition-all text-sm font-bold"
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !url}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>AI 분석 시작</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results List */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
                <div>
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Found {result.places?.length} Places</h2>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-[10px]">📺</span>
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">Creator: {result.metadata.creator_name}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {result.places?.map((place: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden relative group"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{place.category}</span>
                            <span className="text-[9px] font-bold text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase">Verified</span>
                          </div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight group-hover:text-emerald-500 transition-colors">
                            {place.place_name}
                          </h3>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          <Clock className="w-3 h-3" />
                          {Math.floor(place.timeline_seconds / 60)}:{(place.timeline_seconds % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      {/* Final Verified Info Grid (Editable) - 간소화 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y border-slate-50 dark:border-slate-800">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-emerald-500" />
                            Address
                          </label>
                          <input 
                            value={place.address || ''}
                            onChange={(e) => handlePlaceChange(index, 'address', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                            placeholder="주소를 입력하세요"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            Phone
                          </label>
                          <input 
                            value={place.phone || ''}
                            onChange={(e) => handlePlaceChange(index, 'phone', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                            placeholder="전화번호를 입력하세요"
                          />
                        </div>
                      </div>

                      {/* 가게 상세 설명 + AI 요약만 표시 */}
                      <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                          <div className="flex items-center gap-2 mb-3">
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">상세 설명</span>
                          </div>
                          <textarea 
                            value={place.place_description || ''}
                            onChange={(e) => handlePlaceChange(index, 'place_description', e.target.value)}
                            className="w-full bg-white/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[80px] resize-none leading-relaxed"
                            placeholder="장소 설명을 입력하세요"
                          />
                        </div>

                        <div className="bg-emerald-50/30 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">AI 요약</span>
                          </div>
                          <textarea 
                            value={place.summary || ''}
                            onChange={(e) => handlePlaceChange(index, 'summary', e.target.value)}
                            className="w-full bg-white/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[100px] resize-none leading-relaxed"
                            placeholder="AI가 분석한 요약 정보"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleSave(place, index)}
                        disabled={successItems.includes(place.place_name) || place.place_name.includes('미상') || !place.place_name}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                          successItems.includes(place.place_name)
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/10'
                        }`}
                      >
                        {successItems.includes(place.place_name) ? (
                          <><CheckCircle2 className="w-4 h-4" /><span>등록 완료</span></>
                        ) : place.place_name.includes('미상') || !place.place_name ? (
                          <span>상호명 확인 필요</span>
                        ) : (
                          <><Plus className="w-4 h-4" /><span>등록</span></>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Coupang Products (after analysis) */}
          {result && coupangProducts.length > 0 && (
            <div className="space-y-4 pt-2 pb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  🛒 관련 상품
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">파트너스 활동의 일환으로 수수료를 제공받을 수 있습니다.</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {coupangProducts.map((product, idx) => (
                  <a
                    key={idx}
                    href={product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-[180px] snap-center bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                  >
                    <div className="relative aspect-square bg-slate-50 dark:bg-slate-800">
                      <Image 
                        src={product.productImage} 
                        alt={product.productName}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">{product.productName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {product.productPrice?.toLocaleString()}원
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          구매
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Analysis Loading Overlay */}
      <AnimatePresence>
        {loading && !result && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white"
          >
            <div className="max-w-md w-full space-y-12">
              {/* Top: AI Pumping Indicator */}
              <div className="text-center space-y-4">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-20 h-20 bg-emerald-500 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.5)]"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight">AI 분석 중...</h2>
                  <p className="text-slate-400 text-sm font-medium">영상을 분석하여 상세 정보를 추출하고 있습니다.</p>
                </div>
                <div className="flex justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                    />
                  ))}
                </div>
              </div>

              {/* Middle: Coupang Partners Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Coupang Recommended</span>
                  <span className="text-[10px] font-bold text-slate-500">파트너스 활동의 일환으로 수수료를 제공받을 수 있습니다.</span>
                </div>
                
                <div className="relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 p-4">
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                    {coupangProducts.length > 0 ? (
                      coupangProducts.map((product, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ x: 50, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex-shrink-0 w-[240px] snap-center bg-white/10 rounded-2xl overflow-hidden border border-white/5 group"
                        >
                          <div className="relative aspect-square">
                            <Image 
                              src={product.productImage} 
                              alt={product.productName}
                              fill
                              className="object-cover transition-transform group-hover:scale-110"
                            />
                            <div className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-lg">
                              SALE
                            </div>
                          </div>
                          <div className="p-3 space-y-2">
                            <p className="text-[11px] font-bold text-slate-200 line-clamp-1">{product.productName}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-400 font-black text-sm">{product.productPrice?.toLocaleString()}원</span>
                              <a 
                                href={product.productUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-white text-slate-900 text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-emerald-400 hover:text-white transition-colors"
                              >
                                구매하기
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-xs font-bold">특가 상품 불러오는 중...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom: Progress Message */}
              <motion.p 
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-center text-[10px] text-slate-500 font-medium"
              >
                영상이 길 경우 최대 50초 정도 소요될 수 있습니다.
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}