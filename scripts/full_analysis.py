#!/usr/bin/env python3
"""DB 데이터 부족한 부분 상세 분석"""
import os, sys, re
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

places = sb.table('places').select('*').execute()
contents = sb.table('contents').select('*').execute()

# 카테고리별
cats = {}
for p in places.data:
    cats[p.get('category','?')] = cats.get(p.get('category','?'), 0) + 1

# 지역별
CITIES = {
    '서울': ['서울'], '부산': ['부산'], '대구': ['대구'], '인천': ['인천'],
    '광주': ['광주'], '대전': ['대전'], '울산': ['울산'],
    '경기': ['경기', '수원', '성남', '고양', '용인', '부천', '안산', '화성', '평택'],
    '강원': ['강원', '춘천', '원주', '강릉', '속초', '동해'],
    '충북': ['충북', '청주', '충주', '제천'],
    '충남': ['충남', '천안', '공주', '보령', '아산', '서산'],
    '전북': ['전북', '전주', '군산', '익산'],
    '전남': ['전남', '목포', '여수', '순천', '광양'],
    '경북': ['경북', '포항', '경주', '김천', '안동', '구미', '영주'],
    '경남': ['경남', '창원', '김해', '진주', '양산', '거제', '통영'],
    '제주': ['제주', '서귀포'],
    '해외': []  # 한국 주소 패턴 없으면 해외로 분류
}

city_counts = {c: 0 for c in CITIES}
overseas = 0

for p in places.data:
    addr = p.get('address', '') or ''
    matched = False
    for city, keywords in CITIES.items():
        if city == '해외': continue
        for kw in keywords:
            if kw in addr:
                city_counts[city] += 1
                matched = True
                break
        if matched: break
    if not matched and addr:
        if not re.search(r'[시군구도]\\s', addr) and not re.search(r'로\\d|길\\d|동\\s', addr):
            city_counts['해외'] += 1

print(f"=== DB 현황: {places.count} places, {contents.count} contents ===\n")

print("📊 카테고리별:")
for c, n in sorted(cats.items(), key=lambda x: -x[1]):
    bar = '■' * min(n//5, 40)
    print(f"  {c:15s} {n:4d} {bar}")

print("\n🗺️ 지역별:")
for city, cnt in sorted(city_counts.items(), key=lambda x: -x[1]):
    if cnt == 0: continue
    bar = '■' * min(cnt//3, 30)
    print(f"  {city:6s} {cnt:4d} {bar}")

print(f"\n🔴 부족 카테고리 (15개 미만):")
for c, n in sorted(cats.items(), key=lambda x: x[1]):
    if n < 15:
        print(f"  {c}: {n}개 → 목표 +{15-n}")

print(f"\n🔴 부족 지역 (10개 미만):")
for city, cnt in sorted(city_counts.items(), key=lambda x: x[1]):
    if cnt < 10 and cnt > 0:
        print(f"  {city}: {cnt}개 → 목표 +{10-cnt}")