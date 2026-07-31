# 일별 증시 분석 — 매일 실행 프롬프트

스케줄러에 등록해 매일 실행한다. 아래 `---` 사이를 그대로 붙여넣으면 된다.
웹사이트는 이미 배포돼 있고 **Supabase 데이터만 갱신하면 화면이 따라 바뀐다.** 홈페이지를 다시 만들지 않는다.

데이터 흐름 전체는 [data-flow.md](./data-flow.md) 참고.

---

국내 증시 일별 분석을 수행하고 Supabase(프로젝트 `foarepewnnvichebxwvl`, KRX)에 적재해줘.
웹사이트는 이미 배포돼 있으니 **코드는 건드리지 말고 데이터만 갱신**한다.

적재 대상은 `stock_analysis`, `news`, `market_daily_commentary`, `sector_performance`, `daily_brief` 다섯 개다.
모두 날짜가 키에 들어가므로 다른 날짜 데이터는 절대 건드리지 않는다.
`daily_price` · `snapshot` · `macro_daily` 는 GitHub Actions 수집기 담당이니 손대지 않는다.

## STEP 0 — 기준일자(BASE_DATE) 확정

- 오늘 날짜를 확인하고 아래 규칙으로 **하나만** 정한다. 이후 모든 단계는 이 날짜만 다룬다.
- 날짜를 지정받았으면 그 날짜를 쓴다. 휴장일이면 **중단하고 그 사실만 보고**한다. 임의로 옮기지 않는다.
- 지정이 없으면 가장 최근 거래일 — 평일 15:30 이후면 당일, 그 외(장중·개장전·주말·공휴일)는 직전 거래일.
- 주말·공휴일 자동 실행은 건너뛴다.
- **확정 직후 검증**: `select * from daily_price where date = 'BASE_DATE' limit 1` 로 시세가 실제로 적재됐는지 본다.
  비어 있으면 수집기가 아직 안 돌았다는 뜻이므로 **중단하고 보고**한다. 없는 데이터로 분석하지 않는다.

## STEP 1 — 스크리닝 대상 확정

`daily_movers` 뷰를 BASE_DATE로 조회한다. 이 뷰가 이미 아래 규칙으로 `category` 를 만들어 둔다.

| 구분 | 조건 | 정렬 |
|---|---|---|
| 급등주 | 전일 대비 +15% 이상 | 등락률 내림차순 |
| 급락주 | 전일 대비 -10% 이하 | 등락률 오름차순 |
| 6%이상변동 | 당일 고가/저가 변동폭 6% 이상 | 변동폭 내림차순 |
| 거래대금상위 | 거래대금 500억원 이상 | 거래대금 내림차순 |

각 구분 상위 20종목의 합집합을 만든다. 중복 종목은 한 행으로 통합하고 `category` 에 조건을 모두 나열한다.

### 이상치 검증 — 건너뛰지 않는다

등락률이 **±30%를 넘는 종목**은 제도상 가격제한폭을 벗어난 값이므로 반드시 원인을 확인한다.
액면병합·액면분할·감자·거래재개·재상장 중 하나일 가능성이 높다.

- 해당 종목명으로 뉴스를 조회해 권리변동 여부와 **변경 기준가**를 확인한다.
- 확인되면 `issue_note` 에 사실과 실제 등락률을 명시하고, 구분값이 잘못 붙었다는 점도 함께 적는다.
- 확인되지 않으면 "원인이 확인되지 않았다"고 적는다. 추정으로 메우지 않는다.

> 실제 사례 — 2026-07-31 금호전기가 +360%로 잡혔으나 5:1 액면병합 후 거래재개였고,
> 병합 기준가 4,470원 대비 실제로는 -7.94% 하락이었다.

거래량 0, 종가 0, 전일종가 null 인 행도 같은 방식으로 확인하고 이상하면 제외한다.

## STEP 2 — 종목별 이슈 분석 → `stock_analysis`

선정된 **모든 종목**에 대해 `get_korean_stock_news(query=종목명, count=10~15)` 로 뉴스를 수집한다.
이 도구는 날짜 지정이 안 되고 최신순으로만 주므로, `pubDate` 를 보고 **BASE_DATE 당일 기사**를 골라낸다.
당일 기사만으로 부족할 때만 D-1까지 쓰고 본문에 `(7/30 보도)` 처럼 날짜를 밝힌다. **D-2 이전은 쓰지 않는다.**

