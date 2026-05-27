#!/usr/bin/env python3
"""오염된 데이터 식별 및 삭제 (Data Purge)"""
import os, sys
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'])

# 1. 모든 데이터 가져오기
res = sb.table('places').select('id, place_name, address, phone').execute()
data = res.data or []
total = len(data)

to_delete = []

for p in data:
    pid = p.get('id')
    name = p.get('place_name') or ''
    addr = p.get('address') or ''
    phone = p.get('phone') or ''
    
    is_dirty = False
    reason = ""

    # 기준 1: 주소에 전화번호 패턴이 포함된 경우 (파싱 오류)
    if any(char.isdigit() for char in addr) and ('-' in addr or '010' in addr or '02-' in addr):
        is_dirty = True
        reason = "Address contains phone number"
    
    # 기준 2: 주소가 아예 없거나 'None', '미상'인 경우 (정확도 낮음)
    elif not addr or addr.strip() == '' or 'None' in addr or '주소 미상' in addr or '주소 정보 없음' in addr:
        is_dirty = True
        reason = "Missing or invalid address"
        
    # 기준 3: 상호명이 너무 짧거나 특수문자만 있는 경우
    elif len(name) < 2 or any(tag in name for tag in ['{', '}', '[', ']', '<', '>', '\"']):
        is_dirty = True
        reason = "Invalid place name"

    if is_dirty:
        to_delete.append(pid)

# 2. 삭제 실행 (배치 처리)
print(f"전체 {total}개 중 오염 데이터 {len(to_delete)}개 발견")

if to_delete:
    # Supabase는 .in() 필터를 사용해 여러 ID를 한 번에 삭제 가능
    # 하지만 양이 많으므로 100개씩 나눠서 삭제
    batch_size = 100
    for i in range(0, len(to_delete), batch_size):
        batch = to_delete[i:i+batch_size]
        sb.table('places').delete().in_('id', batch).execute()
        print(f"삭제 중... {i + len(batch)} / {len(to_delete)}")

print(f"\n✅ 정제 완료: {len(to_delete)}개의 오염 데이터가 삭제되었습니다.")
print(f"현재 남은 유효 데이터: {total - len(to_delete)}개")
