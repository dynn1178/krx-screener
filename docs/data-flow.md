# 데이터 흐름 — 어디서 가져와 어디에 쌓이는가

세 갈래가 서로 독립적으로 돌아가고, 웹은 그 결과를 **읽기만** 한다.

```
┌─ A. 수집기 (GitHub Actions · 코드 · 자동) ──────────────────────┐
│                                                                  │
│  pykrx ─── collector/collect.py ────────▶ stocks                  │
│  (KRX)                                    daily_price   (date,ticker)
│                                           daily_fundamental (date,ticker)
│                                           snapshot      (ticker) ※최신만
│                                           collect_log                        
│                                                                  │
│  FRED ─┐                                                         │
│  ECOS ─┼── collector/collect_macro.py ──▶ macro_daily   (date)   │
│  pykrx ┘                                  macro_series  (series_id)
└──────────────────────────────────────────────────────────────────┘
                              │
┌─ B. 분석 파이프라인 (프롬프트 · 매일 스케줄) ─────────────────────┐
│                                                                  │
│  daily_movers 뷰 조회 ──▶ 스크리닝 대상 확정                      │
│         │                                                        │
│  stock-news-mcp ────────▶ stock_analysis          (base_date,ticker)
│  (네이버 뉴스)             news                    (base_date,url)
│                            market_daily_commentary (report_date)  │
│                            sector_performance      (base_date)    │
│                            daily_brief             (base_date)    │
└──────────────────────────────────────────────────────────────────┘
                              │
┌─ C. 웹 (Next.js on Vercel · 읽기 전용) ──────────────────────────┐
│  daily_quote ─▶ daily_movers ─▶ surge_calendar                    │
│  stock_analysis + 시세 ─▶ keyword_board                            │
│  report_dates (날짜 선택기)                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## A. 수집기 — 코드가 자동으로 채운다

| 소스 | 스크립트 | 대상 테이블 | 키 | 실행 |
|---|---|---|---|---|
| pykrx (KRX) | `collector/collect.py` | `stocks` | `ticker` | 평일 16:30 |
| | | `daily_price` | `(date, ticker)` | 누적 |
| | | `daily_fundamental` | `(date, ticker)` | 누적 |
| | | `snapshot` | `ticker` | **덮어쓰기** |
| FRED · ECOS · pykrx | `collector/collect_macro.py` | `macro_daily` | `date` | 평일 18:00 |
| | | `macro_series` | `series_id` | 메타 |

**`snapshot` 만 성격이 다르다.** PK가 `ticker` 단독이라 종목별 최신 1행만 남고 과거가 사라진다.
날짜별 이력이 필요하면 반드시 `daily_price` 를 쓴다. 웹의 급등 캘린더·일자별 등락률이 전부 여기서 나온다.

**`macro_daily` 는 매 실행마다 2015년부터 전체를 다시 올린다.** 그래서 시리즈를 새로 추가하면
한 번만 돌려도 과거분이 통째로 채워진다. 휴일·미발표 구간은 직전값으로 forward-fill 된다.

## B. 분석 파이프라인 — 프롬프트가 채운다

| 테이블 | 키 | 담는 것 |
|---|---|---|
| `stock_analysis` | `(base_date, ticker)` | 산업·테마·이슈 키워드, 상승/하락 이유, 관련종목, 기사링크 |
| `news` | `(base_date, url)` 유니크 | 기사 제목·URL·언론사·요약·연관종목·감성 |
| `market_daily_commentary` | `report_date` | 지수 종가·등락, 서술형 시황 4섹션 |
| `sector_performance` | `(base_date, sector)` | 업종별 평균 등락률 |
| `daily_brief` | `base_date` | 헤드라인·요약·특이점·관전포인트 |

**모두 날짜가 키에 들어간다.** 7/31 을 고쳐도 7/29 는 그대로다. 같은 날짜를 다시 적재하면
그 날짜 행만 갱신된다(upsert). 날짜별로 완전히 독립적으로 정제된다.

### 현재 적재 상태

| 날짜 | daily_price | stock_analysis | news | 시황 |
|---|---|---|---|---|
| 2026-07-28 | — | 21 | — | `market_summary` |
| 2026-07-29 | — | 24 | — | `market_summary` |
| 2026-07-30 | 634 | **0** | 1 | `market_daily_commentary` |
| 2026-07-31 | 629 | 51 | 23 | `market_daily_commentary` |

7/30 은 시세와 시황은 있는데 종목별 분석이 비어 있다. 그날 화면의 산업·테마·이슈 컬럼이 비는 이유다.

## C. 웹 — 뷰가 A와 B를 합친다

| 뷰 | 조합 |
|---|---|
| `daily_quote` | `daily_price` + `lag()` 전일종가 + `stocks`/`snapshot`/`daily_fundamental` 보강 |
| `daily_movers` | `daily_quote` + 스크리닝 규칙 판정(급등/급락/변동/거래대금) |
| `surge_calendar` | `daily_movers` 일자별 집계 |
| `keyword_board` | `stock_analysis` 키워드 × `daily_quote`/`screening` 시세 |
| `report_dates` | 날짜가 존재하는 모든 테이블의 합집합 (날짜 선택기용) |

웹은 이 뷰들만 읽으므로 **화면 코드를 고치지 않아도 데이터만 갱신되면 반영된다.**
`revalidate = 1800` (30분 ISR) 이라 재배포도 필요 없다.

## 구세대 테이블

`trading_days` · `screening` · `market_summary` 는 7/29 까지 쓰이던 이전 파이프라인 산물이다.
지금은 `stock_analysis` · `market_daily_commentary` 로 이관됐고, 웹은 옛 날짜를 위해 폴백으로만 읽는다.
새로 적재할 때는 신규 테이블만 쓴다.
