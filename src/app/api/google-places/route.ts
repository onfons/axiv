import { NextRequest, NextResponse } from 'next/server';

/**
 * Google Places API (New) - Text Search
 * 기본 정보(이름, 주소, 좌표)만 요청, 리뷰/평점/영업시간 제외
 * 
 * 무료 할당량: 월 $200 크레딧 (Text Search 1000회 ≈ $2.67 → 약 75,000회/월 무료)
 */

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

const GOOGLE_PLACES_TEXTSEARCH = 'https://places.googleapis.com/v1/places:searchText';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
  // 필수 필드만 요청 — 최소 비용, 최소 응답
  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
};

export async function POST(req: NextRequest) {
  try {
    const { query, lat, lng, radius } = await req.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    const body: any = {
      textQuery: query,
      maxResultCount: 5,
    };
    
    // 위치 기반 검색 (좌표가 있으면)
    if (lat && lng) {
      body.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radius || 5000, // 기본 5km
        },
      };
    }
    
    const response = await fetch(GOOGLE_PLACES_TEXTSEARCH, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Places API error:', response.status, errText);
      return NextResponse.json({ error: `Google API error: ${response.status}` }, { status: response.status });
    }
    
    const data = await response.json();
    
    // 기본 정보만 추출
    const places = (data.places || []).map((p: any) => ({
      google_place_id: p.id,
      place_name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      lat: p.location?.latitude || 0,
      lng: p.location?.longitude || 0,
    }));
    
    return NextResponse.json({ places, source: 'google_places' });
    
  } catch (error: any) {
    console.error('Google Places API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}