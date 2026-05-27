"""Google Places API 매장 상세정보 보강 모듈 — 정확한 필드 매핑"""
import os, sys, json, requests, re, time
from dotenv import load_dotenv

load_dotenv('/home/ubuntu/projects/axiv/.env.local')
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')

GOOGLE_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')


def parse_business_hours(business_hours_str):
    """
    Google Places API의 'regularOpeningHours.weekdayDescriptions'을 분석하여
    영업시간/브레이크타임/주차정보/웨이팅팁 분리.
    
    Google 응답 예시:
      "월요일: 오전 8:00~10:00, 오후 12:00~3:00"
      또는 기존 AI 추출처럼 섞인 문자열:
      "은 09시 ~21시까지이고 중간에 브레이크 타임이 15:30 ~17:00까지 있습니다 주차는..."
    
    Returns: dict with business_hours, break_time, parking_info, waiting_tip
    """
    if not business_hours_str or len(business_hours_str) < 5:
        return {}
    
    text = business_hours_str.strip()
    result = {}
    
    # Case 1: Google Places 포맷 (요일별 시간)
    if '요일:' in text or '요일 :' in text:
        result['business_hours'] = text
        return result
    
    # Case 2: AI 추출 포맷 (브레이크타임/주차/웨이팅 포함)
    # 브레이크타임
    bt_patterns = [
        r'(?:중간에\s*)?브레이크 타임(?:은|이)?\s*([\d:~]+(?:\s*[~\-]\s*[\d:~]+))',
        r'브레이크\s*타임\s*:\s*([\d:~]+(?:\s*[~\-]\s*[\d:~]+))',
        r'(?:쉬는시간|break\s*time)\s*([\d:~]+(?:\s*[~\-]\s*[\d:~]+))',
        r'([\d:~]+\s*~\s*[\d:~]+)\s*브레이크',
        r'([\d:~]+\s*~\s*[\d:~]+)\s*휴게',
        r'중간에\s*([\d:~]+(?:\s*[~\-]\s*[\d:~]+)).*?까지',
    ]
    for pat in bt_patterns:
        m = re.search(pat, text)
        if m:
            result['break_time'] = m.group(1).strip()
            break
    
    # 주차정보
    pk_patterns = [
        r'(주차\s*(?:는|:\s*)?[^。.!?]*(?:주차장|가능|불가|없[음다]|무료|유료)[^。.!?]*)',
        r'(자체\s*주차\s*[^。.!?]*(?:장|공간)[^。.!?]*)',
        r'(공영\s*주차[^。.!?]*(?:이용|가능)[^。.!?]*)',
    ]
    for pat in pk_patterns:
        m = re.search(pat, text)
        if m:
            result['parking_info'] = m.group(1).strip()
            break
    
    # 웨이팅/인원
    wa_patterns = [
        r'(\d+\s*인\s*이상)',
        r'(웨이팅[^。.!?]*)',
        r'(대기[^。.!?]*(?:인원|팀|시간))',
    ]
    for pat in wa_patterns:
        m = re.search(pat, text)
        if m:
            result['waiting_tip'] = m.group(1).strip()
            break
    
    # 영업시간 정리 (브레이크/주차/웨이팅 제거)
    clean = text
    clean = re.sub(r'(중간에\s*)?브레이크 타임[^。.!?]*[。.!]?\s*', '', clean)
    clean = re.sub(r'주차[^。.!?]*[。.!]?\s*', '', clean)
    clean = re.sub(r'\d+인\s*이상\s*', '', clean)
    clean = re.sub(r'웨이팅[^。.!?]*[。.!]?\s*', '', clean)
    clean = re.sub(r'입니다\s*$', '', clean).strip()
    
    # 영업시간 추출
    if not clean:
        clean = text
    
    result['business_hours'] = clean
    
    return result


def search_google_places(place_name, address=""):
    """
    Google Places API (New) 검색 — 정확한 필드 매핑
    Returns: {phone, business_hours, break_time, parking_info, waiting_tip, 
              lat, lng, formatted_address, website} or None
    """
    if not GOOGLE_API_KEY:
        print("  ⚠️ Google API Key 없음")
        return None
    
    query = f"{place_name} {address[:50]}".strip()
    
    try:
        resp = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': (
                    'places.displayName,places.formattedAddress,places.location,'
                    'places.nationalPhoneNumber,places.regularOpeningHours,'
                    'places.websiteUri,places.priceLevel'
                ),
            },
            json={'textQuery': query, 'maxResultCount': 1, 'languageCode': 'ko'},
            timeout=10
        )
        data = resp.json()
        if not data.get('places') or len(data['places']) == 0:
            return None
        
        place = data['places'][0]
        result = {}
        
        # 전화번호
        result['phone'] = place.get('nationalPhoneNumber', '') or ''
        
        # 영업시간 → 파싱해서 비즈니스아워/브레이크타임/주차/웨이팅 분리
        hours = place.get('regularOpeningHours', {})
        if hours and 'weekdayDescriptions' in hours:
            raw_hours = '\n'.join(hours['weekdayDescriptions'])
            parsed = parse_business_hours(raw_hours)
            result.update(parsed)
        else:
            result['business_hours'] = ''
            result['break_time'] = ''
        
        # 좌표
        loc = place.get('location', {})
        result['lat'] = loc.get('latitude', 0)
        result['lng'] = loc.get('longitude', 0)
        
        # 정제된 주소
        result['formatted_address'] = place.get('formattedAddress', '')
        
        # 웹사이트
        result['website'] = place.get('websiteUri', '')
        
        return result
    except Exception as e:
        print(f"  ⚠️ Google API 오류: {e}")
        return None


def enrich_place(place_id, place_name, address):
    """
    단일 매장 상세정보 보강 (Google Places → Naver fallback 순서)
    
    Returns: DB update용 dict
    """
    updates = {}
    
    # 1. Google Places API
    print(f"  🔍 Google 검색: {place_name}...", end=' ')
    google = search_google_places(place_name, address)
    if google:
        print("✅")
        if google.get('phone'):
            updates['phone'] = google['phone']
        if google.get('business_hours'):
            updates['business_hours'] = google['business_hours']
        if google.get('break_time'):
            updates['break_time'] = google['break_time']
        if google.get('parking_info'):
            updates['parking_info'] = google['parking_info']
        if google.get('waiting_tip'):
            updates['waiting_tip'] = google['waiting_tip']
        if google.get('lat') and google.get('lng'):
            updates['lat'] = google['lat']
            updates['lng'] = google['lng']
        if google.get('formatted_address'):
            updates['address'] = google['formatted_address']
    else:
        print("❌")
    
    return updates