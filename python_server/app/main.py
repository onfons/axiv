import asyncio
import aiohttp
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .utils import extract_video_id, get_youtube_full_data, perform_free_search, call_ai_model, get_coordinates, perform_deep_search, perform_place_detail_search
import os
import json
import re
import hmac
import hashlib
import time
from dotenv import load_dotenv
from urllib.parse import urlencode, quote
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="YouTube Analysis Python Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COUPANG_ACCESS_KEY = os.getenv('COUPANG_ACCESS_KEY', '').strip()
COUPANG_SECRET_KEY = os.getenv('COUPANG_SECRET_KEY', '').strip()

def make_coupang_auth(method: str, path: str, query: str = "") -> str:
    now = time.gmtime()
    datetime = f"{time.strftime('%y%m%d', now)}T{time.strftime('%H%M%S', now)}Z"
    message = datetime + method + path + (f"?{query}" if query else "")
    signature = hmac.new(COUPANG_SECRET_KEY.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"CEA algorithm=HmacSHA256, access-key={COUPANG_ACCESS_KEY}, signed-date={datetime}, signature={signature}"

@app.get("/api/coupang")
async def coupang_proxy(goldbox: bool = False, keyword: str = ""):
    if not COUPANG_ACCESS_KEY or not COUPANG_SECRET_KEY:
        return JSONResponse({"products": []})

    # goldbox=true → 골드박스
    if goldbox:
        api_path = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox"
        query = "limit=5"
        auth = make_coupang_auth("GET", api_path, query)
        url = f"https://api-gateway.coupang.com{api_path}?{query}"
    elif keyword:
        api_path = "/v2/providers/affiliate_open_api/apis/openapi/products/search"
        query = f"keyword={quote(keyword)}&limit=5"
        auth = make_coupang_auth("GET", api_path, query)
        url = f"https://api-gateway.coupang.com{api_path}?{query}"
    else:
        # 추천
        api_path = "/v2/providers/affiliate_open_api/apis/openapi/v2/products/reco"
        auth = make_coupang_auth("POST", api_path)
        url = f"https://api-gateway.coupang.com{api_path}"
        body = json.dumps({
            "site": {"id": "1", "domain": "blog.naver.com"},
            "device": {"id": "32chars_random_device_id_12345", "lmt": 0},
            "imp": {"imageSize": "300x300"},
            "user": {"puid": "fonsinfo"}
        })

    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": auth,
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            if keyword or goldbox:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as res:
                    if res.ok:
                        data = await res.json()
                        raw = data.get("data", [])
                        if not isinstance(raw, list):
                            raw = raw.get("productData", []) if isinstance(raw, dict) else []
                        products = raw[:5]
                        return JSONResponse({"products": products})
            else:
                async with session.post(url, headers=headers, data=body, timeout=aiohttp.ClientTimeout(total=10)) as res:
                    if res.ok:
                        data = await res.json()
                        raw = data.get("data", [])
                        if not isinstance(raw, list):
                            if isinstance(raw, dict):
                                raw = raw.get("productData", []) if raw.get("productData") else raw.get("products", [])
                            if not isinstance(raw, list):
                                raw = []
                        products = raw[:5]
                        return JSONResponse({"products": products})
    except Exception as e:
        print(f"[Coupang Proxy] Error: {e}")

    # fallback: goldbox
    if not goldbox:
        try:
            api_path = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox"
            query = "limit=5"
            auth = make_coupang_auth("GET", api_path, query)
            url = f"https://api-gateway.coupang.com{api_path}?{query}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers={"Authorization": auth, "Content-Type": "application/json"}, timeout=aiohttp.ClientTimeout(total=10)) as res:
                    if res.ok:
                        data = await res.json()
                        raw = data.get("data", [])
                        products = raw[:5] if isinstance(raw, list) else []
                        return JSONResponse({"products": products})
        except:
            pass

    return JSONResponse({"products": []})

class AnalyzeRequest(BaseModel):
    url: str

@app.get("/")
async def root():
    return {"message": "YouTube Analysis Server is running!"}

@app.post("/analyze-video")
async def analyze_video(request: AnalyzeRequest):
    url = request.url
    
    # 1. 유튜브 데이터 추출 (yt-dlp)
    raw_data = get_youtube_full_data(url)
    if not raw_data:
        raise HTTPException(status_code=400, detail="유튜브 데이터를 추출할 수 없습니다.")

    # 2. 3단계 검색 (제목 → 장소명 → 상세정보)
    search_context = perform_deep_search(raw_data['title'], raw_data['uploader'])

    # 3. AI 분석 프롬프트 — 강화 버전
    prompt = f"""
    당신은 유튜브 영상 정보를 분석하여 DB에 저장할 최적의 장소 정보를 추출하는 전문가입니다.
    제공된 정보를 종합하여 크리에이터가 실제로 방문한 장소들을 추출하세요.

    [입력 데이터]
    - 제목: {raw_data['title']}
    - 채널: {raw_data['uploader']}
    - 상세설명: {raw_data['description'][:1500]}
    - 자막: {raw_data['transcript'][:10000]}
    - 웹검색결과: {search_context[:8000]}

    중요 지침 (반드시 순서대로 따라야 함):
    1. 웹검색결과([일반검색], [전화번호주소], [영업시간], [메뉴정보], [블로그리뷰])에는 전화번호, 주소, 영업시간, 메뉴/가격 정보가 포함되어 있습니다. 반드시 모든 섹션의 내용을 하나도 빠짐없이 꼼꼼히 읽고 정보를 채우세요.
    2. 전화번호(phone)는 [전화번호주소] 섹션에서 반드시 "XXX-XXXX-XXXX" 형식의 번호를 찾아서 정확히 입력하세요. 웹검색결과에 번호가 여러 개 있어도 각 장소에 맞는 정확한 번호를 선택하세요.
    3. 주소(address)는 [전화번호주소] 섹션에서 "XX시 XX구 XX로 XX길 XX" 형식의 상세 도로명 주소를 찾아서 입력하세요.
    4. **place_name(상호명)은 반드시 유튜브 영상 제목(title) + 채널명(uploader) + 웹검색결과를 함께 분석하여 확정하세요.** 즉, 채널명과 제목을 조합해 검색해 나온 웹검색결과에서 실제 매장명을 확인하고, 그 매장명을 place_name에 입력하세요. 자막(transcript)은 음성인식 결과로 발음이 부정확할 수 있습니다(예: '울트라라면'을 '울트라마맨'으로 잘못 인식). **제목과 설명+채널명+웹검색결과의 교차 검증으로 정확한 상호명을 확정**하고, 자막의 음성인식 결과는 참고만 하세요.
    5. **place_name(상호명)을 "채널명+제목+웹검색결과"를 종합해도 특정할 수 없다면 반드시 빈 배열 `[]`을 응답하세요.** 예를 들어 제목이 "OO동 맛집"처럼 일반적이거나, 웹검색결과에서 실제 상호명을 찾을 수 없으면 빈 배열을 리턴하세요.
    5. 영업시간(business_hours)은 [영업시간] 섹션에서 "매일 11:00-22:00", "월-금 09:00-18:00" 형식의 실제 영업시간을 찾아서 입력하세요. 반드시 구체적인 시간 정보를 포함하세요. "[영업시간]" 레이블이 붙은 검색결과를 최우선으로 사용하세요. 검색결과에 "영업시간", "운영시간", "영업", "운영" 등의 키워드가 있으면 반드시 활용하세요.
    6. 브레이크타임(break_time)은 [영업시간] 섹션에서 "브레이크타임", "break", "휴게시간" 키워드로 정보를 찾아 "15:00-17:00" 형식으로 입력하세요. 없으면 빈 문자열.
    7. 메뉴(menu_with_prices)는 [메뉴정보] 섹션에서 실제 메뉴명과 가격을 "메뉴명 가격원\\n메뉴명 가격원" 형식으로 모두 포함하세요.
    8. 모든 필드를 가능한 한 채우려고 노력하세요. 정보가 없어도 웹검색결과나 자막에서 추론 가능한 내용을 채우세요.
    9. 절대 빈 문자열("")로 남겨두지 마세요.
   10. waiting_tip에는 웨이팅/대기/줄서기 관련 정보를 작성하세요 (예: "점심시간 대기 있음, 평일 오후 추천"). [블로그리뷰] 섹션에서 찾아서 채우세요. 정보가 없으면 "없음".
   11. parking_info에는 주차 가능 여부와 주차 관련 정보를 작성하세요 (예: "주차 가능 (건물 지하 1층)", "인근 유료 주차장 이용"). [블로그리뷰] 섹션에서 찾아서 채우세요. 정보가 없으면 "없음".
   12. place_description은 장소 분위기, 특징, 추천 이유를 2-3문장으로 자연스럽게 작성하세요. [블로그리뷰]와 자막 정보를 종합해서 생생하게 묘사하세요.

    응답 JSON 형식 — 반드시 배열로만 응답:
    [
      {{
        "place_name": "확정된 상호명",
        "address": "상세 도로명 주소 (몰라도 검색결과나 맥락에서 추론)",
        "phone": "전화번호 (몰라도 검색결과에서 찾아서)",
        "category": "카테고리 (food/cafe/camping/fishing/travel/accommodation 중 가장 적합한 하나. 음식점은 food, 카페는 cafe, 숙박은 accommodation으로 통일)",
        "business_hours": "영업시간 및 휴무일 정보 (예: 매일 11:00-22:00 / 일요일 휴무)",
        "break_time": "브레이크타임 정보 (예: 15:00-17:00, 없으면 빈 문자열)",
        "menu_with_prices": "메뉴명 가격원\\n메뉴명 가격원",
        "place_description": "장소 분위기, 특징, 추천 이유",
        "waiting_tip": "웨이팅/대기 관련 정보 (없으면 '없음')",
        "parking_info": "주차 가능 여부 및 주차 정보 (없으면 '없음')",
        "creator_review": "유튜브 리뷰 핵심 요약",
        "summary": "이 장소가 어떤 곳인지 종합 요약 (음식 종류, 분위기, 가격대 포함)",
        "timeline_seconds": 0
      }}
    ]
    """

    raw_analysis = call_ai_model(prompt)

    # JSON 추출 및 파싱 (1차 분석)
    places = []
    try:
        json_match = re.search(r'\[\s*\{.*\}\s*\]', raw_analysis, re.DOTALL)
        if json_match:
            places = json.loads(json_match.group(0))
        else:
            places = json.loads(raw_analysis)
    except Exception as e:
        print(f"1st AI Parse Error: {e}")
        places = []

    # 4. 상세 검색 생략 → 좌표 추출로 바로 이동 (속도 최적화)
    # 1차 AI 분석에서 perform_deep_search 결과를 이미 활용함
    if places:
        print(f"1차 분석 완료: {len(places)}개 장소 발견. 좌표 추출 진행...")

        # 5. 상호명 검증 — 유효한 place_name이 없으면 분석 실패 처리
        valid_places = []
        for p in places:
            name = (p.get('place_name', '') or '').strip()
            if len(name) >= 2 and name not in ['미상', '정보 없음', '정보없음', '알 수 없음', '알수없음', '모름', 'unknown']:
                valid_places.append(p)
            else:
                print(f"⚠️ 유효하지 않은 상호명 제거: '{name}'")

        if not valid_places:
            print("❌ 유효한 상호명이 없습니다. 분석 실패 처리.")
            return {
                "video_id": raw_data['video_id'],
                "metadata": {
                    "title": raw_data['title'],
                    "creator_name": raw_data['uploader'],
                    "thumbnail_url": raw_data['thumbnail_url'],
                    "url": url
                },
                "places": []
            }

        places = valid_places

        # 6. 주소 기반 좌표 추출 (Geocoding)
        for place in places:
            addr = place.get('address', '')
            lat, lng = get_coordinates(addr)
            place['lat'] = lat
            place['lng'] = lng

    return {
        "video_id": raw_data['video_id'],
        "metadata": {
            "title": raw_data['title'],
            "creator_name": raw_data['uploader'],
            "thumbnail_url": raw_data['thumbnail_url'],
            "url": url
        },
        "places": places
    }


class ReanalyzeRequest(BaseModel):
    place_name: str


@app.post("/api/reanalyze-place")
async def reanalyze_place(request: ReanalyzeRequest):
    """상호명으로 장소 정보만 재검색"""
    place_name = request.place_name.strip()
    if not place_name or len(place_name) < 2:
        return JSONResponse({"places": []})

    print(f"🔄 상호명 재검색: '{place_name}'")

    # 1. DuckDuckGo 상세 검색 + 일반 검색 병합
    detail_context = perform_place_detail_search(place_name)
    free_context = perform_free_search(f"{place_name} 맛집")
    search_context = detail_context + "\n" + free_context
    if len(search_context) > 6000:
        search_context = search_context[:6000]

    # 2. AI 분석 프롬프트 (analyze-video와 동일한 수준)
    prompt = f"""You are a place information extraction assistant. Extract structured place details from the search results below.

Place name: {place_name}

Web Search Results:
{search_context}

Respond ONLY with a valid JSON array containing exactly one object. Example format:
```json
[{{
  "place_name": "{place_name}",
  "address": "서울시 강남구 역삼동 123-45",
  "phone": "02-1234-5678",
  "category": "food",
  "business_hours": "매일 11:00-22:00",
  "break_time": "15:00-17:00",
  "menu_with_prices": "김치찌개 8000원\\n된장찌개 8000원",
  "place_description": "2-3 sentence description of the place",
  "waiting_tip": "없음",
  "parking_info": "없음",
  "creator_review": "summary review",
  "summary": "one-line summary",
  "timeline_seconds": 0
}}]
```

Rules:
- category must be one of: food, cafe, camping, fishing, travel, accommodation
- If no information is found in search results, try to infer reasonable defaults based on the place name
- break_time: empty string if none
- waiting_tip: "없음" if none
- parking_info: "없음" if none
- Always return exactly one place object in the array, never empty
- All fields must have values, never empty strings"""

    ai_result = call_ai_model(prompt)

    try:
        # JSON 파싱
        cleaned = ai_result.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        places = json.loads(cleaned)
        if not isinstance(places, list):
            places = [places]
    except Exception as e:
        print(f"Reanalyze JSON Parse Error: {e}")
        places = []

    # 3. 좌표 추출
    for place in places:
        address = place.get('address', '')
        if address and address not in ['', '정보 없음', '정보없음']:
            lat, lng = get_coordinates(address)
            place['lat'] = lat
            place['lng'] = lng
        else:
            place['lat'] = 37.5665
            place['lng'] = 126.9780

    return {"places": places}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
