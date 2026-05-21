#!/usr/bin/env python3
"""DB 현재 저장 상태 확인"""
import os, sys
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(os.getenv('NEXT_PUBLIC_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

places = sb.table('places').select('*', count='exact').execute()
contents = sb.table('contents').select('*', count='exact').execute()

print(f"places: {places.count}개")
print(f"contents: {contents.count}개")

# 카테고리별 집계
cats = {}
for p in places.data:
    c = p.get('category', '미분류')
    cats[c] = cats.get(c, 0) + 1

print("\n카테고리별:")
for c, n in sorted(cats.items()):
    print(f"  {c}: {n}개")