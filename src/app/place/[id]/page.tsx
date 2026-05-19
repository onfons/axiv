'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, MapPin, ShoppingBag, Clock, Play, ChevronLeft, Heart, ExternalLink, UtensilsCrossed, ShoppingCart, Hotel, Tent } from 'lucide-react';
import { CATEGORIES, getCategoryLabel } from '@/lib/categories';
import { useAppStore } from '@/lib/store';

// ── Affiliate Section ──
const AFFILIATE_LINKS: Record<string, { href: string; label: string; icon: React.ElementType; subLabel: string }[]> = {
  food: [
    { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '이 지역 맛집 투어', icon: UtensilsCrossed, subLabel: '아고다 숙소 + 식사 패키지' },
    { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '주변 호텔 · 숙소', icon: Hotel, subLabel: '최대 70% 할인' },
  ],
  cafe: [
    { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '이 주변 숙소 예약', icon: Hotel, subLabel: '아고다 최저가 보장' },
    { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '인기 카페 · 디저트', icon: ShoppingCart, subLabel: '여행 상품 보기' },
  ],
  camping: [
    { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '캠핑 · 레저 상품', icon: Tent, subLabel: '글램핑, 캠핑장 예약' },
    { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '근처 숙소 찾기', icon: Hotel, subLabel: '캠핑장 · 펜션' },
  ],
  fishing: [
    { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '낚시 · 레포츠', icon: Tent, subLabel: '낚시 투어, 장비' },
    { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '주변 숙박', icon: Hotel, subLabel: '민박 · 펜션' },
  ],
  travel: [
    { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '여행 상품 보기', icon: ShoppingCart, subLabel: '호텔 · 투어 · 액티비티' },
    { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '아고다 숙소 예약', icon: Hotel, subLabel: '전 세계 숙소 최저가' },
  ],
  accommodation: [
    { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '아고다에서 예약', icon: Hotel, subLabel: '이 숙소 최저가 확인' },
    { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '비교 · 더보기', icon: ShoppingCart, subLabel: '다양한 숙소 한 번에' },
  ],
};

const DEFAULT_LINKS = [
  { href: 'https://lpweb.kr/click.php?m=hcombine2&a=A100704609&l=0000', label: '주변 여행 상품', icon: ShoppingCart, subLabel: '호텔 · 액티비티' },
  { href: 'https://linkmoa.kr/click.php?m=agoda&a=A100704609&l=0000', label: '숙소 예약', icon: Hotel, subLabel: '아고다 최저가' },
];

/** 카테고리별 쿠팡 검색 키워드 */
const COUPANG_KEYWORDS: Record<string, string> = {
  food: '맛집 키친 용품 주방',
  cafe: '커피 디저트 카페',
  camping: '캠핑 용품 텐트',
  fishing: '낚시 용품 레저',
  travel: '여행 캐리어 가방',
  accommodation: '호텔 숙박 여행',
  popup: '팝업 스토어 굿즈',
  exhibition: '전시회 미술 전시',
  activity: '액티비티 스포츠 레저',
  drive: '드라이브 차량 용품',
};

