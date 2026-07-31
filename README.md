# 📈 국내 증시 일별 분석

수집은 클라우드(GitHub Actions), 저장은 Supabase, 열람은 Vercel에 올린 Next.js 앱.
**웹은 한 번만 만들어 두고, 매일 갱신되는 건 Supabase 데이터뿐**입니다.

```
GitHub Actions                          Supabase (PostgreSQL)
 ├─ collector/collect.py       ──▶  stocks · daily_price · daily_fundamental · snapshot
 ├─ collector/collect_macro.py ──▶  macro_series · macro_daily
 └─ 분석 파이프라인(MCP)        ──▶  screening · market_daily_commentary ·
                                     sector_performance · fx_rates · daily_brief
                                              │
                                              ▼  뷰 4개로 통합
                          daily_quote · daily_movers · surge_calendar · keyword_board
                                              │
                                              ▼
                                    Next.js on Vercel
                                     · /          일별 리포트 (매크로+시황+스크리닝)
                                     · /keywords  키워드보드
                                     · /calendar  급등 캘린더
                                     · /screener  조건 스크리너
                                     · /stock/[코드] 종목 상세
```

---

## 화면

| 경로 | 내용 | 읽는 곳 |
|---|---|---|
| `/` | 매크로 28개 지표 보드 → 데일리 브리핑 → 시장 개요 → 서술형 시황 4섹션 → 업종 등락 → 종목 스크리닝 표 | `macro_*`, `market_*`, `sector_performance`, `fx_rates`, `daily_movers`, `screening`, `daily_brief` |
| `/keywords` | 테마·이슈·산업 키워드를 거래일 교차 집계 | `keyword_board` 뷰 |
| `/calendar` | 날짜별 급등/급락/변동/거래대금 종목 수를 달력으로 | `surge_calendar` 뷰 |
| `/screener` | 슬라이더 조건 스크리닝 (기존 화면) | `snapshot` |

`/?date=YYYY-MM-DD` 로 기준일자를 지정합니다. 지정한 날짜에 데이터가 없으면
**임의로 다른 날짜로 옮기지 않고** 그 사실만 표시합니다.

---

## 데이터 구조에서 알아둘 것

**`snapshot` 은 이력이 아닙니다.** PK가 `ticker` 단독이라 종목별 최신 1행만 남습니다.
날짜별 시세 이력이 필요하면 `daily_price` 를 쓰세요. 급등 캘린더와 일자별
등락률은 전부 `daily_price` 의 `lag()` 로 계산합니다.

**시황 테이블이 두 개입니다.** 구세대 `market_summary`(headline·insights 포함)와
신세대 `market_daily_commentary`(컬럼명이 다름). 웹앱은 신세대를 우선 조회하고
없으면 구세대로 폴백합니다 — 어느 쪽을 읽었는지 화면에 표시됩니다.

**스크리닝 카테고리 라벨도 두 벌입니다.** 뷰가 만드는 `6%이상변동` 과 구세대
`screening` 의 `변동폭확대` 를 필터가 모두 인식합니다.

**매크로는 forward-fill 되어 있습니다.** 휴일·미발표 구간이 직전값으로 채워져
있으므로, 증감률은 단순히 하루/한 달 전 행과 비교하지 않고 **값이 실제로 바뀐
직전 발표값**과 비교합니다.

**거래대금·시가총액·순매수는 원 단위 정수**로 저장하고 표기만 축약합니다
(셀에 마우스를 올리면 원 단위 전체값).

---

## 셋업

### 1. Supabase

1. SQL Editor에 `supabase/schema.sql` 전체 붙여넣고 Run
2. Settings → API 에서 `Project URL`, `anon public`, `service_role` 복사

> ⚠️ RLS를 켜기만 하고 SELECT 정책을 안 만들면 **에러 없이 0행**이 돌아옵니다.
> `schema.sql` 마지막 블록이 모든 읽기 테이블에 공개 읽기 정책을 걸어줍니다.

### 2. GitHub Actions Secrets

| Secret | 값 |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | service_role 키 (절대 브라우저·클라이언트 노출 금지) |
| `KRX_ID` / `KRX_PW` | data.krx.co.kr 계정 |
| `DART_API_KEY` | opendart.fss.or.kr 인증키 |
| `FRED_API_KEY` | fred.stlouisfed.org 인증키 |
| `ECOS_API_KEY` | ecos.bok.or.kr 인증키 |

### 3. Vercel

1. New Project → 이 저장소 선택
2. **Root Directory 를 `web` 으로 지정** ← 중요
3. Environment Variables

   | 변수 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 |
   | `DART_API_KEY` | DART 인증키 (`/api/dart` 서버사이드 전용) |
   | `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 검색 API (`/api/news` 전용) |

4. Deploy

페이지는 `revalidate = 1800` (30분 ISR)이라 배포 후에도 Supabase 데이터가
바뀌면 자동으로 반영됩니다. **웹 재배포는 필요 없습니다.**

---

## 로컬 개발

```bash
cd web
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_ 두 개만 채우면 조회는 됩니다
npm run dev
```

---

## 수집 모드

| 모드 | 하는 일 | 소요 |
|---|---|---|
| `master` | 종목명/업종/DART 고유번호 갱신 | ~2분 |
| `daily` | 당일 시세·밸류 + 스냅샷 재생성 | ~1분 |
| `backfill` | 과거 N일 시세·밸류 채우기 | 400일 ≈ 15분 |

`daily_price` 가 쌓일수록 급등 캘린더와 일자별 등락률이 촘촘해집니다.
현재는 거래일이 얼마 없어 캘린더가 듬성듬성합니다.

수집이 해외 IP로 막히면 집 PC에서:

```bash
cd collector
pip install -r requirements.txt
python collect.py --mode daily
```

---

## 한계

- `stocks.sector` / `snapshot.sector` 가 비어 있습니다. 스펙상 최종 선정 종목에
  대해서만 그때그때 채우는 항목이라, 채워지기 전까지 업종 컬럼은 비어 보입니다.
- `daily_fundamental` 의 PER/PBR은 KRX 공시 반영 기준이라 시차가 있습니다.
- 애널리스트 컨센서스·목표주가는 무료 API가 사실상 없어 `stock_fundamentals`
  (MCP 수집분)에 있는 종목만 값이 있습니다.
- 본 도구는 **후보군을 좁히는 탐색용**이며 투자 판단 근거가 아닙니다.
