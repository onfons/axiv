'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import {
  Play,
  CheckCircle2,
  Loader2,
  MapPin,
  Sparkles,
  ChevronRight,
  Plus,
  Info,
  Clock,
  Phone,
  ShoppingBag,
  ExternalLink,
  Search
} from 'lucide-react';
import Image from 'next/image';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userDisplayName, setUserDisplayName] = useState('');

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const { showConfirm } = useAppStore.getState();
        showConfirm('로그인 필요', '로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.', () => {
          router.push('/login');
        });
      } else {
        setUserDisplayName(session.user.email?.split('@')[0] || session.user.email || '사용자');
        setIsAuthChecking(false);
      }
    });
  }, [router]);
  const [result, setResult] = useState<any>(null);
  const [successItems, setSuccessItems] = useState<string[]>([]);
  const [coupangProducts, setCoupangProducts] = useState<any[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

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

  const { showToast, showConfirm, showInputModal } = useAppStore();

  // 상호명 명확성 판단 함수
  const isPlaceNameClear = (name: string): boolean => {
    const cleaned = (name || '').trim();
    if (cleaned.length < 2) return false;
    // '미상', '정보없음', '알수없음' 등 모호한 패턴
    const vaguePatterns = ['미상', '정보 없음', '정보없음', '알 수 없음', '알수없음', '모름', 'unknown', '???', '???'];
    if (vaguePatterns.some(p => cleaned.includes(p))) return false;
    // 일반적인 상호명 패턴 (특수문자만 있거나 너무 짧으면 모호)
    if (/^[^가-힣a-zA-Z0-9]+$/.test(cleaned)) return false;
    return true;
  };

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
const timeoutId = setTimeout(() => controller.abort(), 180000); // 3분 타임아웃
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
          throw new Error(`서버 응답 오류 (${response.status}). 잠시 후 다시 시도해 주세요.`);
        }
        throw new Error(`서버 응답 처리 중 오류가 발생했습니다. (${response.status}) 다시 시도해 주세요.`);
      }
      
      if (!response.ok || data.error) throw new Error(data.error || '알 수 없는 서버 에러');

      // 추출된 장소들의 상호명 검증
      const places = data.places || [];
      const validPlaces = places.filter((p: any) => {
        const name = (p.place_name || '').trim();
        return name.length >= 2 && !['미상', '정보 없음', '정보없음', '알 수 없음', '알수없음', '모름'].includes(name);
      });

      if (validPlaces.length === 0) {
        showConfirm(
          '상호명을 찾을 수 없습니다',
          '영상에서 정확한 상호명을 분석하지 못했습니다.\n상호명이 더 명확히 나오는 영상으로 다시 시도해주세요.\n\n자세한 장소명을 언급하는 부분이 포함된 영상을 권장합니다.',
          () => {}
        );
        setResult(null);
        return;
      }

      setResult(data);
      fetchCoupangByPlace(data.places);
      showToast('분석이 완료되었습니다.', 'success');
    } catch (error: any) {
      console.error('Analysis failed:', error);
      if (error.name === 'AbortError') {
        showToast('분석 시간이 초과되었습니다. (3분) 영상이 너무 긴 경우 다시 시도해주세요.', 'error');
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

  const [reanalyzingIndex, setReanalyzingIndex] = useState<number | null>(null);

  const handleReanalyze = (index: number) => {
    const place = result?.places?.[index];
    const currentName = place?.place_name || '';
    showInputModal(
      '상호명 재검색',
      '정확한 상호명을 입력하면 해당 상점의 정보를 다시 검색합니다.',
      async (placeName: string) => {
        setReanalyzingIndex(index);
        try {
          const res = await fetch('/api/reanalyze-place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place_name: placeName }),
          });
          const data = await res.json();
          if (data.places?.length > 0) {
            const updated = data.places[0];
            const newPlaces = [...result.places];
            newPlaces[index] = {
              ...newPlaces[index],
              place_name: updated.place_name || placeName,
              address: updated.address || newPlaces[index].address,
              phone: updated.phone || newPlaces[index].phone,
              category: updated.category || newPlaces[index].category,
              business_hours: updated.business_hours || newPlaces[index].business_hours,
              break_time: updated.break_time || newPlaces[index].break_time,
              menu_with_prices: updated.menu_with_prices || newPlaces[index].menu_with_prices,
              place_description: updated.place_description || newPlaces[index].place_description,
              waiting_tip: updated.waiting_tip || newPlaces[index].waiting_tip,
              parking_info: updated.parking_info || newPlaces[index].parking_info,
              creator_review: updated.creator_review || newPlaces[index].creator_review,
              summary: updated.summary || newPlaces[index].summary,
              lat: updated.lat || newPlaces[index].lat,
              lng: updated.lng || newPlaces[index].lng,
            };
            setResult({ ...result, places: newPlaces });
            showToast(`"${updated.place_name || placeName}" 정보를 업데이트했습니다.`, 'success');
          } else {
            showToast('재검색 결과가 없습니다. 다른 상호명으로 시도해보세요.', 'error');
          }
        } catch (e: any) {
          showToast(`재검색 실패: ${e.message}`, 'error');
        } finally {
          setReanalyzingIndex(null);
        }
      },
      currentName
    );
  };

  const handleSave = async (place: any, index: number) => {
    if (successItems.includes(place.place_name)) return;
    if (savingIndex === index) return; // 중복 클릭 방지
    setSavingIndex(index);

    // place_name 검증 (2자 미만이면 저장 차단)
    const placeName = (place.place_name || '').trim();
    if (placeName.length < 2) {
      showToast('상호명이 너무 짧습니다. 정확한 상호명을 입력해주세요.', 'error');
      setSavingIndex(null);
      return;
    }

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

      // 2. Place Dedup & Save (위도/경도 + verified 포함!)
      let placeId: string;
      let verifiedStatus = isPlaceNameClear(placeName); // 상호명 명확성 기본 판단

      const { data: existingPlace } = await supabase
        .from('places')
        .select('id, lat, lng, verified, address')
        .eq('place_name', place.place_name)
        .eq('address', place.address || place.address_hint)
        .maybeSingle();

      if (existingPlace) {
        placeId = existingPlace.id;
        // 기존 장소 정보 업데이트 (웨이팅/주차 등 최신 정보 반영)
        const cleanWaitingExisting = (place.waiting_tip && place.waiting_tip !== '없음' && place.waiting_tip !== '정보 없음' && place.waiting_tip.trim().length > 2) ? place.waiting_tip : null;
        const cleanParkingExisting = (place.parking_info && place.parking_info !== '없음' && place.parking_info !== '정보 없음' && place.parking_info.trim().length > 2) ? place.parking_info : null;
        if (cleanWaitingExisting || cleanParkingExisting || (place.address && !existingPlace.lat)) {
          try {
            let updateLat = existingPlace.lat;
            let updateLng = existingPlace.lng;
            let updateAddress = existingPlace.address;
            if (!updateLat || updateLat === 37.5665) {
              const addressToGeocode = place.address || place.address_hint;
              if (addressToGeocode) {
                try {
                  const geoRes = await fetch('/api/vworld-geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: place.place_name, address: addressToGeocode })
                  });
                  const geoData = await geoRes.json();
                  if (geoData.lat && geoData.lng) {
                    updateLat = geoData.lat;
                    updateLng = geoData.lng;
                    if (geoData.fullAddress) updateAddress = geoData.fullAddress;
                  }
                } catch (e) {
                  console.warn('VWORLD geocoding failed:', e);
                }
              }
            }
            await supabase.from('places').update({
              waiting_tip: cleanWaitingExisting,
              parking_info: cleanParkingExisting,
              lat: updateLat,
              lng: updateLng,
              address: updateAddress,
              verified: existingPlace.verified || verifiedStatus // 한 번이라도 verified=true면 유지
            }).eq('id', placeId);
          } catch (e) {
            console.warn('Update existing place failed:', e);
          }
        }
      } else {
        // 상호명 → VWorld 검색 → 주소+좌표 획득
        let geocodedLat = place.lat || 0;
        let geocodedLng = place.lng || 0;
        let fullAddress = '';
        let geocodeSuccess = false;
        try {
          const geoRes = await fetch('/api/vworld-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: place.place_name, address: place.address || place.address_hint })
          });
          const geoData = await geoRes.json();
          if (geoData.lat && geoData.lng) {
            geocodedLat = geoData.lat;
            geocodedLng = geoData.lng;
            geocodeSuccess = true;
            if (geoData.fullAddress) fullAddress = geoData.fullAddress;
          }
        } catch (e) {
          console.warn('VWORLD search failed:', e);
        }

        // VWorld 검증 실패 시 address=null + verified=false
        const finalVerified = geocodeSuccess && verifiedStatus;
        const finalAddress = geocodeSuccess ? fullAddress : null;

        // "없음" 값 정리
        const cleanWaiting = (place.waiting_tip && place.waiting_tip !== '없음' && place.waiting_tip !== '정보 없음' && place.waiting_tip.trim().length > 2) ? place.waiting_tip : null;
        const cleanParking = (place.parking_info && place.parking_info !== '없음' && place.parking_info !== '정보 없음' && place.parking_info.trim().length > 2) ? place.parking_info : null;

        // 장소 저장 (VWorld에서 받은 상세 주소 + 좌표 사용)
        const placeRes = await fetch('/api/service-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert_place_vworld',
            data: {
              place_name: place.place_name,
              address: finalAddress,
              category: place.category,
              lat: geocodedLat,
              lng: geocodedLng,
              phone: place.phone,
              business_hours: place.business_hours || null,
              break_time: place.break_time || null,
              representative_menu: place.menu_with_prices || null,
              place_description: place.place_description || null,
              waiting_tip: cleanWaiting,
              parking_info: cleanParking,
              verified: finalVerified
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
            review_url: place.review_url || null,
            summary: place.summary || null
          }
        })
      });
      const linkJson = await linkRes.json();
      if (linkJson.error) throw new Error(linkJson.error);

      setSuccessItems([...successItems, place.place_name]);
      const isAuto = isPlaceNameClear(place.place_name);
      showToast(isAuto ? `${place.place_name} 자동 등록 완료!` : `${place.place_name} 임시 등록 완료 (관리자 확인 필요)`, isAuto ? 'success' : 'success');
    } catch (error: any) {
      console.error('Save error detailed:', error);
      showToast(`저장 실패: ${error.message || '알 수 없는 오류입니다. 다시 시도해 주세요.'}`, 'error');
    } finally {
      setLoading(false);
      setSavingIndex(null);
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
                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">등록자: {userDisplayName}</span>
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
                            {isPlaceNameClear(place.place_name) ? (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase">Auto</span>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:amber-900/30 px-1.5 py-0.5 rounded uppercase">미분류</span>
                            )}
                            <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <span>📺</span>
                              <span>{userDisplayName}</span>
                            </span>
                          </div>
                          <input
                            value={place.place_name || ''}
                            onChange={(e) => handlePlaceChange(index, 'place_name', e.target.value)}
                            className="w-full mt-1 text-xl font-black text-slate-900 dark:text-white bg-transparent border-0 border-b-2 border-transparent focus:border-emerald-500/50 focus:outline-none transition-colors hover:border-slate-200 dark:hover:border-slate-700"
                            placeholder="상호명을 입력하세요"
                          />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          <Clock className="w-3 h-3" />
                          {Math.floor(place.timeline_seconds / 60)}:{(place.timeline_seconds % 60).toString().padStart(2, '0')}
                        </div>
                      </div>

                      {/* Final Verified Info Grid (Editable) */}
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

                      {/* Menu & Prices Section */}
                      <div className="bg-emerald-50/30 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/30">
                        <div className="flex items-center gap-2 mb-3">
                          <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">메뉴 & 가격</span>
                        </div>
                        <textarea 
                          value={place.menu_with_prices || ''}
                          onChange={(e) => handlePlaceChange(index, 'menu_with_prices', e.target.value)}
                          className="w-full bg-white/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[80px] resize-none leading-relaxed"
                          placeholder="메뉴명 가격원 (예: 김치찌개 8,000원)"
                        />
                      </div>

                      {/* Business Hours & Break Time */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">운영시간 & 브레이크타임</span>
                        </div>
                        <div className="space-y-3">
                          <input
                            value={place.business_hours || ''}
                            onChange={(e) => handlePlaceChange(index, 'business_hours', e.target.value)}
                            className="w-full bg-white/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                            placeholder="영업시간 (예: 매일 11:00-22:00)"
                          />
                          <input
                            value={place.break_time || ''}
                            onChange={(e) => handlePlaceChange(index, 'break_time', e.target.value)}
                            className="w-full bg-white/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                            placeholder="브레이크타임 (예: 15:00-17:00)"
                          />
                        </div>
                      </div>

                      {/* Creator Review with optional link */}
                      <div className="bg-amber-50/30 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100/50 dark:border-amber-800/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">리뷰 정보</span>
                        </div>
                        <textarea 
                          value={place.creator_review || ''}
                          onChange={(e) => handlePlaceChange(index, 'creator_review', e.target.value)}
                          className="w-full bg-white/50 dark:bg-slate-900/50 border-none rounded-xl px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 transition-all outline-none min-h-[60px] resize-none leading-relaxed italic"
                          placeholder="크리에이터 리뷰 내용"
                        />
                        {place.review_url && (
                          <a 
                            href={place.review_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-amber-600 hover:text-amber-700 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            리뷰 원본 보기
                          </a>
                        )}
                      </div>

                      {/* 가게 상세 설명 + AI 요약 */}
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
                        disabled={successItems.includes(place.place_name) || place.place_name.includes('미상') || !place.place_name || savingIndex === index}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                          successItems.includes(place.place_name)
                            ? 'bg-emerald-100 text-emerald-600'
                            : savingIndex === index
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/10'
                        }`}
                      >
                        {successItems.includes(place.place_name) ? (
                          <><CheckCircle2 className="w-4 h-4" /><span>등록 완료</span></>
                        ) : savingIndex === index ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /><span>저장 중...</span></>
                        ) : place.place_name.includes('미상') || !place.place_name ? (
                          <span>상호명 확인 필요</span>
                        ) : (
                          <><Plus className="w-4 h-4" /><span>등록</span></>
                        )}
                      </button>
                      <button
                        onClick={() => handleReanalyze(index)}
                        disabled={reanalyzingIndex === index}
                        className="w-full py-2.5 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 mt-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reanalyzingIndex === index ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /><span>재검색 중...</span></>
                        ) : (
                          <><Search className="w-3.5 h-3.5" /><span>상호명으로 재검색</span></>
                        )}
                      </button>
                      {!successItems.includes(place.place_name) && savingIndex !== index && isPlaceNameClear(place.place_name) && !place.place_name.includes('미상') && (
                        <div className="text-[9px] font-bold text-emerald-500 text-center mt-1">자동 저장 (verified)</div>
                      )}
                      {!successItems.includes(place.place_name) && savingIndex !== index && !isPlaceNameClear(place.place_name) && !place.place_name.includes('미상') && place.place_name && (
                        <div className="text-[9px] font-bold text-amber-500 text-center mt-1">관리자 확인 후 승인 필요</div>
                      )}
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

              {/* Bottom: Progress Message */}
              <motion.p 
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-center text-[10px] text-slate-500 font-medium"
              >
                영상이 길 경우 최대 3분 정도 소요될 수 있습니다.
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}