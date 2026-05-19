#!/usr/bin/env python3
"""
axiv 데이터 수집 파이프라인 v2
단일 영상 분석 → Supabase DB 저장 (강화된 상세정보 추출)
"""
import sys, json, os, re, requests
from urllib.parse import quote

from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')

sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
os.chdir('/home/ubuntu/projects/axiv/python_server')

from app.utils import get_youtube_full_data, perform_deep_search, get_coordinates

NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

NVIDIA_MODEL = "google/gemma-3n-e4b-it"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"


def web_search_place(place_name, address):
    """장소 상세정보를 웹에서 추가 검색"""
    context = ""
    queries = [
        f"{place_name} {address} 영업시간 전화번호",
        f"{place_name} 메뉴 가격",
        f"{place_name} {address} 브레이크타임",
        f"{place_name} 주차 웨이팅",
    ]
    try:
        from duckduckgo_search import DDGS
        for q in queries:
            try:
                with DDGS() as dg:
                    results = list(dg.text(q, max_results=3))
                    for r in results:
                        context += f"[{q}] {r['body']}\n"
            except:
                pass
    except:
        pass
    return context


def analyze(url):
    """영상 분석 → 저장"""
    print(f'\n🔍 분석 시작: {url}')
    
    # 1. yt-dlp 데이터
    raw = get_youtube_full_data(url)
    if not raw:
        print('❌ yt-dlp 실패')
        return
    print(f'✅ 제목: {raw["title"][:80]}')
    print(f'✅ 채널: {raw["uploader"]}')
    print(f'✅ 자막: {len(raw.get("transcript","") or "")} chars')
    print(f'✅ 설명: {len(raw.get("description","") or "")} chars')
    
    # 2. 웹검색
    search_ctx = perform_deep_search(raw['title'], raw['uploader'])
    print(f'✅ 검색결과: {len(search_ctx)} chars')
    
    # 3. AI 분석 (강화 프롬프트)
    prompt = f"""당신은 유튜브 영상 정보를 분석하여 DB에 저장할 최적의 장소 정보를 추출하는 전문가입니다. 제공된 정보를 종합하여 크리에이터가 실제로 방문한 장소들을 추출하세요.

[입력 데이터]
- 제목: {raw['title']}
- 채널: {raw['uploader']}
- 상세설명: {raw['description'][:1500]}
- 자막: {raw['transcript'][:10000]}
- 웹검색결과: {search_ctx[:8000]}

[필수 지침 - 절대 무시하지 마세요]
1. place_name은 유튜브 제목 + 채널명 + 웹검색결과 교차 검증으로 확정
2. 제목에 상호명이 있으면 최우선 사용
3. business_hours는 반드시 "평일 11:00~21:00, 주말 10:00~22:00" 형식으로 입력. 웹검색에 없으면 자막/설명에서 추론. 절대 빈 문자열 금지
4. break_time은 반드시 "15:00~17:00" 형식. 없으면 "없음"
5. menu_with_prices는 반드시 "메뉴명 12,000원\\n메뉴명 8,000원" 형식. 웹검색결과와 자막에서 반드시 찾아서 입력
6. phone은 "XXX-XXXX-XXXX" 형식. 웹검색에서 정확히 입력
7. address는 반드시 도로명 주소
8. place_description은 장소 분위기/특징/추천이유를 3-4문장 상세히
9. waiting_tip/parking_info는 명확한 정보 없으면 빈 문자열
10. category는 food/cafe/camping/fishing/travel/accommodation 중 정확히 선택
11. creator_review는 크리에이터의 핵심 평가를 2-3문장 요약
12. summary는 이 장소가 어떤 곳인지 2-3문장 종합 요약

응답 JSON 형식 - 반드시 배열만 응답, 다른 텍스트 없이 순수 JSON만:
[
  {{
    "place_name": "상호명",
    "address": "도로명 주소",
    "phone": "전화번호",
    "category": "카테고리",
    "business_hours": "영업시간",
    "break_time": "브레이크타임",
    "menu_with_prices": "메뉴명 가격원",
    "place_description": "장소 설명",
    "waiting_tip": "웨이팅 정보",
    "parking_info": "주차 정보",
    "creator_review": "크리에이터 리뷰 요약",
    "summary": "종합 요약",
    "timeline_seconds": 0
  }}
]
"""
    
    headers = {"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": NVIDIA_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 4096}
    
    print('⏳ AI 분석 중... (최대 3분)')
    resp = requests.post(f"{NVIDIA_BASE}/chat/completions", json=payload, headers=headers, timeout=180)
    resp.raise_for_status()
    result_text = resp.json()['choices'][0]['message']['content']
    print(f'✅ AI 응답: {len(result_text)} chars')
    
    # JSON 파싱 (마크다운 코드블록 처리)
    places = []
    try:
        # 코드블록 제거
        clean = re.sub(r'```(?:json)?\s*', '', result_text).strip()
        jm = re.search(r'\[\s*\{.*\}\s*\]', clean, re.DOTALL)
        places = json.loads(jm.group(0)) if jm else json.loads(clean)
        if isinstance(places, dict):
            places = [places]
    except Exception as e:
        print(f'❌ JSON 파싱 실패: {e}')
        print(f'   응답 미리보기: {result_text[:300]}')
        return
    
    print(f'📊 추출 장소: {len(places)}개')
    
    # 4. Geocoding + 부족한 정보 추가 웹검색
    for i, p in enumerate(places):
        addr = p.get('address', '')
        lat, lng = get_coordinates(addr)
        p['lat'] = lat
        p['lng'] = lng
        
        print(f'\n  [{i+1}] {p.get("place_name","?")}')
        print(f'      주소: {addr}')
        print(f'      전화: {p.get("phone","?")}')
        print(f'      영업시간: {p.get("business_hours","?")[:50]}')
        print(f'      브레이크: {p.get("break_time","?")[:30]}')
        print(f'      메뉴: {p.get("menu_with_prices","?")[:60]}')
        print(f'      좌표: {lat}, {lng}')
        print(f'      카테고리: {p.get("category","?")}')
        
        # 빈 필드 추가 웹검색
        name = p.get('place_name', '')
        missing = []
        for field in ['business_hours', 'break_time', 'menu_with_prices', 'phone']:
            v = p.get(field, '')
            if not v or v in ['없음', '정보 없음', ' ']:
                missing.append(field)
        
        if missing and name:
            print(f'      🔍 누락정보 추가검색: {", ".join(missing)}')
            extra = web_search_place(name, addr)
            if extra:
                # AI로 추가 분석
                fill_prompt = f"""다음 검색결과에서 장소 "{name}"의 다음 정보를 추출하세요:
검색결과: {extra[:3000]}

다음 정보를 JSON으로 응답 (없으면 빈 문자열):
{{
  "business_hours": "영업시간",
  "break_time": "브레이크타임",
  "menu_with_prices": "메뉴명 가격원",
  "phone": "전화번호"
}}
"""
                fill_resp = requests.post(f"{NVIDIA_BASE}/chat/completions", json={
                    "model": NVIDIA_MODEL,
                    "messages": [{"role": "user", "content": fill_prompt}],
                    "temperature": 0.1,
                    "max_tokens": 1024
                }, headers=headers, timeout=60)
                fill_text = fill_resp.json()['choices'][0]['message']['content']
                
                try:
                    fill_clean = re.sub(r'```(?:json)?\s*', '', fill_text).strip()
                    fill_data = json.loads(fill_clean)
                    for k, v in fill_data.items():
                        if v and v not in ['없음', '정보 없음', ' '] and not p.get(k, ''):
                            p[k] = v
                            print(f'      ✅ 추가정보: {k} = {v[:50]}')
                except:
                    pass
        
        # "없음" 값 정리
        for field in ['waiting_tip', 'parking_info']:
            v = p.get(field, '')
            if not v or v in ['없음', '정보 없음', ' ', ''] or len(v.strip()) < 2:
                p[field] = ''
        for field in ['business_hours', 'break_time', 'menu_with_prices', 'place_description']:
            v = p.get(field, '')
            if not v or v in ['없음', '정보 없음', ' ']:
                p[field] = ''
    
    return {
        'video_id': raw['video_id'],
        'metadata': {
            'title': raw['title'],
            'creator_name': raw['uploader'],
            'thumbnail_url': raw['thumbnail_url'],
            'url': url
        },
        'places': places
    }


