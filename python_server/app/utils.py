import requests
import re
import os
import yt_dlp
from duckduckgo_search import DDGS
from geopy.geocoders import Nominatim
from dotenv import load_dotenv

load_dotenv()

def extract_video_id(url):
    """YouTube URL에서 video_id를 추출합니다."""
    pattern = r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def get_coordinates(address):
    """주소를 기반으로 위도, 경도를 무료로 가져옵니다 (OpenStreetMap)"""
    if not address or address == "":
        return 37.5665, 126.9780 # 기본값: 서울시청

    try:
        # user_agent는 필수입니다.
        geolocator = Nominatim(user_agent="axiv_analyzer")
        location = geolocator.geocode(address)
        if location:
            return location.latitude, location.longitude
    except Exception as e:
        print(f"📍 Geocoding Error ({address}): {e}")
    
    return 37.5665, 126.9780 # 실패 시 기본값

def get_youtube_full_data(url):
    """yt-dlp를 사용하여 유튜브 메타데이터와 자막을 추출합니다."""
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'quiet': True,
        'no_warnings': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        title = info.get('title', '')
        description = info.get('description', '')
        uploader = info.get('uploader', '')
        thumbnail_url = info.get('thumbnail', '')
        
        # 자막 추출
        transcript_text = ""
        sub_url = None
        if 'ko' in info.get('subtitles', {}):
            subs = info['subtitles']['ko']
            sub_url = subs[0]['url'] if isinstance(subs, list) else subs.get('url')
        elif 'ko' in info.get('automatic_captions', {}):
            subs = info['automatic_captions']['ko']
            sub_url = subs[0]['url'] if isinstance(subs, list) else subs.get('url')

        if sub_url:
            if 'fmt=json3' not in sub_url: sub_url += '&fmt=json3'
            res = requests.get(sub_url)
            events = res.json().get('events', [])
            transcript_text = " ".join(["".join([s.get('utf8', '') for s in e.get('segs', [])]) for e in events if 'segs' in e])

        return {
            "video_id": info.get('id'),
            "title": title,
            "description": description,
            "uploader": uploader,
            "thumbnail_url": thumbnail_url,
            "transcript": transcript_text
        }
    except Exception as e:
        print(f"yt-dlp Error: {e}")
        return None

def perform_free_search(query):
    """DuckDuckGo를 이용해 무료 웹 검색을 수행하고 컨텍스트를 생성합니다."""
    try:
        with DDGS() as dg:
            results = dg.text(query, max_results=5)
            context = ""
            for r in results:
                context += f"[Source: {r['href']}] {r['body']}\n\n"
            return context
    except Exception as e:
        print(f"Search Error: {e}")
        return ""


def perform_place_detail_search(place_name, address=""):
    """상호명+주소 기반 상세 검색: 네이버 지도/플레이스 정보 활용"""
    context = ""
    location = address if address else place_name
    queries = [
        f"{place_name} {location} 전화번호",
        f"{place_name} {location} 영업시간",
        f"{place_name} {location} 메뉴 가격",
        f"{place_name} {location} 브레이크타임",
    ]
    labels = ["전화번호주소", "영업시간", "메뉴정보", "영업시간"]
    try:
        for q, lbl in zip(queries, labels):
            try:
                with DDGS() as dg:
                    results = list(dg.text(q, max_results=5))
                    for r in results:
                        context += f"[{lbl}] {r['body']}\n"
            except:
                continue
    except Exception as e:
        print(f"Place Detail Search Error for {place_name}: {e}")
    return context


def perform_deep_search(title, uploader):
    """5단계 심층 검색: 제목→장소명→전화번호/주소→메뉴/영업시간→블로그리뷰"""
    context = ""
    queries = [
        f"{title} {uploader} 맛집 위치 주소",
        f"{title} 전화번호 주소",
        f"{title} 영업시간 휴무일",
        f"{title} 메뉴 가격",
        f"{uploader} {title} 블로그 리뷰 후기",
    ]
    labels = ["일반검색", "전화번호주소", "영업시간", "메뉴정보", "블로그리뷰"]
    try:
        for q, lbl in zip(queries, labels):
            try:
                with DDGS() as dg:
                    results = list(dg.text(q, max_results=5))
                    for r in results:
                        context += f"[{lbl}] {r['body']}\n"
            except:
                continue
    except Exception as e:
        print(f"Deep Search Error: {e}")
    return context if context else perform_free_search(f"{title} {uploader}")


def call_ai_model(prompt):
    """NVIDIA NIM API를 사용하여 AI 분석을 수행합니다."""
    NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
    NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
    # 빠른 분석에 최적화된 모델
    NVIDIA_MODEL = "google/gemma-4-31b-it"
    if not NVIDIA_API_KEY:
        return "AI API 키가 설정되지 않았습니다."

    payload = {
        "model": NVIDIA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 4096,
    }
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    
    try:
        response = requests.post(f"{NVIDIA_BASE_URL}/chat/completions", json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content']
    except requests.exceptions.Timeout:
        print("AI API Timeout (60s)")
        return ''
    except Exception as e:
        print(f"AI API Error: {e}")
        return ''
