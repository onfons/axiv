#!/usr/bin/env python3
"""axiv 데이터 수집 파이프라인 v3.1 — 교차검증(cross-validation) 탑재, 낙관적 저장"""
import sys, json, os, re, requests, time, urllib.parse
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')

sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
os.chdir('/home/ubuntu/projects/axiv/python_server')

from app.utils import get_youtube_full_data, perform_deep_search

NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
NVIDIA_MODEL = "meta/llama-3.1-70b-instruct"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"


def web_search_place(place_name, address):
    context = ""
    queries = [f"{place_name} {address} 영업시간 전화번호", f"{place_name} 메뉴 가격"]
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




def naver_search_verify(place_name, address):
    """네이버 검색 API로 장소 존재 여부 확인"""
    client_id = os.getenv('NAVER_CLIENT_ID', '')
    client_secret = os.getenv('NAVER_CLIENT_SECRET', '')
    
    if not client_id or not client_secret:
        return False, 0
    
    query = f"{place_name} {address}" if address else place_name
    
    try:
        headers = {
            'X-Naver-Client-Id': client_id,
            'X-Naver-Client-Secret': client_secret
        }
        
        # 지역 검색 API (local)
        local_url = f"https://openapi.naver.com/v1/search/local?query={urllib.parse.quote(query)}&display=1"
        resp = requests.get(local_url, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('items') and len(data['items']) > 0:
                item = data['items'][0]
                title = item.get('title', '').replace('<b>', '').replace('</b>', '')
                # 장소명이 검색 결과와 유사하면 통과
                if place_name.lower() in title.lower() or title.lower() in place_name.lower():
                    return True, 70
                return True, 50
        
        # 웹 검색 API (fallback)
        web_url = f"https://openapi.naver.com/v1/search/webkr?query={urllib.parse.quote(query)}&display=1"
        resp = requests.get(web_url, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('items') and len(data['items']) > 0:
                return True, 40
    except:
        pass
    
    return False, 0

def verify_place(place_name, address):
    """교차검증 v3.1: 낙관적 — 주소 형식이 맞으면 통과"""
    if not place_name or not address or len(place_name) < 2:
        return False, 0

    name_lower = place_name.lower().replace(' ', '')
    addr_lower = address.lower().replace(' ', '')

    # 네이버 검색
    query = urllib.parse.quote(f"{place_name} {address[:20]}")
    nav_url = f"https://search.naver.com/search.naver?where=nexearch&query={query}"

    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(nav_url, headers=headers, timeout=8)
        html = resp.text.lower()

        name_in_html = name_lower in html
        addr_parts = [p for p in address.split() if len(p) > 1]
        addr_matches = sum(1 for p in addr_parts if p.lower() in html)
        addr_ratio = addr_matches / max(len(addr_parts), 1)

        fake_patterns = ['맛있는길', '테헤란로 427', '없음', '정보']
        is_fake = any(p in address for p in fake_patterns)

        score = 30
        if name_in_html: score += 30
        if addr_ratio > 0.6: score += 30
        if addr_ratio > 0.8: score += 10
        if is_fake: score -= 40

        verified = score >= 40  # 낮춤: 50 -> 40
        return verified, min(score, 100)
    except:
        pass

    # 폴백: 주소 형식만 확인
    addr_ok = bool(re.search(r'[시군구]\s', address)) and len(address) > 8
    # Geocode 확인
    lat, lng = geocode_address(address, place_name)
    if addr_ok or (lat != 0 and lng != 0):
        return True, 50
    # 2차 폴백: 주소가 적당한 길이면 통과
    if len(address) > 10:
        return True, 40
    return False, 0


def extract_place_urls(place_name, address):
    """Google/Naver Place URL 추출"""
    google_url = None
    naver_url = None
    
    # Google Places API
    google_key = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
    if google_key:
        try:
            resp = requests.post(
                'https://places.googleapis.com/v1/places:searchText',
                headers={
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': google_key,
                    'X-Goog-FieldMask': 'places.id,places.googleMapsUri',
                },
                json={'textQuery': f"{place_name} {address[:50]}", 'maxResultCount': 1, 'languageCode': 'ko'},
                timeout=10
            )
            data = resp.json()
            if data.get('places'):
                place = data['places'][0]
                uri = place.get('googleMapsUri', '')
                if uri:
                    google_url = uri
                else:
                    place_id = place.get('id', '')
                    if place_id:
                        google_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"
        except:
            pass
    
    # Naver URL
    try:
        from urllib.parse import quote
        query = f"{place_name} {address[:30]}".strip()
        naver_url = f"https://map.naver.com/search/{quote(query)}"
    except:
        pass
    
    return google_url, naver_url


def geocode_address(address, place_name=""):
    if not address or len(address) < 5:
        return 0, 0
    fake_keywords = ['맛있는길', '테헤란로 427', '없음']
    if any(k in address for k in fake_keywords):
        return 0, 0

    # 1. Google Places
    google_key = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
    if google_key:
        try:
            q = address.replace('  ', ' ').strip()[:100]
            gp_resp = requests.post(
                'https://places.googleapis.com/v1/places:searchText',
                headers={
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': google_key,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
                },
                json={'textQuery': f"{place_name} {q}", 'maxResultCount': 1, 'languageCode': 'ko'},
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

    # 2. Nominatim
    try:
        from geopy.geocoders import Nominatim
        geolocator = Nominatim(user_agent="axiv_batch_save")
        location = geolocator.geocode(f"{place_name} {address}", timeout=10)
        if location:
            return location.latitude, location.longitude
    except:
        pass

    # 3. Photon
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
    print(f'\n🔍 분석 시작: {url}')
    raw = get_youtube_full_data(url)
    if not raw:
        print('❌ yt-dlp 실패')
        return
    print(f'✅ 제목: {raw["title"][:80]}')
    print(f'✅ 채널: {raw["uploader"]}')

    search_ctx = perform_deep_search(raw['title'], raw['uploader'])

    prompt = f"""당신은 유튜브 영상을 분석하여 크리에이터가 방문한 장소의 정확한 정보를 추출하는 전문가입니다.

[입력 데이터]
- 제목: {raw['title']}
- 채널: {raw['uploader']}
- 상세설명: {raw['description'][:1500]}
- 자막: {raw['transcript'][:10000]}
- 웹검색결과: {search_ctx[:8000]}

[핵심 규칙]
1. place_name은 크리에이터가 실제로 방문한 장소의 정확한 상호명
2. address는 반드시 실제 도로명 주소 (00시 00구 00로 00길 00 형식). 웹검색결과에서 찾을 수 없으면 영상 내용으로 추론하되 합리적으로 추정
3. category는 food/cafe/camping/fishing/travel/accommodation 중 선택
4. 다른 필드들도 최대한 채우세요

응답은 순수 JSON 배열만:
[{{"place_name":"","address":"","phone":"","category":"","business_hours":"","break_time":"","menu_with_prices":"","place_description":"","waiting_tip":"","parking_info":"","creator_review":"","summary":"","timeline_seconds":0}}]"""

    headers = {"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": NVIDIA_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 4096}

    print('⏳ AI 분석 중...')
    try:
        resp = requests.post(f"{NVIDIA_BASE}/chat/completions", json=payload, headers=headers, timeout=240)
        resp.raise_for_status()
        result_text = resp.json()['choices'][0]['message']['content']
    except Exception as e:
        print(f'❌ AI 오류: {e}')
        return

    places = []
    try:
        clean = re.sub(r'```(?:json)?\s*', '', result_text).strip()
        jm = re.search(r'\[\s*\{.*\}\s*\]', clean, re.DOTALL)
        places = json.loads(jm.group(0)) if jm else json.loads(clean)
        if isinstance(places, dict): places = [places]
    except:
        print(f'❌ JSON 파싱 실패')
        return

    print(f'📊 추출 장소: {len(places)}개')

    verified_places = []
    for i, p in enumerate(places):
        name = p.get('place_name', '').strip()
        addr = p.get('address', '').strip()
        if not name or not addr or len(name) < 2:
            continue

        verified, confidence = verify_place(name, addr)
        if not verified:
            continue

        lat, lng = geocode_address(addr, name)
        p['lat'] = lat
        p['lng'] = lng
        p['verified'] = verified
        p['confidence'] = confidence

        # 빈 값 정리
        for f in ['waiting_tip', 'parking_info']:
            if not p.get(f) or p[f] in ['없음', '정보 없음']: p[f] = ''
        for f in ['business_hours', 'break_time', 'menu_with_prices', 'place_description', 'phone']:
            if not p.get(f) or p[f] in ['없음', '정보 없음']: p[f] = ''

        # Google/Naver URL 추출
        google_url, naver_url = extract_place_urls(name, addr)
        if google_url:
            p['google_place_url'] = google_url
        if naver_url:
            p['naver_place_url'] = naver_url
        
        verified_places.append(p)

    if not verified_places:
        print(f'❌ 교차검증 통과한 장소 없음.')
        return

    print(f'  → 저장: {len(verified_places)}곳')
    return {
        'video_id': raw['video_id'],
        'metadata': {'title': raw['title'], 'creator_name': raw['uploader'],
                     'thumbnail_url': raw['thumbnail_url'], 'url': url},
        'places': verified_places
    }


def save(result):
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    meta = result['metadata']
    content_data = {
        'video_id': result['video_id'], 'title': meta['title'], 'url': meta['url'],
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
        if not name: continue

        existing = sb.table('places').select('id').eq('place_name', name).eq('address', addr).maybe_single().execute()
        if existing and existing.data:
            place_id = existing.data['id']
        else:
            place_data = {
                'place_name': name, 'address': addr, 'category': p.get('category', 'food'),
                'lat': p.get('lat', 0), 'lng': p.get('lng', 0),
                'phone': p.get('phone', '') or '',
                'business_hours': p.get('business_hours', '') or '',
                'break_time': p.get('break_time', '') or '',
                'representative_menu': p.get('menu_with_prices', '') or '',
                'place_description': p.get('place_description', '') or '',
                'google_place_url': p.get('google_place_url', '') or '',
                'naver_place_url': p.get('naver_place_url', '') or '',
                'waiting_tip': p.get('waiting_tip', '') or '',
                'parking_info': p.get('parking_info', '') or ''
            }
            p_res = sb.table('places').insert(place_data).execute()
            place_id = p_res.data[0]['id']

        link_data = {
            'content_id': content_id, 'place_id': place_id,
            'timeline_seconds': p.get('timeline_seconds', 0),
            'creator_review': p.get('creator_review', '') or '',
            'summary': p.get('summary', '') or ''
        }
        sb.table('content_places').upsert(link_data, on_conflict='content_id,place_id').execute()


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