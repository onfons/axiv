#!/usr/bin/env python3
"""네이버 검색으로 매장 상세정보 보완 (메뉴/영업시간/전화번호)"""
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

# 누락 장소 가져오기
r = sb.table('places').select('id','place_name','address','representative_menu','business_hours','phone').execute()

updated = 0
total = 0

for p in r.data:
    menu = (p.get('representative_menu') or '').strip()
    hours = (p.get('business_hours') or '').strip()
    phone = (p.get('phone') or '').strip()

    # 3가지 중 2개 이상 있으면 스킵
    has = sum([1 for x in [menu, hours, phone] if x])
    if has >= 2:
        continue

    name = p['place_name']
    addr = p.get('address', '').split(' ')[0:3]  # 앞 3단어만
    addr_short = ' '.join(addr) if addr else ''
    place_id = p['id']
    total += 1

    # 네이버 검색
    query = f"{name} {addr_short}"
    nav_url = f"https://search.naver.com/search.naver?where=nexearch&query={requests.utils.quote(query)}"
    
    try:
        resp = requests.get(nav_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=8)
        html = resp.text
        
        # 네이버 지식인/블로그/플레이스에서 정보 추출 시도
        # 장소 정보 패턴
        text_parts = re.findall(r'<span[^>]*class="[^"]*">([^<]{5,200})</span>', html)
        text_parts += re.findall(r'<a[^>]*>([^<]{5,200})</a>', html)
        text_parts += re.findall(r'<p[^>]*>([^<]{10,300})</p>', html)
        
        search_text = '\n'.join(text_parts[:30])
    except:
        search_text = ''

    if len(search_text) < 100:
        continue

    # AI 추출
    prompt = f"""네이버 검색결과에서 "{name}"의 정보를 추출하세요:
{search_text[:3000]}

JSON 응답:
{{"menu_with_prices":"메뉴 가격\\\\n메뉴 가격", "business_hours":"HH:MM~HH:MM", "phone":"XXX-XXXX-XXXX"}}

없으면 빈 문자열. 추측 금지."""

    try:
        resp = requests.post(
            f"{NVIDIA_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {NVIDIA_API_KEY}", "Content-Type": "application/json"},
            json={"model": NVIDIA_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 1024},
            timeout=30
        )
        result_text = resp.json()['choices'][0]['message']['content']
        clean = re.sub(r'```(?:json)?\s*', '', result_text).strip()
        
        # JSON 파싱 시도
        try:
            jm = re.search(r'\{.*\}', clean, re.DOTALL)
            info = json.loads(jm.group(0)) if jm else json.loads(clean)
        except:
            continue

        update_data = {}
        if not menu and info.get('menu_with_prices', '').strip() and len(info['menu_with_prices']) > 5:
            update_data['representative_menu'] = info['menu_with_prices'].strip()
        if not hours and info.get('business_hours', '').strip() and re.search(r'\d', info['business_hours']):
            update_data['business_hours'] = info['business_hours'].strip()
        if not phone and info.get('phone', '').strip() and re.search(r'\d{2,4}[-.]\d{3,4}', info['phone']):
            update_data['phone'] = info['phone'].strip()

        if update_data:
            sb.table('places').update(update_data).eq('id', place_id).execute()
            updated += 1
            print(f"✅ {name[:25]:25s} +{','.join(update_data.keys())}")
        else:
            pass  # 정보 없음

    except:
        pass

    time.sleep(0.5)

print(f"\n완료: {updated}/{total} 업데이트")