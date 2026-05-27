#!/usr/bin/env python3
"""기존 DB 장소 URL 일괄 보강 — Google Places API + Naver"""
import os, sys, requests
from urllib.parse import quote

sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')

from supabase import create_client

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
GOOGLE_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_google_url(place_name, address):
    if not GOOGLE_KEY:
        return None
    try:
        resp = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_KEY,
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
                return uri
            place_id = place.get('id', '')
            if place_id:
                return f"https://www.google.com/maps/place/?q=place_id:{place_id}"
    except Exception as e:
        print(f"  ⚠️ Google 오류: {e}")
    return None

def get_naver_url(place_name, address):
    try:
        query = f"{place_name} {address[:30]}".strip()
        return f"https://map.naver.com/search/{quote(query)}"
    except:
        return None

# URL이 없는 장소 목록 조회
print("🔍 URL이 없는 장소 조회 중...")
res = sb.table('places').select('id, place_name, address').or_('google_place_url.is.null,naver_place_url.is.null').execute()
targets = res.data or []
print(f"📊 보강 대상: {len(targets)}개\n")

success = 0
for i, p in enumerate(targets):
    name = p['place_name']
    addr = p.get('address', '') or ''
    
    print(f"[{i+1}/{len(targets)}] {name}")
    
    updates = {}
    google_url = get_google_url(name, addr)
    naver_url = get_naver_url(name, addr)
    
    if google_url:
        updates['google_place_url'] = google_url
        print(f"  ✅ Google: {google_url[:50]}...")
    if naver_url:
        updates['naver_place_url'] = naver_url
        print(f"  ✅ Naver: {naver_url[:50]}...")
    
    if updates:
        try:
            sb.table('places').update(updates).eq('id', p['id']).execute()
            success += 1
        except Exception as e:
            print(f"  ❌ DB 업데이트 실패: {e}")
    
    # Rate limit 방지
    import time
    time.sleep(0.3)

print(f"\n✅ 완료: {success}/{len(targets)}개 URL 보강 완료")
