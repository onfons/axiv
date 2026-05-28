#!/usr/bin/env python3
"""구 DB에서 content_places, places, contents 전부 이관 + 신규 수집"""
import os, sys, subprocess, time, json

sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

NEW_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://gwfiplywfygjdyhiwusd.supabase.co')
NEW_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
OLD_URL = 'https://dmomucnpvmdqugbstpaf.supabase.co'
OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtb211Y25wdm1kcXVnYnN0cGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTcxNzEsImV4cCI6MjA4ODUzMzE3MX0.hnvTKiCJDT6pZ7TILGjm_4PJvBIijDdfOvkPN1zt4OQ'

sb_old = create_client(OLD_URL, OLD_KEY)
sb_new = create_client(NEW_URL, NEW_KEY)

print('=== 구 DB 전체 이관 + 신규 수집 ===\n')

# 1. 구 DB에서 모든 데이터 추출
print('1. 구 DB 데이터 추출 중...')

# contents
old_contents = {}
offset = 0
while True:
    res = sb_old.table('contents').select('*').range(offset, offset+999).execute()
    d = res.data or []
    if not d: break
    for x in d: old_contents[x['video_id']] = x
    offset += len(d)
print(f'   contents: {len(old_contents)}개')

# places
old_places = {}
offset = 0
while True:
    res = sb_old.table('places').select('*').range(offset, offset+999).execute()
    d = res.data or []
    if not d: break
    for x in d: old_places[x['id']] = x
    offset += len(d)
print(f'   places: {len(old_places)}개')

# content_places
old_cp = []
offset = 0
while True:
    res = sb_old.table('content_places').select('*').range(offset, offset+999).execute()
    d = res.data or []
    if not d: break
    old_cp.extend(d)
    offset += len(d)
print(f'   content_places: {len(old_cp)}개')

# 2. 신규 DB에 있는 데이터와 비교하여 빠진 것만 추가
existing_videos = set()
offset = 0
while True:
    res = sb_new.table('contents').select('video_id').range(offset, offset+999).execute()
    d = res.data or []
    if not d: break
    existing_videos.update(x['video_id'] for x in d)
    offset += len(d)
print(f'\n2. 신규 DB 기존 영상: {len(existing_videos)}개')

# 3. 누락된 contents + places + content_places 이관
missing_videos = [v for v in old_contents if v not in existing_videos]
print(f'   누락 영상: {len(missing_videos)}개')

new_contents_count = 0
new_places_count = 0
new_cp_count = 0

for vid in missing_videos:
    c = old_contents[vid]
    # contents upsert
    try:
        c_res = sb_new.table('contents').upsert(c, on_conflict='video_id').execute()
        new_contents_count += 1
    except Exception as e:
        print(f'   ❌ contents 삽입 실패 ({vid[:15]}): {e}')
        continue

# 이미 content_places를 새 DB에 1481건 넣었지만, 삭제된 1026개 연결이 문제
# → 구 DB에서 content_places를 전수 비교해서 없는 것만 추가
existing_cp_keys = set()
offset = 0
while True:
    res = sb_new.table('content_places').select('content_id,place_id').range(offset, offset+999).execute()
    d = res.data or []
    if not d: break
    existing_cp_keys.update((x['content_id'], x['place_id']) for x in d)
    offset += len(d)
print(f'\n3. 신규 DB content_places: {len(existing_cp_keys)}개')

# 새 DB의 places 목록
new_place_ids = set()
offset = 0
while True:
    res = sb_new.table('places').select('id').range(offset, offset+999).execute()
    d = res.data or []
    if not d: break
    new_place_ids.update(x['id'] for x in d)
    offset += len(d)
print(f'   신규 DB places: {len(new_place_ids)}개')

# 구 DB의 content_places 중 신규 DB에 없는 것만 추가 (단, place_id가 신규 DB에 있어야 함)
restored = 0
for cp in old_cp:
    key = (cp['content_id'], cp['place_id'])
    if key not in existing_cp_keys and cp['place_id'] in new_place_ids:
        try:
            sb_new.table('content_places').upsert(cp, on_conflict='content_id,place_id').execute()
            restored += 1
            existing_cp_keys.add(key)
        except:
            pass

print(f'\n✅ 복구 완료!')
print(f'   복원된 content_places: {restored}개')

# 4. 신규 수집 스크립트 실행 (백그라운드)
print('\n4. 신규 데이터 수집 시작 (백그라운드)...')
subprocess.Popen(
    ['python3', '/home/ubuntu/projects/axiv/scripts/collect_nationwide_v2.py'],
    cwd='/home/ubuntu/projects/axiv',
    stdout=open('/tmp/collect_v2.log', 'w'),
    stderr=subprocess.STDOUT
)
print('   ✅ 수집 백그라운드 실행 (로그: /tmp/collect_v2.log)')

# 5. 최종 approved 상태 확인
final = sb_new.table('places').select('id', count='exact').eq('status', 'approved').execute()
print(f'\n📊 최종 approved: {final.count}개')
print('=== 완료 ===')