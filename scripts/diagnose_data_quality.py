#!/usr/bin/env python3
"""데이터 품질 종합 진단 스크립트"""
import os, sys
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

# 모든 데이터 가져오기
res = sb.table('places').select('*').execute()
data = res.data or []
total = len(data)

issues = {
    'address_with_phone': 0,
    'missing_address': 0,
    'missing_name': 0,
    'weird_tags': 0,
    'missing_menu': 0,
    'missing_phone': 0,
}

samples = []

for p in data:
    name = p.get('place_name') or ''
    addr = p.get('address') or ''
    phone = p.get('phone') or ''
    menu = p.get('menu') or ''
    
    # 1. 주소에 전화번호 포함 여부 (잘못된 파싱)
    if any(char.isdigit() for char in addr) and ('-' in addr or '010' in addr or '02-' in addr):
        issues['address_with_phone'] += 1
        
    # 2. 주소 누락
    if not addr or addr.strip() == '' or '주소 미상' in addr:
        issues['missing_address'] += 1
        
    # 3. 상호명 누락
    if not name or name.strip() == '':
        issues['missing_name'] += 1
        
    # 4. 이상한 태그/특수문자 (예: JSON 찌꺼기, HTML 태그)
    if any(tag in name for tag in ['{', '}', '[', ']', '<', '>', '\"']):
        issues['weird_tags'] += 1
        
    # 5. 메뉴/가격 정보 누락
    if not menu or menu.strip() == '':
        issues['missing_menu'] += 1
        
    # 6. 전화번호 누락
    if not phone or phone.strip() == '':
        issues['missing_phone'] += 1

    # 샘플 수집 (문제가 있는 데이터 위주로)
    if any([not addr, not name, '010' in addr, '{' in name]):
        samples.append(p)

print(f"전체 데이터: {total}개")
print(f"{'='*40}")
print(f"주소 내 전화번호 혼입: {issues['address_with_phone']}개 ({issues['address_with_phone']/total*100:.1f}%)")
print(f"주소 정보 누락: {issues['missing_address']}개 ({issues['missing_address']/total*100:.1f}%)")
print(f"상호명 누락: {issues['missing_name']}개 ({issues['missing_name']/total*100:.1f}%)")
print(f"이상 태그 포함: {issues['weird_tags']}개 ({issues['weird_tags']/total*100:.1f}%)")
print(f"메뉴/가격 정보 누락: {issues['missing_menu']}개 ({issues['missing_menu']/total*100:.1f}%)")
print(f"전화번호 누락: {issues['missing_phone']}개 ({issues['missing_phone']/total*100:.1f}%)")
print(f"{'='*40}")

print("\n[문제 데이터 샘플]")
for s in samples[:10]:
    print(f"상호: {s.get('place_name')} | 주소: {s.get('address')} | 전화: {s.get('phone')} | 메뉴: {s.get('menu')}")
