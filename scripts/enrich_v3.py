#!/usr/bin/env python3
"""상세정보 보완 v3 — 전화번호 검색 + 메뉴 검색 분리"""
import os, sys, re, json, requests, time
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client

sb = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY')
NVIDIA_MODEL = "nvidia/nvidia-nemotron-nano-9b-v2"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"

r = sb.table('places').select('id','place_name','address','representative_menu','business_hours','phone').execute()

updated = 0
skipped = 0
total = 0

for p in r.data:
    menu = (p.get('representative_menu') or '').strip()
    hours = (p.get('business_hours') or '').strip()
    phone = (p.get('phone') or '').strip()

    # 3가지 다 있으면 스킵
    if menu and hours and phone:
        skipped += 1
        continue

    name = p['place_name']
    addr = p.get('address', '')
    place_id = p['id']
    total += 1

    update_data = {}

    # 전화번호 검색 (네이버 맵)
    if not phone and name and addr:
        try:
            naver_query = f"https://map.naver.com/p/search/{requests.utils.quote(name)}"
            resp = requests.get(
                f"https://search.naver.com/search.naver?query={requests.utils.quote(name + ' 전화번호')}",
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'},
                timeout=8
            )
            phones = re.findall(r'(\d{2,4}[.-]\d{3,4}[.-]\d{4})', resp.text)
            phones += re.findall(r'(0\d{1,2}[.-]\d{3,4}[.-]\d{4})', resp.text)
            if phones:
                update_data['phone'] = phones[0].replace('.', '-')
        except:
            pass

    # 영업시간/메뉴 검색 (AI 활용)
    missing = []
    if not hours: missing.append('business_hours')
    if not menu: missing.append('menu_with_prices')

    if missing and name:
        try:
            # 구글 검색으로 보완 (네이버는 이미 했으니 다른 소스)
            resp = requests.get(
                f"https://www.google.com/search?q={requests.utils.quote(name + ' ' + ' '.join(missing))}",
                headers={'User-Agent': 'Mozilla/5.0'},
                timeout=8
            )
            snippets = re.findall(r'<span[^>]*>([^<]{10,200})</span>', resp.text)
            snippets += re.findall(r'<div[^>]*>([^<]{10,200})</div>', resp.text)
            search_text = '\n'.join(snippets[:20])
        except:
            search_text = ''

        if len(search_text) > 80:
            prompt = f"""{name} 정보 추출. 검색결과:
{search_text[:3000]}

JSON: {{"business_hours":"HH:MM~HH:MM", "menu_with_prices":"메뉴 가격\\\\n메뉴 가격"}}
없으면 빈문자열. 추측금지. 전화번호불필요."""

            try:
                resp = requests.post(
                    f"{NVIDIA_BASE}/chat/completions",
                    headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"},
                    json={"model": NVIDIA_MODEL, "messages": [{"role":"user","content":prompt}], "temperature":0.1, "max_tokens":1024},
                    timeout=30
                )
                txt = resp.json()['choices'][0]['message']['content']
                clean = re.sub(r'```(?:json)?\s*', '', txt).strip()
                jm = re.search(r'\{.*\}', clean, re.DOTALL)
                info = json.loads(jm.group(0)) if jm else json.loads(clean)

                if not hours and info.get('business_hours','').strip():
                    update_data['business_hours'] = info['business_hours'].strip()
                if not menu and info.get('menu_with_prices','').strip() and len(info['menu_with_prices']) > 10:
                    update_data['representative_menu'] = info['menu_with_prices'].strip()
            except:
                pass

    if update_data:
        sb.table('places').update(update_data).eq('id', place_id).execute()
        updated += 1
        if updated % 10 == 0:
            print(f"  진행: {updated}개 업데이트 완료", flush=True)

    time.sleep(0.3)  # rate limit

print(f"\n완료: {updated}/{total} 업데이트 (이미 완료 {skipped}개)")