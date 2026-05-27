#!/usr/bin/env python3
"""기존 저장된 1000개 장소 모두 Google Places API로 상세정보 보강"""
import os, sys, json, requests, re, time
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

GOOGLE_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY', '')

# 전체 places 조회
res = sb.table('places').select('id, place_name, address, phone, business_hours, representative_menu, lat, lng').execute()
data = res.data or []
total = len(data)

print(f"전체 places: {total}개")

# 누락 필드 통계
needs_phone = [p for p in data if not p.get('phone') or p['phone'] == '']
needs_hours = [p for p in data if not p.get('business_hours') or p['business_hours'] == '']
needs_menu = [p for p in data if not p.get('representative_menu') or p['representative_menu'] == '']
needs_coords = [p for p in data if not p.get('lat') or float(p.get('lat', 0)) == 0]

print(f"전화번호 필요: {len(needs_phone)}개")
print(f"영업시간 필요: {len(needs_hours)}개")
print(f"메뉴 필요: {len(needs_menu)}개")
print(f"좌표 필요: {len(needs_coords)}개")

# 전화번호 필요한 장소부터 Google Places 검색
targets = needs_phone[:300]  # 300개 먼저

print(f"\nGoogle Places 검색 시작... (300개)")
print(f"{'='*50}")

success = 0
fail = 0
for i, p in enumerate(targets):
    name = p.get('place_name', '')
    addr = p.get('address', '') or ''
    
    query = f"{name} {addr[:30]}".strip()
    
    try:
        resp = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.regularOpeningHours,places.websiteUri',
            },
            json={'textQuery': query, 'maxResultCount': 1, 'languageCode': 'ko'},
            timeout=10
        )
        result = resp.json()
        
        if result.get('places') and len(result['places']) > 0:
            place = result['places'][0]
            updates = {}
            
            phone = place.get('nationalPhoneNumber', '')
            hours = place.get('regularOpeningHours', {})
            loc = place.get('location', {})
            
            if phone:
                updates['phone'] = phone
            if hours and 'weekdayDescriptions' in hours:
                updates['business_hours'] = '\n'.join(hours['weekdayDescriptions'])
            if loc.get('latitude') and loc.get('longitude'):
                updates['lat'] = loc['latitude']
                updates['lng'] = loc['longitude']
            
            if updates:
                sb.table('places').update(updates).eq('id', p['id']).execute()
                success += 1
                if i < 10:
                    print(f"  ✅ [{i+1}] {name[:20]}: 전화={phone[:15] or 'X'} | 시간={bool(hours)}")
        else:
            fail += 1
    
    except Exception as e:
        fail += 1
    
    if (i+1) % 50 == 0:
        print(f"  진행: {i+1}/{len(targets)} (성공={success}, 실패={fail})")

print(f"\n✅ Google Places 1차 완료: {success}개 업데이트, {fail}개 실패")

# 전화번호 그래도 없는 장소 → Naver fallback (100개만)
remaining_phone = sb.table('places').select('id, place_name, address').is_('phone', 'eq.').execute()
remaining = remaining_phone.data or []

if remaining:
    print(f"\nNaver 검색 fallback 시작... ({len(remaining)}개)")
    for i, p in enumerate(remaining[:100]):
        name = p.get('place_name', '')
        addr = p.get('address', '') or ''
        
        try:
            import urllib.parse
            query = urllib.parse.quote(f"{name} {addr[:15]}")
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            resp = requests.get(
                f'https://search.naver.com/search.naver?where=nexearch&query={query}',
                headers=headers, timeout=8
            )
            html = resp.text
            
            import re
            phones = re.findall(r'(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})', html)
            real_phones = [ph for ph in phones if not re.match(r'^0{2,}', ph) and not re.match(r'^0+$', ph)]
            
            if real_phones:
                from collections import Counter
                phone = Counter(real_phones).most_common(1)[0][0]
                sb.table('places').update({'phone': phone}).eq('id', p['id']).execute()
                
        except:
            pass
        
        time.sleep(0.3)
        
        if (i+1) % 20 == 0:
            print(f"  Naver 진행: {i+1}/{len(remaining)}")

# 최종 결과 확인
print(f"\n{'='*50}")
print(f"✅ 최종 보강 완료! 결과 확인 중...")

res2 = sb.table('places').select('id, phone, business_hours, representative_menu, lat, lng').execute()
data2 = res2.data or []
total2 = len(data2)

has_phone = [p for p in data2 if p.get('phone') and len(p['phone']) > 5]
has_hours = [p for p in data2 if p.get('business_hours') and len(p['business_hours']) > 5]
has_menu = [p for p in data2 if p.get('representative_menu') and len(p['representative_menu']) > 5]
has_coords = [p for p in data2 if p.get('lat') and float(p.get('lat', 0)) != 0]

print(f"\n{'─'*50}")
print(f"{'항목':<20} {'보유':<10} {'비율':<10}")
print(f"{'─'*50}")
print(f"{'전화번호':<20} {len(has_phone):<10} {len(has_phone)/total2*100:>6.1f}%")
print(f"{'영업시간':<20} {len(has_hours):<10} {len(has_hours)/total2*100:>6.1f}%")
print(f"{'메뉴/가격':<20} {len(has_menu):<10} {len(has_menu)/total2*100:>6.1f}%")
print(f"{'좌표(위경도)':<20} {len(has_coords):<10} {len(has_coords)/total2*100:>6.1f}%")
print(f"{'─'*50}")
print(f"{'총 장소':<20} {total2:<10} 100.0%")