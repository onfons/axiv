#!/usr/bin/env python3
"""주요 도시별 장소 데이터 현황 분석"""
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

# 주요 도시 패턴
CITIES = {
    '서울': ['서울'],
    '부산': ['부산'],
    '대구': ['대구'],
    '인천': ['인천'],
    '광주': ['광주'],
    '대전': ['대전'],
    '울산': ['울산'],
    '경기': ['경기', '수원', '성남', '고양', '용인', '부천', '안산', '화성', '평택', '의정부', '파주', '김포', '광주', '하남', '이천', '여주', '양평', '가평', '포천', '남양주', '구리'],
    '강원': ['강원', '춘천', '원주', '강릉', '속초', '동해', '태백', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'],
    '충북': ['충북', '청주', '충주', '제천'],
    '충남': ['충남', '천안', '공주', '보령', '아산', '서산'],
    '전북': ['전북', '전주', '군산', '익산'],
    '전남': ['전남', '목포', '여수', '순천', '광양'],
    '경북': ['경북', '포항', '경주', '김천', '안동', '구미', '영주'],
    '경남': ['경남', '창원', '김해', '진주', '양산', '거제', '통영'],
    '제주': ['제주', '서귀포'],
}

city_counts = {c: 0 for c in CITIES}

for p in places.data:
    addr = p.get('address', '') or ''
    for city, keywords in CITIES.items():
        for kw in keywords:
            if kw in addr:
                city_counts[city] += 1
                break

print("=== 지역별 장소 데이터 현황 ===")
print(f"총 places: {places.count}개\n")

# 정렬해서 출력
for city, cnt in sorted(city_counts.items(), key=lambda x: -x[1]):
    bar = '■' * min(cnt, 50)
    print(f"  {city:6s} {cnt:4d}개 {bar}")

print(f"\n서울 외 합계: {sum(v for k,v in city_counts.items() if k != '서울')}개")
print(f"서울 비중: {city_counts['서울']}/{places.count} ({100*city_counts['서울']/places.count:.0f}%)")