#!/usr/bin/env python3
"""JSON 데이터 → 새 Supabase로 이관 (id 포함)"""
import os, json, sys
from supabase import create_client

NEW_URL = 'https://gwfiplywfygjdyhiwusd.supabase.co'
NEW_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZmlwbHl3ZnlnamR5aGl3dXNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk0NzAyNywiZXhwIjoyMDk1NTIzMDI3fQ.og0AkdY3tPWnFtleYmkDZG6ZufWg8qIzVs1A65OfD_A'
sb = create_client(NEW_URL, NEW_SERVICE)

def import_json(filepath, table):
    with open(filepath) as f:
        rows = json.load(f)
    
    total = len(rows)
    done = 0
    errors = 0
    batch_size = 100
    
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        try:
            sb.table(table).insert(batch).execute()
            done += len(batch)
        except Exception as e:
            # 하나씩 시도
            for row in batch:
                try:
                    sb.table(table).insert(row).execute()
                    done += 1
                except:
                    errors += 1
        print(f'  {table}: {done}/{total} (오류:{errors})', end='\r')
    
    print(f'\n  ✅ {table}: {done}개 완료 (오류:{errors})')

print('=== 데이터 이관 시작 ===')
import_json('/tmp/axiv_places_backup.json', 'places')
import_json('/tmp/axiv_contents_backup.json', 'contents')

print('\n=== 최종 검증 ===')
for t in ['places', 'contents']:
    r = sb.table(t).select('id', count='exact').execute()
    print(f'  {t}: {r.count}개')

print('\n✅ 마이그레이션 완료!')