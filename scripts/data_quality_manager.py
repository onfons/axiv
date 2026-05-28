#!/usr/bin/env python3
"""axiv 데이터 교차검증 v5.0 — 유튜버-장소-영상 3각 검증 후 정화"""
import os, sys, re, json
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client
from collections import defaultdict

URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://gwfiplywfygjdyhiwusd.supabase.co')
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZmlwbHl3ZnlnamR5aGl3dXNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTk0NzAyNywiZXhwIjoyMDk1NTIzMDI3fQ.og0AkdY3tPWnFtleYmkDZG6ZufWg8qIzVs1A65OfD_A'
sb = create_client(URL, SERVICE_KEY)

print('=== axiv 3각 교차검증 시작 ===')

# 1. 전체 places 로드
all_places = []
offset = 0
while True:
    res = sb.table('places').select('*').range(offset, offset+999).execute()
    data = res.data or []
    if not data: break
    all_places.extend(data)
    offset += len(data)
print(f'places: {len(all_places)}개')

# 2. content_places 로드
all_cp = []
offset = 0
while True:
    res = sb.table('content_places').select('*').range(offset, offset+999).execute()
    data = res.data or []
    if not data: break
    all_cp.extend(data)
    offset += len(data)
print(f'content_places: {len(all_cp)}개')

# 3. contents 로드
all_contents = {}
offset = 0
while True:
    res = sb.table('contents').select('*').range(offset, offset+999).execute()
    data = res.data or []
    if not data: break
    for c in data:
        all_contents[c['id']] = c
    offset += len(data)
print(f'contents: {len(all_contents)}개')

# ============================================================
# 검증 1: 동일 (place_id, content_id) 중복 content_places
# ============================================================
print('\n--- 검증 1: 중복 연결 ---')
vp_map = defaultdict(list)
for cp in all_cp:
    key = str(cp['place_id']) + '|' + str(cp['content_id'])
    vp_map[key].append(cp)

dups = {k: v for k, v in vp_map.items() if len(v) > 1}
print(f'중복 content_places: {len(dups)}건')
del_cp = 0
for key, cps in dups.items():
    keep = cps[0]
    for cp in cps[1:]:
        sb.table('content_places').delete().eq('id', cp['id']).execute()
        del_cp += 1
print(f'중복 제거: {del_cp}개')

# ============================================================
# 검증 2: (creator, video_id)별 place_id 분포
# ============================================================
print('\n--- 검증 2: 영상-장소 연결 분포 ---')

# content_places → (creator, video_id) → place_id 매핑 재구축
cont_place = defaultdict(set)
approved_ids = set(p['id'] for p in all_places if p.get('status') == 'approved')

# 중복 제거 후 다시 로드
all_cp2 = []
offset = 0
while True:
    res = sb.table('content_places').select('*').range(offset, offset+999).execute()
    data = res.data or []
    if not data: break
    all_cp2.extend(data)
    offset += len(data)

cp_by_place = defaultdict(list)
for cp in all_cp2:
    cp_by_place[cp['place_id']].append(cp)

for cp in all_cp2:
    content = all_contents.get(cp.get('content_id', ''))
    if content and content.get('creator_name') and content.get('video_id'):
        key = (content['creator_name'], content['video_id'])
        cont_place[key].add(cp['place_id'])

print(f'총 영상-장소 연결: {len(cont_place)}건')

# 3개 이상 place에 연결된 영상
multi = {k: v for k, v in cont_place.items() if len(v) >= 3}
multi_sorted = sorted(multi.items(), key=lambda x: -len(x[1]))

print(f'\n3개+ 장소 연결 영상: {len(multi)}건')
total_pending = 0
total_del_cp = 0

for (creator, video_id), place_ids in multi_sorted:
    names = []
    for pid in place_ids:
        p = next((x for x in all_places if x['id'] == pid), None)
        if p:
            names.append(p.get('place_name', ''))
    
    # 같은 유튜버 비디오가 장소 3개 이상: 1개만 남기고 나머지 연결 제거
    print(f'\n  {creator} / {video_id[:20]}... -> {len(place_ids)}개 장소')
    for n in names:
        print(f'    - {n}')
    
    # content 찾기
    target_content = None
    for c in all_contents.values():
        if c.get('video_id') == video_id and c.get('creator_name') == creator:
            target_content = c
            break
    
    if not target_content:
        continue
    
    cid = target_content['id']
    pid_list = list(place_ids)
    
    # 첫 번째 장소만 유지하고 나머지는 연결 제거
    keep_pid = pid_list[0]
    for pid in pid_list[1:]:
        # 이 장소-영상 연결만 삭제
        to_delete = [cp for cp in cp_by_place.get(pid, []) if cp.get('content_id') == cid]
        for cp_obj in to_delete:
            sb.table('content_places').delete().eq('id', cp_obj['id']).execute()
            total_del_cp += 1
            cp_by_place[pid].remove(cp_obj)
        
        # content_places가 더 이상 없으면 장소 pending
        if not cp_by_place.get(pid, []):
            sb.table('places').update({'status': 'pending'}).eq('id', pid).execute()
            total_pending += 1
    
    print(f'    -> {keep_pid[:12]}... 유지, 나머지 {len(pid_list)-1}개 연결 제거')

print(f'\n=== 정화 결과 ===')
print(f'잘못된 연결 삭제: {total_del_cp}개')
print(f'content_places 소멸로 pending: {total_pending}개')

final = sb.table('places').select('id', count='exact').eq('status', 'approved').execute()
print(f'최종 approved: {final.count}개')
print('=== 완료 ===')