function CoupangProductCard({ product }: { product: any }) {
  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 hover:border-emerald-200 dark:hover:border-emerald-700/50 hover:shadow-md transition-all group shrink-0"
      style={{ minWidth: 0 }}
    >
      {/* 상품 이미지 */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
        {product.productImage ? (
          <img
            src={product.productImage}
            alt={product.productName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg">🛒</div>
        )}
      </div>
      {/* 상품 정보 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-snug group-hover:text-emerald-600 transition-colors">
          {product.productName}
        </p>
        {product.productPrice && (
          <p className="text-sm font-black text-rose-500 mt-1">
            {Number(product.productPrice).toLocaleString()}원
          </p>
        )}
        {product.isRocket && (
          <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded mt-1 inline-block">
            로켓배송
          </span>
        )}
      </div>
    </a>
  );
}

function AffiliateSection({ category, placeName }: { category: string; placeName?: string }) {
  const links = AFFILIATE_LINKS[category] || DEFAULT_LINKS;
  const [coupangProducts, setCoupangProducts] = useState<any[]>([]);
  const [coupangLoading, setCoupangLoading] = useState(true);

  useEffect(() => {
    const keyword = COUPANG_KEYWORDS[category] || '맛집 추천';
    const fetchCoupang = async () => {
      try {
        const res = await fetch(`/api/coupang?keyword=${encodeURIComponent(keyword)}&limit=4`);
        const data = await res.json();
        setCoupangProducts((data.products || []).slice(0, 4));
      } catch {
        setCoupangProducts([]);
      } finally {
        setCoupangLoading(false);
      }
    };
    fetchCoupang();
  }, [category]);

  return (
    <div className="space-y-6">
      {/* ── 쿠팡 상품 섹션 ── */}
      {!coupangLoading && coupangProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-rose-500 rounded-full" />
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                관련 상품
              </h2>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                {placeName && `${placeName} `}연관 쿠팡 상품
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {coupangProducts.map((product: any, idx: number) => (
              <CoupangProductCard key={product.productId || idx} product={product} />
            ))}
          </div>

          <p className="text-[9px] text-slate-300 mt-4 text-center">
            파트너스 활동의 일환으로 수수료를 제공받을 수 있습니다.
          </p>
        </div>
      )}
      {/* ── 제휴 링크 섹션 ── */}
      <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-8 bg-amber-500 rounded-full" />
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              관련 상품 · 여행 정보
            </h2>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5">
              {placeName && `${placeName} `}주변 상품을 둘러보세요
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((link, idx) => {
            const Icon = link.icon;
            return (
              <a
                key={idx}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 border border-slate-100 dark:border-slate-700/50 hover:border-amber-200 dark:hover:border-amber-700/50 transition-all group"
              >
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/20 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">{link.label}</p>
                  <p className="text-[10px] font-medium text-slate-400">{link.subLabel}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors shrink-0" />
              </a>
            );
          })}
        </div>

        <p className="text-[9px] text-slate-300 mt-4 text-center">
          파트너스 활동의 일환으로 수수료를 제공받을 수 있습니다.
        </p>
      </div>
    </div>
  );
}

