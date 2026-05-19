#!/usr/bin/env python3
"""
axiv 데이터 수집 파이프라인 v3 — 교차검증(cross-validation) 탑재
"""
import sys, json, os, re, requests, time, urllib.parse
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')

sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
os.chdir('/home/ubuntu/projects/axiv/python_server')

from app.utils import get_youtube_full_data, perform_deep_search

NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
NVIDIA_MODEL = "google/gemma-3n-e4b-it"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"


def web_search_place(place_name, address):
    """웹에서 장소 상세정보 검색"""
    context = ""
    queries = [
        f"{place_name} {address} 영업시간 전화번호",
        f"{place_name} 메뉴 가격",
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


def verify_place(place_name, address):
    """
    교차검증: 네이버 지도 URL로 실제 존재하는 장소인지 확인
    리턴: (verified: bool, confidence: int 0-100)
    """
    if not place_name or not address or len(place_name) < 2:
        return False, 0
    
    name_lower = place_name.lower().replace(' ', '')
    addr_lower = address.lower().replace(' ', '')
    
    # 1. 네이버 지도 검색 (장소명 + 주소 일부로 검색)
    query = urllib.parse.quote(f"{place_name} {address[:20]}")
    nav_url = f"https://search.naver.com/search.naver?where=nexearch&query={query}"
    
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(nav_url, headers=headers, timeout=8)
        html = resp.text.lower()
        
        # 장소명과 주소가 검색 결과에 모두 등장하는지
        name_in_html = name_lower in html
        addr_parts = [p for p in address.split() if len(p) > 1]
        addr_matches = sum(1 for p in addr_parts if p.lower() in html)
        addr_ratio = addr_matches / max(len(addr_parts), 1)
        
        # 의심 패턴: AI가 생성한 가짜 주소
        fake_patterns = ['맛있는길', '테헤란로 427', '없음', '정보']
        is_fake = any(p in address for p in fake_patterns)
        
        # 점수 계산
        score = 30  # 기본
        if name_in_html:
            score += 30
        if addr_ratio > 0.6:
            score += 30
        if addr_ratio > 0.8:
            score += 10
        
        if is_fake:
            score -= 40
        
        verified = score >= 50
        return verified, min(score, 100)
    except:
        # 웹 검색 실패 시 기본 검증: 주소가 형식에 맞는지
        addr_ok = bool(re.search(r'[시군구]\s', address)) and len(address) > 10
        return addr_ok, 40 if addr_ok else 0


def geocode_address(address, place_name=""):
    """VWorld Geocoding (한국 최적) → Nominatim fallback → Photon fallback"""
    if not address or len(address) < 5:
        return 0, 0
    
    # 의심스러운 가짜 주소 체크
    fake_keywords = ['맛있는길', '테헤란로 427', '없음']
    if any(k in address for k in fake_keywords):
        return 0, 0
    
    # 1. Google Places API (New) — 전세계 커버, 가장 정확
    google_key = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
    if google_key and address:
        try:
            q = address.replace('  ', ' ').strip()[:100]
            gp_resp = requests.post(
                'https://places.googleapis.com/v1/places:searchText',
                headers={
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': google_key,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
                },
                json={
                    'textQuery': f"{place_name} {q}",
                    'maxResultCount': 1,
                    'languageCode': 'ko',
                },
                timeout=10
            )
            gp_data = gp_resp.json()
            if gp_data.get('places') and len(gp_data['places']) > 0:
                loc = gp_data['places'][0].get('location', {})
                lat = float(loc.get('latitude', 0))
                lng = float(loc.get('longitude', 0))
                if lat != 0 and lng != 0:
                    return lat, lng
        except:
            pass
    
    # 2. VWorld Geocoding (한국 정부 제공)
    vworld_key = os.getenv('VWORLD_API_KEY', '')
    if vworld_key:
        try:
            q = urllib.parse.quote(address.replace('  ', ' ').strip()[:100])
            
            # Try ROAD type first (도로명주소)
            vresp = requests.get(
                f'https://api.vworld.kr/req/address?service=address&request=getCoord&key={vworld_key}&type=ROAD&address={q}',
                timeout=10
            )
            vdata = vresp.json()
            if vdata.get('response', {}).get('status') == 'OK':
                point = vdata['response'].get('result', {}).get('point', {})
                lat = float(point.get('y', 0))
                lng = float(point.get('x', 0))
                if lat != 0 and lng != 0:
                    return lat, lng
            
            # Fallback: PARCEL type (지번주소)
            vresp2 = requests.get(
                f'https://api.vworld.kr/req/address?service=address&request=getCoord&key={vworld_key}&type=PARCEL&address={q}',
                timeout=10
            )
            vdata2 = vresp2.json()
            if vdata2.get('response', {}).get('status') == 'OK':
                point2 = vdata2['response'].get('result', {}).get('point', {})
                lat2 = float(point2.get('y', 0))
                lng2 = float(point2.get('x', 0))
                if lat2 != 0 and lng2 != 0:
                    return lat2, lng2
        except:
            pass
    
    # 2. Nominatim (OpenStreetMap)
    try:
        from geopy.geocoders import Nominatim
        geolocator = Nominatim(user_agent="axiv_batch_save")
        location = geolocator.geocode(f"{place_name} {address}", timeout=10)
        if location:
            return location.latitude, location.longitude
    except:
        pass
    
    # 3. Photon fallback
    try:
        query = urllib.parse.quote(f"{place_name} {address}"[:100])
        resp = requests.get(f'https://photon.komoot.io/api/?q={query}&limit=1', timeout=10)
        data = resp.json()
        if data.get('features') and len(data['features']) > 0:
            coords = data['features'][0]['geometry']['coordinates']
            return coords[1], coords[0]
    except:
        pass
    
    return 0, 0


def analyze(url):
    """영상 분석 → 교차검증 → 저장"""
    print(f'\n🔍 분석 시작: {url}')
    
    raw = get_youtube_full_data(url)
    if not raw:
        print('❌ yt-dlp 실패')
        return
    print(f'✅ 제목: {raw["title"][:80]}')
    print(f'✅ 채널: {raw["uploader"]}')
    print(f'✅ 자막: {len(raw.get("transcript","") or "")} chars')
    print(f'✅ 설명: {len(raw.get("description","") or "")} chars')
    
    search_ctx = perform_deep_search(raw['title'], raw['uploader'])
    print(f'✅ 검색결과: {len(search_ctx)} chars')
    
    # AI 분석
    prompt = f"""당신은 유튜브 영상을 분석하여 크리에이터가 방문한 장소의 정확한 정보를 추출하는 전문가입니다.

[입력 데이터]
- 제목: {raw['title']}
- 채널: {raw['uploader']}
- 상세설명: {raw['description'][:1500]}
- 자막: {raw['transcript'][:10000]}
- 웹검색결과: {search_ctx[:8000]}

[핵심 규칙 - 반드시 지켜야 함]
1. place_name은 유튜브 영상에서 크리에이터가 실제로 방문한 장소의 정확한 상호명
2. address는 반드시 실제 도로명 주소 (00시 00구 00로 00길 00 형식). AI가 생성한 가짜 주소("맛있는길", "테헤란로 427 3층" 등) 금지
3. business_hours는 "평일 11:00~21:00, 주말 10:00~22:00" 형식. 웹검색이나 자막에서 확인된 정보만 사용
4. break_time은 "15:00~17:00" 또는 "없음"
5. menu_with_prices는 "메뉴명 12,000원\\n메뉴명 8,000원" 형식
6. phone은 "XXX-XXXX-XXXX" 형식
7. place_description은 분위기/특징/추천이유 3-4문장
8. waiting_tip/parking_info는 명확한 정보만. 없으면 빈 문자열
9. category는 food/cafe/camping/fishing/travel/accommodation 중 선택
10. creator_review는 크리에이터의 핵심 평가 요약
11. summary는 이 장소가 어떤 곳인지 종합 요약

응답은 순수 JSON 배열만. 다른 텍스트 없음:
[{{"place_name":"","address":"","phone":"","category":"","business_hours":"","break_time":"","menu_with_prices":"","place_description":"","waiting_tip":"","parking_info":"","creator_review":"","summary":"","timeline_seconds":0}}]"""
    
    headers = {"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": NVIDIA_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 4096}
    
    print('⏳ AI 분석 중... (최대 3분)')
    resp = requests.post(f"{NVIDIA_BASE}/chat/completions", json=payload, headers=headers, timeout=180)
    resp.raise_for_status()
    result_text = resp.json()['choices'][0]['message']['content']
    print(f'✅ AI 응답: {len(result_text)} chars')
    
    # JSON 파싱
    places = []
    try:
        clean = re.sub(r'```(?:json)?\s*', '', result_text).strip()
        jm = re.search(r'\[\s*\{.*\}\s*\]', clean, re.DOTALL)
        places = json.loads(jm.group(0)) if jm else json.loads(clean)
        if isinstance(places, dict):
            places = [places]
    except Exception as e:
        print(f'❌ JSON 파싱 실패: {e}')
        print(f'   미리보기: {result_text[:300]}')
        return
    
    print(f'📊 추출 장소: {len(places)}개')
    
    # 교차검증 + Geocoding
    verified_places = []
    for i, p in enumerate(places):
        name = p.get('place_name', '').strip()
        addr = p.get('address', '').strip()
        
        print(f'\n  [{i+1}] {name[:30] or "?"}')
        print(f'      주소: {addr[:50] if addr else "?"}')
        
        if not name or not addr or len(name) < 2:
            print(f'      ❌ 건너뜀: 상호명/주소 부족')
            continue
        
        # 교차검증
        verified, confidence = verify_place(name, addr)
        print(f'      🔍 교차검증: {"✅ 합격" if verified else "❌ 불일치"} (신뢰도: {confidence}%)')
        
        if not verified:
            print(f'      ❌ 저장하지 않음: 웹검증 실패')
            continue
        
        # Geocoding
        lat, lng = geocode_address(addr, name)
        if lat == 0 and lng == 0:
            print(f'      ⚠️ Geocoding 실패 (주소 확인 필요)')
        else:
            print(f'      📍 좌표: {lat:.6f}, {lng:.6f}')
        
        p['lat'] = lat
        p['lng'] = lng
        p['verified'] = verified
        p['confidence'] = confidence
        
        # 추가정보
        missing = [f for f in ['business_hours', 'break_time', 'menu_with_prices', 'phone'] 
                   if not p.get(f, '') or p[f] in ['없음', '정보 없음']]
        
        if missing:
            print(f'      🔍 추가검색: {", ".join(missing)}')
            extra = web_search_place(name, addr)
            if extra:
                fill_prompt = f"""다음 검색결과에서 "{name}"의 정보를 추출하세요:
{extra[:3000]}
응답 JSON: {{"business_hours":"","break_time":"","menu_with_prices":"","phone":""}}"""
                try:
                    fr = requests.post(f"{NVIDIA_BASE}/chat/completions", json={
                        "model": NVIDIA_MODEL,
                        "messages": [{"role": "user", "content": fill_prompt}],
                        "temperature": 0.1, "max_tokens": 1024
                    }, headers=headers, timeout=60)
                    fill_text = fr.json()['choices'][0]['message']['content']
                    fc = re.sub(r'```(?:json)?\s*', '', fill_text).strip()
                    fd = json.loads(fc)
                    for k, v in fd.items():
                        if v and v not in ['없음', '정보 없음'] and not p.get(k, ''):
                            p[k] = v
                            print(f'      ✅ 추가: {k} = {str(v)[:40]}')
                except:
                    pass
        
        # 빈 값 정리
        for f in ['waiting_tip', 'parking_info']:
            if not p.get(f, '') or p[f] in ['없음', '정보 없음']:
                p[f] = ''
        for f in ['business_hours', 'break_time', 'menu_with_prices', 'place_description', 'phone']:
            if not p.get(f, '') or p[f] in ['없음', '정보 없음']:
                p[f] = ''
        
        print(f'      ✅ 저장 대상')
        verified_places.append(p)
    
    if not verified_places:
        print(f'\n❌ 교차검증 통과한 장소 없음. 저장 안 함.')
        return
    
    # 영상 정보에 포함할 요약: 채널명 + 실제 저장된 장소명들을 저장
    return {
        'video_id': raw['video_id'],
        'metadata': {
            'title': raw['title'],
            'creator_name': raw['uploader'],
            'thumbnail_url': raw['thumbnail_url'],
            'url': url
        },
        'places': verified_places
    }


def save(result):
    """Supabase DB 저장 (교차검증 통과한 장소만)"""
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
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
        if not name:
            continue
        
        # 중복 체크: 상호명 + 주소로
        existing = sb.table('places').select('id').eq('place_name', name).eq('address', addr).maybe_single().execute()
        
        if existing and existing.data:
            place_id = existing.data['id']
            print(f'  ✅ 기존: {name}')
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
            print(f'  ✅ 신규: {name}')
        
        # 연결
        link_data = {
            'content_id': content_id,
            'place_id': place_id,
            'timeline_seconds': p.get('timeline_seconds', 0),
            'creator_review': p.get('creator_review', '') or '',
            'summary': p.get('summary', '') or ''
        }
        sb.table('content_places').upsert(link_data, on_conflict='content_id,place_id').execute()
        print(f'  ✅ 연결: {name}')


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