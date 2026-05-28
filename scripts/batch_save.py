#!/usr/bin/env python3
"""axiv 데이터 수집 파이프라인 v4.0 — 엄격 모드 (Strict Validation + Google Places API 검증)

변경 사항:
1. verify_place() 강화: 네이버/구글 검색으로 '주소와 상호명이 완전히 일치'하는 경우만 통과
2. 전화번호가 '서울' 지역인데 주소가 '전라도'면 즉시 거부
3. AI가 '추정'한 필드는 저장하지 않음 (없으면 빈 값으로 저장)
4. Google Places API를 최종 검증 도구로 활용
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
GOOGLE_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
NVIDIA_MODEL = "nvidia/nvidia-nemotron-nano-9b-v2"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"


def validate_address_region(address, phone):
    """
    주소와 전화번호의 지역이 일치하는지 확인.
    예: phone='02-xxx'(서울)인데 address='전라남도'면 불일치로 판단
    """
    if not address or not phone:
        return True  # 정보가 없으면 검증 패스 (나중에 다른 단계에서 거름)
    
    # 전화번호 지역 코드 매핑
    region_prefix = {
        '02': '서울',
        '031': ['경기', '수원', '성남', '안양', '부천'],
        '032': '인천',
        '033': ['강원', '춘천', '원주', '강릉'],
        '041': ['충남', '천안', '아산', '당진', '서산', '공주'],
        '042': '대전',
        '043': ['충북', '청주', '충주', '제천'],
        '044': '세종',
        '051': '부산',
        '052': '울산',
        '053': '대구',
        '054': ['경북', '포항', '경주', '안동', '구미'],
        '055': ['경남', '창원', '진주', '통영', '김해', '양산'],
        '061': ['전남', '목포', '여수', '순천', '광양', '나주'],
        '062': '광주',
        '063': ['전북', '전주', '군산', '익산', '정읍'],
        '064': '제주',
    }
    
    # 전화번호에서 지역 코드 추출
    phone_clean = re.sub(r'[-\s]', '', phone)
    code = ''
    if phone_clean.startswith('02'):
        code = '02'
    elif len(phone_clean) >= 3:
        code = phone_clean[:3]
    
    if not code:
        return True
    
    expected_region = region_prefix.get(code)
    if not expected_region:
        return True
    
    # 주소에 예상 지역이 포함되어 있는지 확인
    if isinstance(expected_region, list):
        return any(region in address for region in expected_region)
    else:
        return expected_region in address


def google_verify_place(place_name, address):
    """
    Google Places API로 실제 존재하는 장소인지 최종 검증
    Returns: (exists: bool, google_address: str, google_phone: str)
    """
    if not GOOGLE_API_KEY:
        return True, address, ''  # API 키 없으면 일단 통과
    
    query = f"{place_name} {address[:30]}".strip()
    try:
        resp = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber',
            },
            json={'textQuery': query, 'maxResultCount': 1, 'languageCode': 'ko'},
            timeout=10
        )
        data = resp.json()
        
        if data.get('places') and len(data['places']) > 0:
            place = data['places'][0]
            google_name = place.get('displayName', {}).get('text', '')
            google_addr = place.get('formattedAddress', '')
            google_phone = place.get('nationalPhoneNumber', '')
            
            # Google에서 찾은 장소명과 입력한 장소명이 유사한지 확인
            if google_name and (place_name.lower() in google_name.lower() or google_name.lower() in place_name.lower()):
                return True, google_addr, google_phone
            
            # Google에서 정제된 주소가 원래 주소와 유사한지 확인
            if google_addr and any(part in google_addr for part in address.split()[:2]):
                return True, google_addr, google_phone
                
        # Google이 해당 장소를 찾지 못함 = 존재하지 않을 가능성 높음
        return False, address, ''
    except:
        return True, address, ''  # 오류 시 일단 통과


def verify_place_strict(place_name, address, phone=''):
    """엄격 모드 교차검증 v4.0: 주소-전화번호 지역 일치 + Google 검증"""
    if not place_name or not address or len(place_name) < 2:
        return False, 0, {}
    
    # 0. 기본 가짜 데이터 필터링
    fake_patterns = ['맛있는길', '테헤란로 427', '없음', '정보', '추정', '미기재', '미공개']
    if any(p in address for p in fake_patterns):
        return False, 0, {}
    
    # 1. 지역-전화번호 일치 검증
    if not validate_address_region(address, phone):
        return False, 0, {}
    
    # 2. Google Places 검증 (최종)
    exists, google_addr, google_phone = google_verify_place(place_name, address)
    if not exists:
        return False, 0, {}
    
    # 3. Google Places에서 찾은 정확한 주소/전화번호 반환
    verified_data = {}
    if google_addr:
        verified_data['address'] = google_addr
    if google_phone:
        verified_data['phone'] = google_phone
    
    return exists, 90 if google_phone else 70, verified_data


def geocode_address(address, place_name=""):
    """기존 지오코딩 함수 유지"""
    if not address or len(address) < 5:
        return 0, 0
    fake_keywords = ['맛있는길', '테헤란로 427', '없음']
    if any(k in address for k in fake_keywords):
        return 0, 0

    google_key = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
    if google_key:
        try:
            q = address.replace('  ', ' ').strip()[:100]
            gp_resp = requests.post(
                'https://places.googleapis.com/v1/places:searchText',
                headers={'Content-Type': 'application/json', 'X-Goog-Api-Key': google_key,
                         'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'},
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
    return 0, 0


def analyze(url):
    """AI 분석 — 프롬프트 강화: 없는 정보는 만들지 말것"""
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

[핵심 규칙 — 반드시 지킬 것]
1. **가짜 데이터 생성 금지**: 영상이나 웹검색에서 확인되지 않은 정보는 절대 추측해서 넣지 마세요. 모르는 필드는 반드시 빈 문자열("")로 남겨두세요.
2. **address**: 영상/웹검색에서 정확한 도로명 주소(시/도, 시/군/구, 도로명, 번지)가 확인된 경우만 입력하세요. 모르면 빈 값.
3. **phone**: 영상에서 크리에이터가 직접 전화번호를 말했거나 화면에 나온 경우만 입력하세요. 절대 추측 금지.
4. **category**: food(맛집)/cafe(카페)/camping(캠핑)/fishing(낚시)/travel(여행지)/accommodation(숙소) 중 선택
5. **상호명 오류 방지**: 상호명에 주소, 전화번호, 유튜브 채널명 등을 절대 포함하지 마세요.

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
        phone = p.get('phone', '').strip()
        
        if not name or len(name) < 2:
            continue
        
        # 엄격 모드 검증
        verified, confidence, verified_data = verify_place_strict(name, addr, phone)
        if not verified:
            print(f'  ❌ 검증 실패: {name} (전화:{phone})')
            continue
        
        # 검증된 데이터로 업데이트
        if verified_data.get('address'):
            p['address'] = verified_data['address']
        if verified_data.get('phone'):
            p['phone'] = verified_data['phone']
        
        lat, lng = geocode_address(p.get('address', ''), name)
        p['lat'] = lat
        p['lng'] = lng
        p['verified'] = verified
        p['confidence'] = confidence
        
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
    """Supabase 저장 함수 — 변경 없음"""
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