export default function PlaceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [place, setPlace] = useState<any>(null);
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { setFavoriteIds } = useAppStore();
  const { showToast } = useAppStore();

  const toggleFavorite = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await supabase.from('favorites').delete().match({ user_id: user.id, place_id: id });
        setIsFavorite(false);
        showToast('즐겨찾기가 해제되었습니다.', 'success');
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, place_id: id });
        setIsFavorite(true);
        showToast('즐겨찾기에 추가되었습니다.', 'success');
      }
      // store 업데이트
      const { data: favs } = await supabase.from('favorites').select('place_id').eq('user_id', user.id);
      setFavoriteIds((favs || []).map((f: any) => f.place_id));
    } catch {
      showToast('처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setFavoriteLoading(false);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user?.email === 'onfons.it@gmail.com') {
        setIsAdmin(true);
      }
    };
    checkAdmin();

    const fetchDetails = async () => {
      const { data: placeData } = await supabase
        .from('places')
        .select('*')
        .eq('id', id)
        .single();

      const { data: contentData } = await supabase
        .from('content_places')
        .select(`
          timeline_seconds,
          creator_review,
          summary,
          contents (*)
        `)
        .eq('place_id', id);
      
      setPlace(placeData);
      setEditData({
        ...placeData,
        summary: contentData?.[0]?.summary || ''
      });

      // summary에서 전화번호 추출 시도 (데이터베이스 컬럼이 없는 경우 대비)
      if (placeData && !placeData.phone && contentData?.[0]?.summary) {
        const phoneMatch = contentData[0].summary.match(/\d{2,3}-\d{3,4}-\d{4}/);
        if (phoneMatch) {
          setPlace((prev: any) => ({ ...prev, phone: phoneMatch[0] }));
        }
      }

      setContents(contentData || []);
      setLoading(false);
    };


    if (id) fetchDetails();
  }, [id]);

  // 즐겨찾기 상태 확인
  useEffect(() => {
    if (!id || !currentUser) return;
    supabase.from('favorites').select('id').match({ user_id: currentUser.id, place_id: id }).maybeSingle().then(({ data }) => {
      setIsFavorite(!!data);
    });
  }, [id, currentUser]);

  const handleUpdate = async () => {
    // 1. Update Places table
    const { error: placeErr } = await supabase
      .from('places')
      .update({
        place_name: editData.place_name,
        address: editData.address,
        phone: editData.phone,
        category: editData.category,
        business_hours: editData.business_hours,
        break_time: editData.break_time,
        representative_menu: editData.representative_menu
      })
      .eq('id', id);


    // 2. Update Content_Places table (Summary info)
    const { error: summaryErr } = await supabase
      .from('content_places')
      .update({
        summary: editData.summary
      })
      .eq('place_id', id);

    if (placeErr || summaryErr) {
      alert('수정 실패: ' + (placeErr?.message || summaryErr?.message));
    } else {
      alert('수정되었습니다.');
      setPlace(editData);
      // Re-fetch or manually update contents state to reflect summary change
      setContents(prev => prev.map((item, idx) => idx === 0 ? {...item, summary: editData.summary} : item));
      setIsEditing(false);
    }
  };


  const handleDelete = async () => {
    const { showConfirm } = useAppStore.getState();
    showConfirm('장소 삭제', '정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.', async () => {
      try {
        // 서비스 API로 삭제 (RLS 우회)
        const res = await fetch('/api/service-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_place', data: { id } })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        showToast('삭제되었습니다.', 'success');
        router.push('/');
      } catch (error: any) {
        showToast('삭제 실패: ' + error.message, 'error');
      }
    });
  };


  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white dark:bg-slate-950">
      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-emerald-500"></div>
    </div>
  );
  
  if (!place) return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h1 className="text-6xl font-black text-slate-200 mb-4 tracking-tighter">404</h1>
      <p className="text-slate-500 font-bold mb-8">장소를 찾을 수 없습니다.</p>
      <button onClick={() => router.back()} className="px-10 py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg">뒤로 가기</button>
    </div>
  );

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      
      {/* Reduced Top Margin Header */}
      <div className="sticky top-0 z-[110] p-4 flex items-center justify-between pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-slate-800 active:scale-90 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-slate-900 dark:text-white" />
          </button>
          <button
            onClick={toggleFavorite}
            disabled={favoriteLoading}
            className={`w-10 h-10 backdrop-blur-xl rounded-xl flex items-center justify-center shadow-xl border active:scale-90 transition-all disabled:opacity-50 ${
              isFavorite
                ? 'bg-rose-500 border-rose-400'
                : 'bg-white/90 dark:bg-slate-900/90 border-slate-100 dark:border-slate-800'
            }`}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'text-white fill-white' : 'text-slate-400'}`} />
          </button>
        </div>

        {isAdmin && (
          <div className="flex gap-2 pointer-events-auto">
            {isEditing ? (
              <>
                <button onClick={handleUpdate} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-lg">저장</button>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-500 text-white rounded-xl font-black text-xs shadow-lg">취소</button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs shadow-lg">수정</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl font-black text-xs shadow-lg">삭제</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-32">
        
        {/* Immersive Hero Card */}
        <div className="relative h-[30vh] md:h-[40vh] rounded-[40px] overflow-hidden mb-8 shadow-2xl border-4 border-white dark:border-slate-900">
          {place.thumbnail_url ? (
            <Image
              src={place.thumbnail_url}
              alt={place.place_name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
               <span className="text-9xl opacity-20">📍</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          
          <div className="absolute bottom-6 left-8 right-8">
            <div className="flex flex-col items-start gap-2">
              <div className="px-3 py-1 bg-emerald-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase">
                {isEditing ? (
                   <select 
                    value={editData.category} 
                    onChange={(e) => setEditData({...editData, category: e.target.value})}
                    className="bg-emerald-600 text-white border-none outline-none text-[10px] font-black"
                   >
                     {CATEGORIES.map((cat) => (
                       <option key={cat.id} value={cat.id}>{cat.label}</option>
                     ))}
                   </select>
                ) : getCategoryLabel(place.category || '')}
              </div>
              {isEditing ? (
                <input 
                  value={editData.place_name}
                  onChange={(e) => setEditData({...editData, place_name: e.target.value})}
                  className="bg-white/20 backdrop-blur-md text-3xl md:text-5xl font-black text-white outline-none border-b-2 border-white/40 w-full"
                />
              ) : (
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter">
                  {place.place_name}
                </h1>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Detailed Info Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] shadow-xl border border-white dark:border-slate-800">
              <h2 className="text-xs font-black text-slate-400 mb-8 uppercase tracking-widest">Business Information</h2>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                    {isEditing ? (
                      <input 
                        value={editData.phone || ''}
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold outline-none border-b-2 border-emerald-500"
                      />
                    ) : (
                      place.phone ? (
                        <a href={`tel:${place.phone}`} className="text-sm font-black text-emerald-600 underline decoration-2 underline-offset-4">
                          {place.phone}
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-slate-400">등록된 번호 없음</p>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</p>
                    {isEditing ? (
                      <input 
                        value={editData.address || ''}
                        onChange={(e) => setEditData({...editData, address: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold outline-none border-b-2 border-emerald-500"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{place.address}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Business Hours</p>
                    {isEditing ? (
                      <input 
                        value={editData.business_hours || ''}
                        onChange={(e) => setEditData({...editData, business_hours: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold outline-none border-b-2 border-emerald-500"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{place.business_hours || '정보 없음'}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Break Time</p>
                    {isEditing ? (
                      <input
                        value={editData.break_time || ''}
                        onChange={(e) => setEditData({...editData, break_time: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold outline-none border-b-2 border-emerald-500"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{place.break_time || '정보 없음'}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Representative Menu</p>
                    {isEditing ? (
                      <textarea 
                        value={editData.representative_menu || ''}
                        onChange={(e) => setEditData({...editData, representative_menu: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold outline-none border-b-2 border-emerald-500 min-h-[80px] resize-none"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-pre-line">{place.representative_menu || '정보 없음'}</p>
                    )}
                  </div>
                </div>



                {/* DB 정보를 그대로 보여주기 위해 summary 컬럼 활용 */}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service & Features</p>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {isEditing ? (
                        <textarea 
                          value={editData.summary || ''}
                          onChange={(e) => setEditData({...editData, summary: e.target.value})}
                          className="w-full bg-transparent border-none outline-none min-h-[150px] resize-none text-sm font-bold"
                          placeholder="영업시간, 가격, 상세 정보를 입력하세요..."
                        />
                      ) : (
                        contents[0]?.summary || place.representative_menu || '상세 정보가 없습니다.'
                      )}
                    </div>
                  </div>

                </div>


                <div className="pt-6 border-t border-slate-50 dark:border-slate-800 hidden">
                   <a
                    href={`https://map.naver.com/v5/search/${encodeURIComponent(place.place_name + ' ' + place.address)}`}
                    target="_blank"
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-95"
                   >
                    <span>네이버 지도에서 보기</span>
                   </a>
                </div>
              </div>
            </div>
          </div>

          {/* Video & Review Content */}
          <div className="lg:col-span-2">
             <div className="flex items-center gap-4 mb-8">
               <div className="w-2 h-10 bg-emerald-500 rounded-full" />
               <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                 Recommenders
               </h2>
             </div>

             <div className="space-y-8">
               {contents.map((item, idx) => (
                 <div key={idx} className="bg-white dark:bg-slate-900 rounded-[40px] p-6 md:p-8 shadow-xl border border-white dark:border-slate-800 group">
                   <div className="flex flex-col md:flex-row gap-8">
                     <div className="w-full md:w-72 aspect-video relative rounded-3xl overflow-hidden shadow-2xl shrink-0">
                       <Image
                         src={item.contents.thumbnail_url}
                         alt={item.contents.title}
                         fill
                         className="object-cover group-hover:scale-110 transition-transform duration-700"
                       />
                       <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                         <Link 
                           href={`https://youtube.com/watch?v=${item.contents.video_id}&t=${item.timeline_seconds}s`}
                           target="_blank"
                           className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
                         >
                           <Play className="w-6 h-6 text-white fill-white" />
                         </Link>
                       </div>
                       <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-xl text-[10px] font-black text-white border border-white/10">
                         {Math.floor(item.timeline_seconds / 60)}:{(item.timeline_seconds % 60).toString().padStart(2, '0')}
                       </div>
                     </div>

                     <div className="flex-1 flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-4">
                         <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg text-[10px] font-black text-red-500 uppercase tracking-widest border border-red-100 dark:border-red-800">
                           {item.contents.creator_name}
                         </div>
                       </div>
                       <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4 tracking-tight leading-snug">
                         {item.contents.title}
                       </h3>
                       <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border-l-4 border-emerald-500">
                         <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed font-bold">
                           "{item.creator_review}"
                         </p>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </div>

        </div>

        {/* ── Partner Links Section ── */}
        <div className="mt-12 mb-8">
          <AffiliateSection category={place.category || ''} placeName={place.place_name} />
        </div>

      </div>
    </div>
  );
}
