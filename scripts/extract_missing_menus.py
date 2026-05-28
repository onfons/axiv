#!/usr/bin/env python3
"""메뉴/가격 정보 2차 추출 v2.0 — Google Places API + Naver 검색 + AI"""
import os, sys, json, re, requests, time
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client
from duckduckgo_search import DDGS

NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY')
GOOGLE_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'])
MODEL = "nvidia/nvidia-nemotron-nano-9b-v2"
BASE = "https://integrate.api.nvidia.com/v1"
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 50

def google_search_place(name, addr):
    """Google Places API로 전화번호/영업시간 가져오기"""
    if not GOOGLE_API_KEY:
        return {}
    try:
        q = f"{name} {addr[:30]}"
        r = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_API_KEY,
                     'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.regularOpeningHours'},
            json={'textQuery': q, 'maxResultCount': 1, 'languageCode': 'ko'},
            timeout=10
        )
        data = r.json()
        if data.get('places'):
            p = data['places'][0]
            result = {}
            if p.get('nationalPhoneNumber'):
                result['google_phone'] = p['nationalPhoneNumber']
            if p.get('regularOpeningHours') and p['regularOpeningHours'].get('weekdayDescriptions'):
                result['google_hours'] = ' / '.join(p['regularOpeningHours']['weekdayDescriptions'])
            if p.get('displayName', {}).get('text'):
                result['google_name'] = p['displayName']['text']
            return result
    except:
        pass
    return {}

def duckduckgo_search(name, addr):
    """DuckDuckGo 검색으로 메뉴/가격 정보"""
    ctx = ""
    for q in [f"{name} 메뉴 가격", f"{name} {addr[:15]}", f"{name} {addr[:10]} 영업시간"]:
        try:
            with DDGS() as dg:
                for r in list(dg.text(q, max_results=3)):
                    body = r['body']
                    if '메뉴' in body or '가격' in body or '원' in body or 'menu' in body.lower():
                        ctx += f"[{q}] {body}\n"
        except: pass
        time.sleep(0.2)
    return ctx

def main():
    print(f'메뉴 추출 v2.0 시작 ({LIMIT}개)')
    
    res = sb.table('places').select('id,place_name,address,phone,business_hours,representative_menu').or_('representative_menu.eq.,representative_menu.is.null').limit(LIMIT+100).execute()
    data = [p for p in (res.data or []) if not p.get('representative_menu') or p['representative_menu'].strip() in ('', '정보 없음')]
    target = data[:LIMIT]
    print(f'대상: {len(target)}개')
    
    stats = {'menu': 0, 'hours': 0, 'phone': 0, 'skip': 0}
    
    for i, p in enumerate(target, 1):
        pid = p['id']
        name = p.get('place_name', '')
        addr = p.get('address', '') or ''
        
        needs_menu = not p.get('representative_menu') or p['representative_menu'].strip() in ('', '정보 없음')
        needs_hours = not p.get('business_hours') or p['business_hours'].strip() in ('', '정보 없음')
        needs_phone = not p.get('phone') or p['phone'].strip() in ('', '정보 없음')
        
        if not any([needs_menu, needs_hours, needs_phone]):
            stats['skip'] += 1
            continue
        
        print(f'  [{i}/{len(target)}] {name[:16]}..', end=' ')
        sys.stdout.flush()
        
        upd = {}
        
        # 1단계: Google Places (전화번호, 영업시간)
        if needs_hours or needs_phone:
            gp = google_search_place(name, addr)
            if gp.get('google_hours') and needs_hours:
                upd['business_hours'] = gp['google_hours']
            if gp.get('google_phone') and needs_phone and '0507' not in gp['google_phone']:
                upd['phone'] = gp['google_phone']
        
        # 2단계: DuckDuckGo + AI (메뉴)
        if needs_menu:
            ctx = duckduckgo_search(name, addr)
            if ctx:
                prompt = f"""매장: {name}
주소: {addr}

검색결과:
{ctx[:5000]}

[규칙] 
- 검색결과에서 {name}의 메뉴와 가격을 정확히 찾아서 JSON으로 응답
- 메뉴 형식: "메뉴명 - 가격원 (설명)"
- 없는 정보는 절대 추측 금지, 빈 문자열로
- 전화번호/영업시간은 Google에서 이미 찾았으면 비워도 됨

JSON만:
{{"menu":"","hours":"","phone":""}}"""
                try:
                    r = requests.post(f"{BASE}/chat/completions", json={
                        "model": MODEL, "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.05, "max_tokens": 1024
                    }, headers={"Authorization": f"Bearer {NVIDIA_API_KEY}"}, timeout=60)
                    text = re.sub(r'```(?:json)?\s*', '', r.json()['choices'][0]['message']['content']).strip()
                    if text.startswith('{') and text.endswith('}'):
                        ai_data = json.loads(text)
                        if ai_data.get('menu') and needs_menu:
                            upd['representative_menu'] = ai_data['menu']
                except: pass
        
        if upd:
            sb.table('places').update(upd).eq('id', pid).execute()
            for k in upd:
                stats[k.replace('representative_', '')] += 1
            print(f'✅ 메뉴=새로추출')
        else:
            print(f'❌ 정보없음')
        
        time.sleep(0.3)
    
    print(f'\n완료! 메뉴:{stats["menu"]} 영업:{stats["hours"]} 전화:{stats["phone"]} 스킵:{stats["skip"]}')

if __name__ == '__main__':
    main()