def save(result):
    """Supabase DB에 저장"""
    from supabase import create_client
    
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 1. Content 저장
    meta = result['metadata']
    content_data = {
        'video_id': result['video_id'],
        'title': meta['title'],
        'url': meta['url'],
        'creator_name': meta['creator_name'],
        'creator_channel_url': f"https://www.youtube.com/channel/{result['video_id']}",
        'thumbnail_url': meta['thumbnail_url']
    }
    
    c_res = sb.table('contents').upsert(content_data, on_conflict='video_id').execute()
    content_id = c_res.data[0]['id']
    print(f'✅ Content 저장: {content_id}')
    
    for p in result['places']:
        name = p.get('place_name', '').strip()
        addr = p.get('address', '').strip()
        if not name or '미상' in name:
            print(f'  ⏭️ 건너뜀: 상호명 없음')
            continue
        
        # 2. Place 중복 체크
        existing = sb.table('places').select('id').eq('place_name', name).eq('address', addr).maybe_single().execute()
        
        if existing and existing.data:
            place_id = existing.data['id']
            print(f'  ✅ 기존 장소: {name} (ID: {place_id})')
        else:
            place_data = {
                'place_name': name,
                'address': addr,
                'category': p.get('category', 'food'),
                'lat': p.get('lat', 0),
                'lng': p.get('lng', 0),
                'phone': p.get('phone', '') or '',
                'business_hours': p.get('business_hours', '') or '',
                'break_time': p.get('break_time', '') or '',
                'representative_menu': p.get('menu_with_prices', '') or '',
                'place_description': p.get('place_description', '') or '',
                'waiting_tip': p.get('waiting_tip', '') or '',
                'parking_info': p.get('parking_info', '') or ''
            }
            p_res = sb.table('places').insert(place_data).execute()
            place_id = p_res.data[0]['id']
            print(f'  ✅ 신규 장소: {name} (ID: {place_id})')
        
        # 3. content_places 연결
        link_data = {
            'content_id': content_id,
            'place_id': place_id,
            'timeline_seconds': p.get('timeline_seconds', 0),
            'creator_review': p.get('creator_review', '') or '',
            'summary': p.get('summary', '') or ''
        }
        sb.table('content_places').upsert(link_data, on_conflict='content_id,place_id').execute()
        print(f'  ✅ 연결 완료: {name}')


if __name__ == '__main__':
    urls = sys.argv[1:]
    if not urls:
        print('사용법: python3 script.py URL1 URL2 ...')
        sys.exit(1)
    
    for url in urls:
        result = analyze(url)
        if result and result['places']:
            save(result)
        print('\n' + '='*50)