| 컬럼 | 내용 |
|---|---|
| `base_date`, `ticker`, `name` | 기준일, 종목코드, 종목명 |
| `industry_kw` | 핵심 사업 아이템 1개 (예: HBM, MLCC, 반도체기판) |
| `theme_kw` | 시장이 묶어 부르는 흐름 1개 (예: AI반도체, 전력인프라) |
| `issue_kw` | **그날 주가를 움직인 원인** 1개 |
| `issue_note` | 상승·하락의 배경과 원인 1~2문장 |
| `related` | 동일 테마·섹터 연관 종목 3~5개 |
| `ref_link1~3`, `ref_title1~3` | 근거로 실제 사용한 기사 URL·제목 (최대 3개) |

### `issue_note` 작성 기준 — 가장 중요

**숫자를 반복하지 마라.** 등락률·거래대금·변동폭은 이미 표에 컬럼으로 나온다.
"+29.95% 상한가로 마감했다" 는 정보가 0이다.

**왜 움직였는지, 그 배경에 무엇이 있는지, 앞으로 무엇이 우려·기대되는지를 써라.**

- 나쁜 예: `전일까지 사흘간의 AI반도체 투매가 하루 만에 되돌려지며 +29.95% 상한가로 마감, 상장 이후 첫 상한가다. 외국인이 7조원대 순매수로 돌아서며 반등을 주도했고 거래대금 17.5조원으로 시장 1위였다.`
- 좋은 예: `아마존이 클라우드 수익 64% 증가와 함께 올해 자본지출을 2,200억 달러로 상향하는 등 빅테크의 AI 인프라 투자 확대 기조가 재확인되면서, 사흘간 주가를 눌렀던 메모리 업황 둔화 우려가 빠르게 해소됐다. 다만 중국 CXMT의 증설 일정은 여전히 공급과잉 논쟁의 불씨로 남아 있다.`

`issue_kw` 도 같은 원칙이다. **결과가 아니라 원인**을 담는다.

- 나쁜 예: `사상첫상한가`, `상한가`, `급등`, `변동성확대`
- 좋은 예: `빅테크자본지출확대`, `메모리우려완화`, `SK실트론인수`, `수주목표상향`, `실적서프라이즈`

### 사실 기반 원칙 — 예외 없다

- **추측을 쓰지 않는다.** 기사에 없는 인과관계를 지어내지 않는다.
- 종목 고유 원인을 못 찾았으면 억지로 만들지 말고, 시장 전체 동인을 근거 기사와 함께 쓰고
  `종목 고유 공시는 확인되지 않는다` 고 명시한다.
- **`ref_link` 는 도구 응답에 실제로 있던 URL만 넣는다.** 없으면 비워 둔다. 링크를 만들어내지 않는다.
- `get_stock_info` 의 `sector`/`industry` 는 국내 종목에서 대부분 `null` 이다. 산업키워드는 뉴스 맥락으로 판정한다.

## STEP 3 — 뉴스 적재 → `news`

STEP 2에서 모은 기사 중 의미 있는 것을 넣는다. 시장 전체 뉴스는 `get_market_news` 로 추가 수집한다.

| 컬럼 | 내용 |
|---|---|
| `base_date`, `title`, `url`, `press`, `published_at` | 기준일, 제목, 실제 URL, 언론사, 발행일시 |
| `summary` | 기사 핵심 1~2문장. **제목 복사가 아니라 내용 요약** |
| `tickers[]`, `stock_names[]` | 연관 종목코드·종목명 (**순서 일치**) |
| `theme_kw`, `issue_kw` | 해당 기사의 테마·이슈 |
| `sentiment` | `positive` / `negative` / `neutral` |
| `is_market_wide` | 개별종목이 아닌 시장 전체 뉴스면 `true` |

`(base_date, url)` 이 유니크하므로 중복은 자동으로 걸러진다.

## STEP 4 — 시황 적재 → `market_daily_commentary`

BASE_DATE 1행을 넣는다.

