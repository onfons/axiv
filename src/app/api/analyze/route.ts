import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = "google/gemma-4-31b-it";

async function searchTavily(query: string) {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${query}`,
        search_depth: "advanced",
        max_results: 10,
        include_answer: true
      }),
    });
    const data = await response.json();
    const context = [
      data.answer ? `[Direct Answer] ${data.answer}` : "",
      ...(data.results?.map((r: any) => `[Source: ${r.url}] ${r.content}`) || [])
    ].filter(Boolean).join('\n\n');
    return context;
  } catch (error) {
    console.error('Tavily search error:', error);
    return "";
  }
}

async function getGeocode(address: string) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=ko&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const data = await response.json();
    if (data.status === 'OK') {
      const result = data.results[0];
      const { lat, lng } = result.geometry.location;
      return { lat, lng, formatted_address: result.formatted_address };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

async function callNVIDIA(prompt: string) {
  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    if (!data.choices?.[0]) {
        console.error('NVIDIA API Error:', JSON.stringify(data));
        throw new Error('NVIDIA response error');
    }
    return data.choices[0].message.content;
  } catch (error) {
    console.error('NVIDIA API error:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
      return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 });
    }

    // 1. YouTube Metadata Fetch
    const metaRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
    );
    const metaData = await metaRes.json();
    if (metaData.error) {
      console.error('YouTube API Error:', metaData.error);
      return NextResponse.json({ error: `YouTube API 에러: ${metaData.error.message}` }, { status: 400 });
    }
    if (!metaData.items || metaData.items.length === 0) {
      return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
    }
    const snippet = metaData.items[0].snippet;
    const title = snippet.title;
    const description = snippet.description;

    // 2. Transcript Fetch
    let transcriptText = "";
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
      transcriptText = transcript.map(t => t.text).join(' ');
    } catch (e) {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        transcriptText = transcript.map(t => t.text).join(' ');
      } catch (e2) {
        console.warn('Transcript fetch failed. Falling back to Tavily search for context...');
        try {
          const fallbackSearch = await searchTavily(`유튜브 ${snippet.channelTitle} ${title} 장소 식당 위치`);
          transcriptText = `[자막 추출 실패로 인한 웹 검색 대체 정보]\n${fallbackSearch}`;
        } catch (searchError) {
          console.error('Fallback search also failed:', searchError);
        }
      }
    }

    // 3. NVIDIA NIM Analysis: Greedy Place Extraction
    const extractPrompt = `
      당신은 한국 유튜브 여행·맛집 콘텐츠에서 방문 장소를 샅샅이 찾아내는 전문가입니다.
      
      영상 제목: ${title}
      영상 설명: ${description.substring(0, 1500)}
      자막 내용: ${transcriptText.substring(0, 15000)}

      위 내용에서 언급된 모든 장소(음식점, 카페, 관광지 등)를 하나도 빠짐없이 추출하세요.
      
      추출 규칙:
      1. 매장명이 명시적으로 나오지 않더라도 자막 흐름상 특정 가게를 가리킨다면 포함하세요.
      2. 자막에 나오는 주소 정보(예: '상동 537-12')를 절대 놓치지 마세요.
      3. 실제로 방문하여 리뷰한 장소만 포함하세요.
      4. 응답은 오직 JSON 배열만 반환하세요.
      5. 중요: JSON 문자열 내부에 실제 줄바꿈(raw newline)을 절대 넣지 마세요. 모든 줄바꿈은 반드시 \\n으로 이스케이프해야 합니다.
      6. 영상에서 장소를 하나도 찾을 수 없다면, 절대 부가 설명을 덧붙이지 말고 오직 빈 배열 [] 만 반환하세요.
      
      응답은 오직 아래 형식의 JSON 배열만 반환하세요 (Do NOT use markdown or comments):
      [
        {
          "place_name": "장소명",
          "address_hint": "주소 또는 지역 단서",
          "category": "분류",
          "timeline_seconds": 120,
          "creator_review": "크리에이터의 솔직한 평가 요약",
          "summary": "장소의 특징과 분위기 요약"
        }
      ]
    `;

    const extractionResult = await callNVIDIA(extractPrompt);
    console.log('NVIDIA Extraction RAW:', extractionResult);

    let places = [];
    try {
      let jsonStr = extractionResult;
      const startIndex = jsonStr.indexOf('[');
      const endIndex = jsonStr.lastIndexOf(']');
      if (startIndex !== -1 && endIndex !== -1) {
        jsonStr = jsonStr.substring(startIndex, endIndex + 1);
      }
      
      try {
        places = JSON.parse(jsonStr);
      } catch (parseError) {
        // 나이브 트레일링 콤마 제거 시도
        jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
        places = JSON.parse(jsonStr);
      }
    } catch (e: any) {
      console.error('NVIDIA Extraction Parse Error:', e, extractionResult);
      const snippet = extractionResult.substring(0, 100).replace(/\n/g, '\\n');
      return NextResponse.json({ error: `AI 파싱 실패: ${e.message}. 원본: ${snippet}` }, { status: 500 });
    }

    // 4. Tavily Search & Greedy Refinement
    if (places.length === 0) {
      return NextResponse.json({ error: '자막이 없거나, 영상 내용에서 장소를 찾을 수 없습니다.' }, { status: 404 });
    }
    const enrichedPlaces = await Promise.all(
      places.map(async (place: any) => {
        try {
          const searchQuery = `${place.place_name} ${place.address_hint || ''} 네이버 플레이스 메뉴판 가격표 "전체 메뉴"`;
          const searchResult = await searchTavily(searchQuery);
          
          const refinePrompt = `
            유튜브 내용과 웹 검색 결과를 조합하여, 이 장소에 대한 모든 'DB 저장용' 정보를 샅샅이 수집하세요.
            특히 '메뉴와 가격' 정보는 검색 결과에서 찾을 수 있는 모든 항목을 하나도 빠짐없이 나열해야 합니다.
            
            유튜브 정보: ${JSON.stringify(place)}
            웹 검색 결과: ${searchResult}
            
            규칙 (매우 중요):
            1. 정보의 정확도는 '웹 검색 결과'를 최우선으로 함.
            2. menu_with_prices: 검색 결과에서 메뉴명과 가격(원)을 찾아 "메뉴명 가격\n" 형식으로 가능한 한 '전부' 기재하세요. (예: 김치찌개 9,000원\n된장찌개 8,500원) 만약 정보가 많다면 줄바꿈(\\n)을 사용하여 상세히 적으세요.
            3. business_hours: 평일/주말 영업시간, 브레이크 타임, 마지막 주문, 정기 휴무일을 상세히 기재하세요.
            4. place_description: 주차 가능 여부(유료/무료), 예약 가능 여부, 웨이팅 방식, 가게의 전반적인 분위기를 포함하세요.
            5. 응답은 반드시 이 JSON 형식을 따름:
            6. 중요: JSON 문자열 내부에 실제 줄바꿈(raw newline)을 절대 넣지 마세요. 모든 줄바꿈은 반드시 \\n으로 이스케이프해야 합니다.
            {
              "place_name": "확정된 상호명",
              "address": "상세 도로명 주소",
              "phone": "전화번호",
              "category": "정밀 카테고리",
              "business_hours": "상세 영업시간 및 휴무 정보",
              "menu_with_prices": "전체 메뉴 및 가격 리스트",
              "place_description": "주차, 웨이팅, 분위기 등 상세 특징",
              "creator_review": "유튜브 리뷰 핵심 요약",
              "summary": "장소 종합 요약"
            }
          `;

          const refinementResult = await callNVIDIA(refinePrompt);
          console.log(`NVIDIA Refinement RAW for ${place.place_name}:`, refinementResult);

          const objMatch = refinementResult.match(/\{[\s\S]*\}/);
          const finalPlace = JSON.parse(objMatch ? objMatch[0] : refinementResult);

          const geo = await getGeocode(finalPlace.address || searchQuery);
          
          return {
            ...finalPlace,
            lat: geo?.lat || 37.5665,
            lng: geo?.lng || 126.9780,
            address_hint: geo?.formatted_address || finalPlace.address,
            timeline_seconds: place.timeline_seconds
          };
        } catch (innerError: any) {
          console.error(`Refinement error for ${place.place_name}:`, innerError);
          return {
            ...place,
            address: place.address_hint,
            lat: 37.5665,
            lng: 126.9780,
            error: innerError.message
          };
        }
      })
    );

    return NextResponse.json({
      video_id: videoId,
      metadata: {
        title,
        creator_name: snippet.channelTitle,
        thumbnail_url: snippet.thumbnails.medium.url,
      },
      places: enrichedPlaces.filter(p => p.place_name && !p.place_name.includes('미상'))
    });

  } catch (error: any) {
    console.error('API Comprehensive Error:', error);
    return NextResponse.json({ 
      error: `서버 분석 오류: ${error.message}`,
      details: error.stack 
    }, { status: 500 });
  }
}


