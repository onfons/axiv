#!/usr/bin/env python3
"""Google Places API를 활용한 매장 상세정보 보강 스킬"""
import os, sys, json, requests, re, time
from dotenv import load_dotenv

load_dotenv('/home/ubuntu/projects/axiv/.env.local')
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')

GOOGLE_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY', '')

def search_google_places(place_name, address=""):
    """
    Google Places API (New)로 매장 상세정보 검색
    Returns: {phone, hours, lat, lng, formatted_address} or None
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
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.regularOpeningHours,places.websiteUri,places.priceLevel',
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
        result['phone'] = place.get('nationalPhoneNumber', '')
        
        # 영업시간
        hours = place.get('regularOpeningHours', {})
        if hours and 'weekdayDescriptions' in hours:
            result['business_hours'] = '\n'.join(hours['weekdayDescriptions'])
        else:
            result['business_hours'] = ''
        
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


def search_naver_place(place_name, address=""):
    """
    Naver 검색으로 매장 전화번호 추출
    """
    query = f"{place_name} {address[:15]}".strip()
    
    try:
        # 검색
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        resp = requests.get(
            f'https://search.naver.com/search.naver?where=nexearch&query={query}',
            headers=headers, timeout=8
        )
        html = resp.text
        
        # 전화번호 패턴
        phone_patterns = [
            r'(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})',
            r'(1\d{2}[-.\s]?\d{3,4}[-.\s]?\d{4})',
        ]
        
        phones = []
        for pat in phone_patterns:
            matches = re.findall(pat, html)
            for m in matches:
                m_clean = re.sub(r'[\s.-]', '-', m)
                # 가짜번호 필터링
                if not re.match(r'^0{2,}', m_clean) and not re.match(r'^0+$', m_clean):
                    phones.append(m_clean)
        
        if phones:
            # 가장 흔한 전화번호
            from collections import Counter
            most_common = Counter(phones).most_common(1)[0][0]
            return {'phone': most_common}
    except:
        pass
    
    return None


def extract_menu_with_ai(place_name, address=""):
    """
    NVIDIA AI로 메뉴/가격 정보 추출 (웹검색 기반)
    """
    if not NVIDIA_API_KEY:
        return None
    
    # DuckDuckGo 검색
    web_context = ""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as dg:
            results = list(dg.text(f"{place_name} 메뉴 가격", max_results=3))
            for r in results:
                web_context += r['body'] + '\n'
    except:
        pass
    
    if not web_context:
        return None
    
    prompt = f"""다음 웹검색 결과에서 '{place_name}'의 메뉴와 가격 정보를 추출하세요.
    
웹검색결과:
{web_context[:2000]}

응답 형식:
- 메뉴1 - 가격1
- 메뉴2 - 가격2
...
(정보가 없으면 빈 문자열 반환)"""
    
    try:
        headers = {"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": "nvidia/nvidia-nemotron-nano-9b-v2",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 1024
        }
        resp = requests.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            json=payload, headers=headers, timeout=30
        )
        text = resp.json()['choices'][0]['message']['content'].strip()
        return {'representative_menu': text}
    except:
        return None


def enrich_place(place_id, place_name, address):
    """
    단일 매장 상세정보 보강 (Google → Naver → AI menu 순서)
    """
    updates = {}
    
    # 1. Google Places API (가장 신뢰도 높음)
    print(f"  🔍 Google 검색: {place_name}...", end=' ')
    google = search_google_places(place_name, address)
    if google:
        print("✅")
        if google.get('phone'):
            updates['phone'] = google['phone']
        if google.get('business_hours'):
            updates['business_hours'] = google['business_hours']
        if google.get('lat') and google.get('lng'):
            updates['lat'] = google['lat']
            updates['lng'] = google['lng']
        if google.get('formatted_address') and len(google['formatted_address']) > len(updates.get('address', '')):
            updates['address'] = google['formatted_address']
    else:
        print("❌")
        
        # 2. Google 실패 시 Naver (전화번호만)
        if not updates.get('phone'):
            print(f"  🔍 Naver 검색: {place_name}...", end=' ')
            naver = search_naver_place(place_name, address)
            if naver and naver.get('phone'):
                updates['phone'] = naver['phone']
                print("✅")
            else:
                print("❌")
    
    # 3. NVIDIA AI로 메뉴 추출
    if not updates.get('representative_menu'):
        print(f"  🤖 AI 메뉴 추출: {place_name}...", end=' ')
        menu = extract_menu_with_ai(place_name, address)
        if menu and menu.get('representative_menu'):
            updates['representative_menu'] = menu['representative_menu']
            print("✅")
        else:
            print("❌")
    
    return updates