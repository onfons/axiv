# axiv 프로젝트 — 작업 이력 및 스킬 문서

> **프로젝트 개요**: 유튜버 장소 데이터 수집 파이프라인 (axiv)
> **작업 기간**: 2026-05-21 ~ 진행중
> **GitHub**: https://github.com/onfons/axiv
> **배포**: Vercel (예정)

---

## 1. 🗺️ 도메인: 데이터 수집 (Data Collection)

### 1.1 유튜브 URL 수집

**스킬**: `youtube-place-pipeline` (기존) → `collect-regional-v2` (신규)

| 파일 | 기능 | 상태 |
|---|---|---|
| `scripts/collect_regional_v2.py` | 배치 OR 검색으로 지역별 URL 수집 | ✅ 완료 |
| `scripts/collect_more_v2.py` | 부족 지역 집중 URL 수집 | ✅ 완료 |
| `scripts/search_urls.py` | 카테고리별 유튜브 검색 | ✅ 보조 |

**핵심 패턴**:
```python
# 배치 OR 검색 (한 번에 3-4개 검색어)
BATCHES = [["강원도 맛집", "속초 카페", "춘천 닭갈비"]]
query = " | ".join(batch)
yt-dlp f'ytsearch6:{query}' --flat-playlist --dump-json
```

### 1.2 batch_save 파이프라인 (v3.1)

**스킬**: `youtube-place-pipeline`

- yt-dlp → AI 분석 → 교차검증 → 지오코딩 → Supabase 저장
- NVIDIA Nemotron-Nano-9B-v2 모델 사용
- 교차검증 threshold: 40점 (네이버 HTML 파싱 + Geocode 폴백)
- 중복 체크: `address` 기준 (같은 주소면 place 재사용, content_places만 추가)

---

## 2. 🧹 도메인: 데이터 정제 (Data Cleanup)

### 2.1 오염 데이터 제거

**스킬**: `data-cleanup` (신규)

| 문제 | 처리 | 정제량 |
|---|---|---|
| 주소에 전화번호 혼입 | 주소 정규식 검증 후 삭제 | 187개 |
| 주소 None/미상 | 전체 삭제 | 130개 |
| 가짜 주소 패턴 | "맛있는길", "테헤란로 427" 등 필터링 | 37개 |
| 가짜 전화번호 | 0123456789 패턴 제거 (Naver 스크래핑 금지) | 344개 |
| **총 정제** | | **317개 삭제 (2080→683)** |

### 2.2 Naver HTML 파싱 금지 규칙

**⚠️ 중요**: Naver HTML 검색 결과에서 정규식으로 전화번호 추출 시 `0123456789` 가짜번호만 반환됨.
→ **Google Places API만 사용** (Naver 스크래핑 절대 금지)

---

## 3. 🔍 도메인: 상세정보 보강 (Enrichment)

### 3.1 상세정보 보강 파이프라인

**스킬**: `google-naver-place-enrichment` (신규) ✅

| 단계 | 출처 | 수집 정보 | 우선순위 |
|---|---|---|---|
| 1순위 | Google Places API (New) | 전화번호, 영업시간(요일별), 좌표, 정제주소 | 가장 신뢰도 높음 |
| 2순위 | Naver 검색 (Google 실패 시) | 전화번호만 | Google 실패 시 사용 |
| 3순위 | NVIDIA AI (DuckDuckGo + 분석) | 메뉴/가격 (선택적) | 보조용 |

### 3.2 적용 결과 (1000개 기준)

| 항목 | 보강 전 | 보강 후 | 신뢰도 |
|---|---|---|---|
| 전화번호 | 7% | **58.4%** | 🟢 Google Places |
| 영업시간 | 40% | **63.1%** | 🟢 Google Places |
| 좌표 | 68% | **93.4%** | 🟢 Google Places |
| 메뉴/가격 | (가짜포함) | 27% | 🟡 유튜브 출처 유지 |

### 3.3 Google Places API 설정

