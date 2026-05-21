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
            try:
                res = requests.get(sub_url, timeout=15)
                events = res.json().get('events', [])
                transcript_text = " ".join(["".join([s.get('utf8', '') for s in e.get('segs', [])]) for e in events if 'segs' in e])
            except Exception:
                transcript_text = ""  # 자막 없으면 빈 문자열로 진행

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

def _tavily_search(query, max_results=5):
    """Tavily API로 검색합니다. 실패 시 None 반환."""
    try:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            return None
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": max_results,
        }
        res = requests.post(url, json=payload, timeout=15)
        if res.status_code != 200:
            print(f"Tavily status {res.status_code}")
            return None
        data = res.json()
        results = data.get("results", [])
        if not results:
            return None
        context = ""
        for r in results:
            context += f"[Source: {r.get('url','')}] {r.get('content','')}\n\n"
        return context
    except Exception as e:
        print(f"Tavily Error: {e}")
        return None


def _ddgs_search(query, max_results=5):
    """DuckDuckGo fallback 검색."""
    try:
        with DDGS() as dg:
            results = list(dg.text(query, max_results=max_results))
            context = ""
            for r in results:
                context += f"[Source: {r['href']}] {r['body']}\n\n"
            return context
    except Exception as e:
        print(f"DDGS Error: {e}")
        return ""


def perform_free_search(query):
    """Tavily 우선, 실패 시 DuckDuckGo fallback 웹 검색."""
    context = _tavily_search(query)
    if context is not None:
        return context
    return _ddgs_search(query)


def perform_place_detail_search(place_name, address=""):
    """상호명+주소 기반 상세 검색: Tavily 우선, 실패 시 DuckDuckGo fallback"""
    context = ""
    location = address if address else place_name
    queries = [
        f"{place_name} {location} 전화번호",
        f"{place_name} {location} 영업시간",
        f"{place_name} {location} 메뉴 가격",
        f"{place_name} {location} 브레이크타임",
    ]
    labels = ["전화번호주소", "영업시간", "메뉴정보", "영업시간"]

    # 1. Tavily 시도
    all_text = " ".join(queries)
    tavily_result = _tavily_search(all_text, max_results=8)
    if tavily_result is not None:
        context = tavily_result
        return context

    # 2. DDGS fallback
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
    """5단계 심층 검색: 채널명+제목 기반으로 위치+상세정보 정확히 검색"""
    context = ""
    queries = [
        f"{uploader} {title} 위치 주소",
        f"{title} {uploader} 전화번호 주소",
        f"{title} 영업시간 휴무일 브레이크타임",
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
    NVIDIA_MODEL = "google/gemma-3n-e4b-it"
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
        response = requests.post(f"{NVIDIA_BASE_URL}/chat/completions", json=payload, headers=headers, timeout=180)
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content']
    except requests.exceptions.Timeout:
        print("AI API Timeout (120s)")
        return ''
    except Exception as e:
        print(f"AI API Error: {e}")
        return ''
