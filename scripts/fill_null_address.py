#!/usr/bin/env python3
"""Google Places APIで남은 37개 address=NULL 장소 보강"""
import os, sys, json, requests, re, time
sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
from dotenv import load_dotenv
load_dotenv('/home/ubuntu/projects/axiv/.env.local')
from supabase import create_client
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
GOOGLE_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')

res = sb.table('places').select('id, place_name').is_('address', 'null').execute()
targets = res.data or []
print(f'보강 대상: {len(targets)}개')

for i, p in enumerate(targets):
    name = p['place_name']
    print(f'[{i+1}/{len(targets)}] {name}')
    try:
        r = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.regularOpeningHours',
            },
            json={'textQuery': name, 'maxResultCount': 1, 'languageCode': 'ko'},
            timeout=10
        )
        gp = r.json()
        if gp.get('places') and len(gp['places']) > 0:
            pl = gp['places'][0]
            updates = {}
            fa = pl.get('formattedAddress', '')
            phone = pl.get('nationalPhoneNumber', '')
            loc = pl.get('location', {})
            hours = pl.get('regularOpeningHours', {})
            if fa:
                addr_parts = fa.split(', ')
                updates['address'] = addr_parts[-1] if len(addr_parts) > 1 else fa
            if phone:
                updates['phone'] = phone
            if loc:
                updates['lat'] = loc.get('latitude', 0)
                updates['lng'] = loc.get('longitude', 0)
            if hours and 'weekdayDescriptions' in hours:
                updates['business_hours'] = '\n'.join(hours['weekdayDescriptions'])
            if updates:
                sb.table('places').update(updates).eq('id', p['id']).execute()
                addr = updates.get('address', '')[:30]
                ph = updates.get('phone', '')[:15]
                print(f'  OK addr={addr} phone={ph}')
            else:
                print(f'  FAIL no data')
        else:
            print(f'  FAIL no result')
    except Exception as e:
        print(f'  ERROR {e}')
    time.sleep(0.3)

print(f'\nDone')

res2 = sb.table('places').select('id', count='exact').execute()
null2 = sb.table('places').select('id').is_('address', 'null').execute()
print(f'Total places: {res2.count}')
print(f'Remaining NULL address: {len(null2.data or [])}개')