| 컬럼 | 내용 |
|---|---|
| `report_date` | 기준일 |
| `kospi_close`, `kospi_change_pt`, `kospi_change` | 종가, 전일대비 포인트, 등락률(%) |
| `kosdaq_close`, `kosdaq_change_pt`, `kosdaq_change` | 상동 |
| `usdkrw`, `usdkrw_change_pct` | 원/달러 종가·등락률 |
| `sp500_close`, `sp500_change_pct`, `nasdaq_close`, `nasdaq_change_pct` | 직전 미국장 종가 |
| `market_overview` / `investor_trend` / `sector_theme_analysis` / `additional_insight` | 서술형 4섹션 |
| `circuit_breaker` | 서킷브레이커 발동 여부 |

업종별 등락률은 `get_sector_performance(market='kr')` 로 받아 `sector_performance` 에도 적재한다.

### 서술 원칙 — 확보하지 못한 데이터는 아예 언급하지 않는다

`"실측 데이터를 확보하지 못했으므로"`, `"이번 실행에서 확인되지 않아"`, `"미확인으로 둔다"`,
`"검증되지 않아"`, `"API 접근이 차단되어"` 같은 **메타 설명을 쓰지 않는다.**
확인된 사실만 쓰고, 확인 안 된 항목은 그냥 빼면 된다.

단 **정성 해석을 사실처럼 쓰는 것도 금지**다. 보도를 인용할 때는 `~로 보도됐다`, `~해석이 제기됐다`
처럼 출처를 밝혀 실측과 구분한다.

### `additional_insight` 작성 기준

나열이 아니라 **해석**을 쓴다. 무엇이 특이했고, 그게 무엇을 시사하며, 다음에 무엇을 봐야 하는지까지 이어져야 한다.

> 좋은 예: `사흘간의 급락이 중국 CXMT 증설발 공급과잉 우려에서 비롯됐다면, 이날 반등은 수요 측 지표인 빅테크 자본지출로 그 우려를 상쇄한 구조다. 즉 공급 논쟁 자체가 해소된 것이 아니라 수요 전망이 이를 압도한 국면이어서, CXMT의 실제 증설 일정이 확인되기 전까지 같은 폭의 변동성이 재현될 여지가 남는다.`

가능한 범위에서 다룰 것 — 서킷브레이커·사이드카·VI 발동, 공매도 과열종목 지정, 지수와 환율·금리·유가의
방향이 엇갈렸다면 그 의미, 업종 간 순환매인지 전면적 방향 전환인지, 해외 증시·정책 이벤트 연동,
다음 거래일 예정 이벤트.

## STEP 5 — 데일리 브리핑 → `daily_brief` (선택)

| 컬럼 | 형식 |
|---|---|
| `base_date` | 기준일 |
| `title` | 그날을 한 줄로 |
| `summary` | 2~4문장 |
| `highlights` | `[{label, detail, kind:'positive'|'negative'|'neutral'}]` |
| `watch_next` | `["다음 거래일 관전 포인트", ...]` |
| `sources` | `[{title, url, date}]` |

## STEP 6 — 적재 후 검증 (필수)

**적재하고 끝내지 않는다.** 아래를 순서대로 실행하고 결과를 보고한다.

### 6-1. 날짜 오염 검사

```sql
select 'stock_analysis' t, base_date::text d, count(*) n from stock_analysis where base_date <> 'BASE_DATE' and base_date >= 'BASE_DATE' group by 1,2
union all select 'news', base_date::text, count(*) from news where base_date <> 'BASE_DATE' and base_date >= 'BASE_DATE' group by 1,2;
```
BASE_DATE 이후 날짜로 잘못 들어간 행이 있으면 즉시 삭제한다.

### 6-2. 적재 건수 확인

```sql
select
  (select count(*) from stock_analysis where base_date='BASE_DATE') as analysis,
  (select count(*) from news where base_date='BASE_DATE') as news,
  (select count(*) from market_daily_commentary where report_date='BASE_DATE') as commentary,
  (select count(*) from sector_performance where base_date='BASE_DATE') as sectors;
```
`analysis` 가 STEP 1의 선정 종목 수와 일치해야 한다. 다르면 누락 종목을 찾아 채운다.
`commentary` 는 정확히 1이어야 한다.

### 6-3. 금지 표현 검사

