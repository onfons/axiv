#!/usr/bin/env python3
"""누락 데이터 파악 + 실제 샘플 출력"""
import os, sys
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(os.getenv('NEXT_PUBLIC_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
r = sb.table('places').select('id','place_name','address','representative_menu','business_hours','phone','place_description').execute()

data = r.data
t = len(data)

mm = sum(1 for p in data if not (p.get('representative_menu') or '').strip())
mh = sum(1 for p in data if not (p.get('business_hours') or '').strip())
mp = sum(1 for p in data if not (p.get('phone') or '').strip())
md = sum(1 for p in data if not (p.get('place_description') or '').strip())

print(f"총 places: {t}개")
print(f"\n누락 현황:")
print(f"  메뉴/가격: {mm}개 없음 ({100*mm//t}%)")
print(f"  영업시간:  {mh}개 없음 ({100*mh//t}%)")
print(f"  전화번호:  {mp}개 없음 ({100*mp//t}%)")
print(f"  설명:      {md}개 없음 ({100*md//t}%)")

print(f"\n샘플 누락 장소 (메뉴+영업시간+전화 중 2개 이상):")
count = 0
for p in data:
    missing = 0
    for f in ['representative_menu','business_hours','phone']:
        if not (p.get(f) or '').strip():
            missing += 1
    if missing >= 2:
        print(f"  {p['place_name'][:25]:25s} | {p.get('address','')[:40]}")
        count += 1
        if count >= 15:
            break