import { NextResponse } from 'next/server';

const MRT_API_KEY = process.env.MYREALTRIP_API_KEY || '';
const MRT_BASE = 'https://www.myrealtrip.com/api';

export async function GET(req: Request) {
  if (!MRT_API_KEY) {
    return NextResponse.json({ places: [] });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!query && !lat) {
    return NextResponse.json({ places: [] });
  }

  try {
    // MyRealTrip Search API: places / tours 검색
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (lat && lng) {
      params.set('lat', lat);
      params.set('lng', lng);
    }
    params.set('page', '1');
    params.set('size', '3');

    const url = `${MRT_BASE}/search/v2/places?${params.toString()}`;
    console.log(`[MyRealTrip] Searching: ${query || `${lat},${lng}`}`);

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${MRT_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // 404는 별도 로그 없이 조용히 처리
      if (res.status !== 404) {
        const errText = await res.text();
        console.warn(`[MyRealTrip] API error (${res.status}): ${errText.substring(0, 200)}`);
      }
      return NextResponse.json({ places: [] });
    }

    const data = await res.json();

    // 응답 구조 파싱 (places 배열 추출)
    let places: any[] = [];
    if (Array.isArray(data)) {
      places = data;
    } else if (data.data && Array.isArray(data.data)) {
      places = data.data;
    } else if (data.places && Array.isArray(data.places)) {
      places = data.places;
    } else if (data.result && Array.isArray(data.result)) {
      places = data.result;
    } else if (data.content && Array.isArray(data.content)) {
      places = data.content;
    }

    // 필요한 필드만 매핑
    const mapped = places.slice(0, 3).map((p: any) => ({
      id: p.id || p.placeId,
      name: p.name || p.placeName || p.title,
      image: p.imageUrl || p.image || p.thumbnailUrl || p.representativeImage,
      rating: p.rating || p.averageRating || p.score,
      reviewCount: p.reviewCount || p.reviewCnt || p.commentCount,
      address: p.address || p.location || p.roadAddress,
      phone: p.phone || p.tel || p.phoneNumber,
      url: p.url || p.detailUrl || p.link,
      price: p.price || p.salePrice || p.discountedPrice,
      originalPrice: p.originalPrice || p.listPrice,
      description: p.description || p.briefDescription || p.intro,
      category: p.category || p.categoryName || p.type,
    }));

    return NextResponse.json({ places: mapped });
  } catch (e: any) {
    console.error('[MyRealTrip] Error:', e.message);
    return NextResponse.json({ places: [] });
  }
}