```sql
select report_date from market_daily_commentary
where report_date='BASE_DATE'
  and (coalesce(market_overview,'')||coalesce(investor_trend,'')||
       coalesce(sector_theme_analysis,'')||coalesce(additional_insight,''))
      ~ '확보하지 못|이번 실행|미확인|검증되지 않아|정성 해석|접근이 차단';
```
한 건이라도 걸리면 해당 문장을 지우고 다시 쓴다.

### 6-4. 숫자 반복 검사

```sql
select ticker, name, issue_note from stock_analysis
where base_date='BASE_DATE' and issue_note ~ '[0-9]{1,2}\.[0-9]{1,2}%';
```
등락률이 본문에 박혀 있으면 원인 서술로 고쳐 쓴다. 기사에서 인용한 실적·투자금액 수치는 예외다.

### 6-5. 결과형 키워드 검사

```sql
select ticker, name, issue_kw from stock_analysis
where base_date='BASE_DATE'
  and issue_kw ~ '상한가|하한가|급등|급락|변동성확대|폭등|폭락';
```
걸린 종목은 원인 기반 키워드로 교체한다.

### 6-6. 링크 무결성 검사

```sql
select ticker, name, ref_link1, ref_link2, ref_link3 from stock_analysis
where base_date='BASE_DATE'
  and (ref_link1 !~ '^https?://' or ref_link2 !~ '^https?://' or ref_link3 !~ '^https?://');
```
`http`/`https` 로 시작하지 않는 값이 있으면 비운다.
그리고 **본인이 넣은 모든 `ref_link` 가 실제 도구 응답에 있던 URL인지 스스로 대조한다.**
기억에 의존해 만든 링크가 하나라도 있으면 삭제한다.

### 6-7. 사실 대조

`stock_analysis` 상위 5종목과 `market_daily_commentary` 를 다시 읽고, 각 문장의 주장이
첨부한 기사 제목·내용과 실제로 맞는지 확인한다. 특히 아래를 본다.

- 인용한 금액·비율·순위가 기사에 나온 값과 같은가 (예: 자본지출 2,200억 달러, 영업익 증가율)
- 기사에 없는 인과관계를 만들어 쓰지 않았는가
- 지수 종가·등락률이 서로 다른 두 출처에서 일치하는가

불일치가 있으면 고치고, 확인이 안 되면 그 문장을 삭제한다.

## 공통 제약

- **기준일자는 하나.** 서로 다른 날짜의 시세·뉴스를 섞지 않는다.
- 전 종목 반복 스캔, 과거 시계열 루프 금지. STEP 1에서 확정된 유니버스로만 작업한다.
- 거래대금·시가총액·순매수는 **원 단위 정수**로 저장한다.
- 종목 선정은 실제 수집된 시세 기반으로만. 조건 미달 구분은 0종목으로 두고 명시한다. **숫자를 지어내지 않는다.**
- SQL `update`/`insert` 에는 항상 `base_date = 'BASE_DATE'` 조건을 넣어 다른 날짜를 건드리지 않는다.

## 완료 후 보고

1. BASE_DATE 와 각 테이블 적재 행 수
2. 구분별 종목 수 (급등/급락/변동/거래대금)
3. **STEP 1 이상치 검증에서 걸린 종목과 확인 결과**
4. **STEP 6 검사별 통과/수정 내역** (6-1 ~ 6-7 각각)
5. 뉴스를 찾지 못해 시장 동인으로 대체한 종목 목록
6. 확인이 안 돼 서술에서 뺀 항목

---

## 참고 — 웹사이트가 읽는 곳

| 화면 | 테이블 · 뷰 |
|---|---|
| 상단 지수 (KOSPI·KOSDAQ·S&P·나스닥·다우) | `market_daily_commentary`, `macro_daily` |
| 매크로 지표 보드 (한국/미국 분리) | `macro_series`, `macro_daily` — 수집기가 자동 갱신 |
| 데일리 브리핑 | `daily_brief` |
| 테마·섹터 분석 | `sector_performance` + `market_daily_commentary.sector_theme_analysis` |
| 서술형 시황 | `market_daily_commentary` |
| 종목 스크리닝 표 | `daily_movers` 뷰 + `stock_analysis` |
| 키워드보드 | `keyword_board` 뷰 (`stock_analysis` 기반) |
| 급등 캘린더 | `keyword_board`, `surge_calendar` 뷰 |
| 뉴스 | `news` |
| 증시 캘린더 | `market_calendar` |
