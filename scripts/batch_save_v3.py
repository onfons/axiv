#!/usr/bin/env python3
"""axiv 데이터 수집 파이프라인 v3.2 — Google/Naver Place URL + 카테고리 확장"""
import sys, json, os, re, requests, time, urllib.parse
from dotenv import load_dotenv

load_dotenv('/home/ubuntu/projects/axiv/.env.local')

sys.path.insert(0, '/home/ubuntu/projects/axiv/python_server')
os.chdir('/home/ubuntu/projects/axiv/python_server')

from app.utils import get_youtube_full_data, perform_deep_search

NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
GOOGLE_API_KEY = os.getenv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', '')
NVIDIA_MODEL = "nvidia/nvidia-nemotron-nano-9b-v2"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"


# 확장된 카테고리 목록
VALID_CATEGORIES = {
    'food', 'cafe', 'camping', 'fishing', 'travel', 'accommodation',
    'popup', 'exhibition', 'activity', 'drive', 'store', 'bar',
    'sports', 'entertainment'
}


def normalize_category(raw_category: str) -> str:
    """AI가 추출한 카테고리를 표준화"""
    if not raw_category:
        return 'food'
    
    cat = raw_category.lower().strip()
    mapping = {
        'food': ['food', '맛집', '음식', '식당', '레스토랑', '한식', '양식', '중식', '일식', '분식'],
        'cafe': ['cafe', '카페', '커피', '디저트', '베이커리'],
        'camping': ['camping', '캠핑', '글램핑', '오토캠핑'],
        'fishing': ['fishing', '낚시', '피싱'],
        'travel': ['travel', '여행', '관광', '명소', '투어'],
        'accommodation': ['accommodation', '숙소', '호텔', '모텔', '펜션', '민박', '게스트하우스'],
        'popup': ['popup', '팝업', '팝업스토어'],
        'exhibition': ['exhibition', '전시', '미술', '갤러리', '박물관'],
        'activity': ['activity', '액티비티', '체험', '클라이밍', '서핑', '스키', '등산'],
        'drive': ['drive', '드라이브', '드라이브코스'],
        'store': ['store', '가게', '상점', '쇼핑', '마켓', '편집샵'],
        'bar': ['bar', '바', '펍', 'pub', '술집', '와인바', '칵테일'],
        'sports': ['sports', '스포츠', '운동', '축구', '야구', '볼링'],
        'entertainment': ['entertainment', '엔터', '즐길거리', '오락', '노래방', 'pc방'],
    }
    
    for standard, keywords in mapping.items():
        if any(k in cat for k in keywords):
            return standard
    
    return 'food'  # 기본값


def get_google_place_url(place_name, address=""):
    """Google Places API로 검색 후 Google Maps URL 생성"""
    if not GOOGLE_API_KEY:
        return None
    query = f"{place_name} {address[:50]}".strip()
    try:
        resp = requests.post(
            'https://places.googleapis.com/v1/places:searchText',
            headers={
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.googleMapsUri',
            },
            json={'textQuery': query, 'maxResultCount': 1, 'languageCode': 'ko'},
            timeout=10
        )
        data = resp.json()
        if data.get('places') and len(data['places']) > 0:
            place = data['places'][0]
            maps_uri = place.get('googleMapsUri', '')
            if maps_uri:
                return maps_uri
            # 폴백: place_id로 URL 생성
            place_id = place.get('id', '')
            if place_id:
                return f"https://www.google.com/maps/place/?q=place_id:{place_id}"
    except Exception as e:
        print(f"  							
									
									
									
									
									
									
									
									
									
									
									
									
									
									
 									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									
									