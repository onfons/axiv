import { NextRequest, NextResponse } from 'next/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'google/gemma-4-31b-it';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

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

async function tavilyPlaceSearch(placeName: string): Promise<string> {
  const queries = [
    `${placeName} 전화번호 주소`,
    `${placeName} 영업시간 메뉴`,
    `${placeName} 맛집 리뷰`,
  ];
  const results = await Promise.all(queries.map(q => tavilySearch(q)));
  return results.join('\n\n');
}

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
- category must be one of: food, cafe, camping, fishing, travel, accommodation, popup, exhibition, activity, drive
- If no information is found in search results, try to infer reasonable defaults based on the place name
- break_time: empty string if none
- waiting_tip: "없음" if none
- parking_info: "없음" if none
- Always return exactly one place object in the array, never empty
- All fields must have values, never empty strings`;

  const aiResult = await callAI(infoPrompt);

  try {
    let cleaned = aiResult.trim();
    
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    } else {
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        cleaned = `[${objMatch[0]}]`;
      } else {
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

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { place_name } = body;

    if (!place_name || place_name.trim().length < 2) {
      return NextResponse.json({ places: [] }, { status: 400 });
    }

    const searchContext = await tavilyPlaceSearch(place_name);
    let places = await extractPlaceInfo(place_name, searchContext);

    for (const p of places) {
      if (!p.lat) p.lat = 37.5665;
      if (!p.lng) p.lng = 126.9780;
    }

    return NextResponse.json({ places });
  } catch (error: any) {
    console.error('Reanalyze API Error:', error);
    return NextResponse.json(
      { error: error.message || '재검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
