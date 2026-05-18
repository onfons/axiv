import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'google/gemma-4-31b-it';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

/** URL에서 YouTube video ID 추출 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** YouTube Data API v3로 비디오 정보 조회 */
async function getYouTubeVideoData(videoId: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) throw new Error('YouTube에서 비디오를 찾을 수 없습니다.');

  const s = item.snippet;
  return {
    video_id: videoId,
    title: s.title || '',
    description: s.description || '',
    uploader: s.channelTitle || '',
    thumbnail_url: s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.default?.url || '',
  };
}

/** NVIDIA NIM AI 모델 호출 */
async function callAI(prompt: string): Promise<string> {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Tavily 검색 */
async function tavilySearch(query: string): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 8,
      include_raw_content: true,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily API error: ${res.status}`);
  const data = await res.json();
  const results = data.results || [];
  return results.map((r: any) => `[${r.title}]\n${r.content}`).join('\n\n');
}

/** Tavily로 장소 상세 검색 */
async function tavilyPlaceSearch(placeName: string): Promise<string> {
  // 여러 검색어로 풍부한 컨텍스트 확보
  const queries = [
    `${placeName} 전화번호 주소`,
    `${placeName} 영업시간 메뉴`,
    `${placeName} 맛집 리뷰`,
  ];
  const results = await Promise.all(queries.map(q => tavilySearch(q)));
  return results.join('\n\n');
}

/** Tavily 검색 결과 → AI로 구조화된 장소 정보 추출 */
async function extractPlaceInfo(placeName: string, searchContext: string): Promise<any[]> {
  const infoPrompt = `You are a place information extraction assistant. Extract structured place details from the search results below.

Place name: ${placeName}

Web Search Results:
${searchContext.slice(0, 8000)}

Respond ONLY with a valid JSON array containing exactly one object. Example format:
\`\`\`json
[{
  "place_name": "${placeName}",
  "address": "서울시 강남구 역삼동 123-45",
  "phone": "02-1234-5678",
  "category": "food",
  "business_hours": "매일 11:00-22:00",
  "break_time": "15:00-17:00",
  "menu_with_prices": "김치찌개 8000원\\n된장찌개 8000원",
  "place_description": "2-3 sentence description of the place",
  "waiting_tip": "없음",
  "parking_info": "없음",
  "creator_review": "",
  "summary": "one-line summary",
  "timeline_seconds": 0
}]
\`\`\`

Rules:
- category must be one of: food, cafe, camping, fishing, travel, accommodation
- If no information is found in search results, try to infer reasonable defaults based on the place name
- break_time: empty string if none
- waiting_tip: "없음" if none
- parking_info: "없음" if none
- Always return exactly one place object in the array, never empty
- All fields must have values, never empty strings`;

  const aiResult = await callAI(infoPrompt);

  try {
    let cleaned = aiResult.trim();
    
    // 보다 안정적인 JSON 추출 (AI가 앞뒤에 불필요한 텍스트를 붙였을 경우 대비)
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    } else {
      // 배열이 아닌 단일 객체일 경우
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        cleaned = `[${objMatch[0]}]`;
      } else {
        // 기존 백틱 제거 로직 폴백
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();
      }
    }

    const places = JSON.parse(cleaned);
    if (!Array.isArray(places)) return [places];
    return places;
  } catch (e) {
    console.error('AI result JSON parse error:', e);
    return [{
      place_name: placeName,
      address: '',
      phone: '',
      category: 'food',
      business_hours: '',
      break_time: '',
      menu_with_prices: '',
      place_description: '',
      waiting_tip: '없음',
      parking_info: '없음',
      creator_review: '',
      summary: '',
      timeline_seconds: 0,
    }];
  }
}

export async function POST(req: Request) {
  try {
    const { url, forcePlaceName } = await req.json();
    if (!url) {
      return NextResponse.json({ error: '유효한 URL이 아닙니다.' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 });
    }

    // 1. YouTube API로 비디오 메타데이터 조회
    const videoData = await getYouTubeVideoData(videoId);

    // forcePlaceName이 전달된 경우 → 상호명 추출 단계 건너뛰고 바로 Tavily 검색
    if (forcePlaceName && forcePlaceName.length >= 2) {
      const searchContext = await tavilyPlaceSearch(forcePlaceName);
      const places = await extractPlaceInfo(forcePlaceName, searchContext);
      return NextResponse.json({
        video_id: videoData.video_id,
        metadata: {
          title: videoData.title,
          creator_name: videoData.uploader,
          thumbnail_url: videoData.thumbnail_url,
          url,
        },
        places,
        source: 'web-manual',
      });
    }

    // 2. AI로 상호명 추출 (제목 + 설명 기반)
    const extractPrompt = `You are an expert at extracting Korean place/business names from YouTube video information.

Video Title: ${videoData.title}
Channel: ${videoData.uploader}
Description: ${videoData.description.slice(0, 2000)}

Task: Identify the specific place/business name(s) mentioned in this video.

Rules:
- Extract ONLY real Korean place/business names (restaurants, cafes, stores, etc.)
- If the title clearly mentions a place name, extract it
- Cross-reference with channel name and description
- If you CANNOT determine a specific place name, respond with exactly: NO_PLACE_FOUND
- If you find a place name, respond with ONLY the name, nothing else
- Return ONLY the most likely single place name
- Do NOT return generic terms like "맛집", "카페", "여행" etc. without a specific name

Response format (choose one):
- "상호명" (if found)
- "NO_PLACE_FOUND" (if uncertain)`;

    const placeNameRaw = await callAI(extractPrompt);
    const placeName = placeNameRaw.replace(/["'']/g, '').trim();

    const isNoPlace = !placeName ||
      placeName.includes('NO_PLACE_FOUND') ||
      placeName.length < 2 ||
      ['미상', '정보 없음', '정보없음', '알 수 없음', '알수없음', '모름', 'unknown'].includes(placeName);

    if (isNoPlace) {
      // 상호명 없음 → 수동 입력 필요 신호를 프론트에 전달
      return NextResponse.json({
        video_id: videoData.video_id,
        metadata: {
          title: videoData.title,
          creator_name: videoData.uploader,
          thumbnail_url: videoData.thumbnail_url,
          url,
        },
        places: [],
        needManualInput: true,
      });
    }

    // 3. 상호명 있음 → Tavily로 장소 정보 검색 + AI 추출
    const searchContext = await tavilyPlaceSearch(placeName);
    let places = await extractPlaceInfo(placeName, searchContext);

    // 좌표는 기본값으로 (VWorld Geocoding은 Python 서버에서 처리)
    for (const p of places) {
      p.lat = 37.5665;
      p.lng = 126.9780;
    }

    return NextResponse.json({
      video_id: videoData.video_id,
      metadata: {
        title: videoData.title,
        creator_name: videoData.uploader,
        thumbnail_url: videoData.thumbnail_url,
        url,
      },
      places,
      source: 'web',
    });

  } catch (error: any) {
    console.error('Analyze Web API Error:', error);
    return NextResponse.json({
      error: `분석 중 오류가 발생했습니다: ${error.message}`,
    }, { status: 500 });
  }
}