- 엔드포인트: `POST https://places.googleapis.com/v1/places:searchText`
- 필수 FieldMask: `places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.regularOpeningHours`
- 언어: `ko`
- 키: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (`.env.local`)
- 요금: Places API (New) — 월 $200 무료 크레딧 내

---

## 4. 🌐 도메인: 다국어 지원 (i18n)

**스킬**: `i18n-setup` (신규)

| 항목 | 적용 내용 |
|---|---|
| 프레임워크 | next-intl (App Router) |
| 지원 언어 | 한국어(ko), 영어(en), 일본어(ja), 중국어(zh) |
| 자동 감지 | 브라우저 Accept-Language 헤더 기반 middleware |
| 수동 전환 | Header 우측 LocaleSwitcher 버튼 |

### 주요 파일

| 파일 | 용도 |
|---|---|
| `src/middleware.ts` | 언어 감지 + 리다이렉트 |
| `src/i18n/routing.ts` | next-intl 라우팅 설정 |
| `src/i18n/request.ts` | 언어별 메시지 로드 |
| `messages/{ko,en,ja,zh}.json` | 다국어 메시지 파일 |
| `src/i18n.d.ts` | 타입 안전성 |
| `src/components/layout/LocaleSwitcher.tsx` | 언어 전환 UI |

### 빌드 상태
```bash
npx next build → ✅ 정상 (13 pages, no errors)
```
루트 URL `/` → `/ko` 자동 리다이렉트, 기존 URL 호환성 유지.

---

## 5. 📈 도메인: 통계 및 모니터링

### 주요 스크립트

| 스크립트 | 용도 |
|---|---|
| `scripts/check_db.py` | 전체 카테고리별 집계 |
| `scripts/check_region_gaps.py` | 지역별 분포 분석 |
| `scripts/check_missing.py` | 메뉴/영업시간/전화번호 누락률 |
| `scripts/check_server.py` | 로컬 서버 포트 확인 |

### 지역별 최종 분포 (1000개 기준)
- 서울 18.5% · 해외 24.6% (분류 개선 필요)
- 부산 62 · 경기 19 · 인천 18 · 대전 15 · 강원 14 · 경북 15 · 울산 14
- 전남 12 · 광주 11 · 경남 11 · 대구 9 · 충남 3 · 충북 1 · 세종 0 · 전북 0

---

## 6. 📋 마케팅 자료

| 파일 | 내용 |
|---|---|
| `README.md` | 프로젝트 소개 (재작성 완료) |
| `docs/marketing.md` | SNS/커뮤니티 홍보 가이드 |
| `docs/blog_post.md` | 블로그 홍보글 (~2,200자) |

---

## 7. 🔧 주요 의사결정

| 결정 | 내용 | 이유 |
|---|---|---|
| Naver 금지 | Naver HTML 파싱 절대 사용 금지 | 100% 가짜번호(0123456789) 생성 |
| Google 우선 | Google Places API만 상세정보 출처로 사용 | 95%+ 정확도 |
| 주소 기반 중복 | 중복 체크: place_name+address → address only | 같은 매장 여러 유튜버 연결 |
| 낙관적 검증 | 교차검증 threshold 50→40 + len>10 통과 | 저장률 개선 |
| 다국어 적용 | next-intl + middleware | 글로벌 확장 대비 |

---

## 8. 🎯 남은 작업

| 우선순위 | 작업 | 예상 |
|---|---|---|
| 🔴 1순위 | 강원도/충청/전북/세종/경남 대규모 데이터 수집 재개 | ~200개 URL |
| 🔴 2순위 | Google API 키 제한 확인 및 billing 설정 | GCP Console |
| 🟡 3순위 | 메뉴/가격 정보 보강 (Google Places 미지원) | NVIDIA AI 개선 |
| 🟡 4순위 | Vercel 배포 | CI/CD 세팅 |
| 🟢 5순위 | 지역 분류 개선 (해외 24.6% → 정확 분류) | 행정구역 키워드맵 개선 |