# 일별 증시 분석 — 매일 실행 프롬프트 (최종본)

스케줄러에 등록해 매일 실행한다. 아래 `---` 사이를 **그대로 복사**해 넣으면 된다.

- 웹사이트는 이미 배포돼 있다. **코드를 건드리지 않고 Supabase 데이터만 갱신**하면 화면이 30분 안에 따라 바뀐다.
- 데이터 흐름 전체는 [data-flow.md](./data-flow.md) 참고.

---

국내 증시 일별 분석을 수행하고 Supabase 프로젝트 `foarepewnnvichebxwvl`(이름: KRX)에 적재해줘.
웹사이트는 이미 배포돼 있으니 **코드는 절대 건드리지 말고 데이터만 갱신**한다.

## 0. 역할 분담 — 내가 쓰는 테이블은 5개뿐

| 구분 | 테이블 | 누가 채우나 |
|---|---|---|
| ✍️ **내가 쓴다** | `stock_analysis` · `news` · `market_daily_commentary` · `sector_performance` · `daily_brief` | 이 프롬프트 |
| 📖 읽기만 한다 | `daily_movers` · `daily_quote` 뷰 | — |
| 🚫 건드리지 않는다 | `daily_price` · `daily_fundamental` · `snapshot` · `stocks` · `macro_daily` · `macro_series` | GitHub Actions 수집기 |

모든 쓰기 테이블은 **날짜가 키에 들어간다.** 다른 날짜 행은 어떤 경우에도 수정·삭제하지 않는다.
`update`/`delete` 에는 반드시 `base_date = 'BASE_DATE'` 조건을 붙인다.

---

## STEP 0 — 실행 여부 판단과 기준일자(BASE_DATE) 확정

**아래 순서대로 판정한다. 위쪽 규칙이 항상 우선한다.**

### 0-1. 주말이면 즉시 종료

오늘이 **토요일 또는 일요일**이면 아무것도 하지 않고 끝낸다.
`이번 실행은 주말이라 건너뜁니다` 한 줄만 보고하고 **어떤 테이블에도 쓰지 않는다.**
직전 금요일 데이터는 금요일 저녁 실행에서 이미 처리됐으므로 다시 만들지 않는다.

### 0-2. 날짜를 명시적으로 지정받았으면 그 날짜만 쓴다

임의로 앞뒤로 옮기지 않는다. 그 날짜가 휴장일이면 0-4 에서 걸러진다.

### 0-3. 지정이 없으면 오늘을 BASE_DATE 로 잡는다

평일 장 마감(15:30) 이후 실행이 전제다. 개장 전이나 장중에 실행됐다면
`아직 장이 끝나지 않아 건너뜁니다` 로 보고하고 종료한다.
**직전 거래일로 되돌아가지 않는다** — 그날은 이미 처리됐다.

### 0-4. 휴장일 판정 — 데이터로 확인한다

공휴일 목록을 외워서 판단하지 않는다. **수집기는 거래일에만 `daily_price` 를 쓰므로,
그 날짜에 시세가 있으면 거래일이고 없으면 휴장일이거나 수집 미완료다.**

```sql
select count(*) as rows from daily_price where date = 'BASE_DATE';
```

- **0 이면 중단하고 보고한다.** 휴장일(공휴일·임시휴장)이거나 수집기가 아직 안 돌았다는 뜻이다.
  둘 중 무엇인지는 `collect_log` 로 구분한다.

```sql
select ran_at, base_date, mode, rows, status, message
from collect_log
where base_date = 'BASE_DATE'
order by ran_at desc;
```

| collect_log 상태 | 해석 | 보고 문구 |
|---|---|---|
| 행이 아예 없음 | 수집기가 그날을 돌지 않음 → **휴장일 가능성 높음** | `휴장일로 보입니다 (수집 기록 없음)` |
| `status='failed'` | 수집기가 돌았으나 실패 | `수집기 실패로 시세가 없습니다: {message}` |
| `status='success'` 인데 `daily_price` 0 | 유니버스 산출 문제 | `수집은 성공했으나 시세가 비어 있습니다` |

- 없는 데이터로 분석하지 않는다. **직전 거래일로 대체하지도 않는다.**

### 0-5. 중복 실행 방지

이미 그 날짜가 처리됐는지 확인한다.

```sql
select
  (select count(*) from market_daily_commentary where report_date = 'BASE_DATE') as commentary,
  (select count(*) from stock_analysis          where base_date   = 'BASE_DATE') as analysis;
```

- 둘 다 0 → 신규 실행. 정상 진행한다.
- 값이 있는데 **재실행을 지시받지 않았다면** `이미 처리된 날짜입니다` 로 보고하고 종료한다.
- 재실행을 지시받았다면 덮어쓰되, `sector_performance` 는 id 가 bigserial 이라 중복이 쌓이므로
  **반드시 그 날짜를 먼저 지우고** 넣는다.

```sql
delete from sector_performance where base_date = 'BASE_DATE';
```

### 0-6. 누락된 날짜 확인

스케줄이 걸러졌거나 실패해서 **시세는 있는데 리포트가 없는 날짜**가 있는지 본다.

```sql
select p.date::text as 누락일
from (select distinct date from daily_price) p
left join market_daily_commentary c on c.report_date = p.date
where c.report_date is null and p.date < 'BASE_DATE'
order by p.date desc
limit 5;
```

결과를 기억해 두고 **STEP 7 에서 보충**한다. 여기서는 조회만 한다.
오늘치 처리가 항상 우선이므로 STEP 1~6 을 먼저 끝낸다.

## STEP 1 — 스크리닝 대상 확정

`daily_movers` 뷰를 조회한다. 이 뷰가 이미 아래 규칙으로 `category` 를 만들어 둔다.

| 구분값 | 조건 | 상위 20 정렬 |
|---|---|---|
| `급등주` | 전일 대비 +15% 이상 | `change_rate` 내림차순 |
| `급락주` | 전일 대비 -10% 이하 | `change_rate` 오름차순 |
| `6%이상변동` | (고가-저가)/저가 ≥ 6% | `swing_pct` 내림차순 |
| `거래대금상위` | 거래대금 ≥ 500억원 | `trade_value` 내림차순 |

각 구분에서 상위 20종목을 뽑아 **합집합**을 만든다. 여러 조건에 걸린 종목은 한 행으로 통합되며
`category` 에 `급등주 / 6%이상변동 / 거래대금상위` 처럼 모두 나열돼 있다.

```sql
select ticker, name, market, open, close, prev_close, change_rate, swing_pct,
       trade_value, market_cap, foreign_net_buy, inst_net_buy, indiv_net_buy, category
from daily_movers
where base_date = 'BASE_DATE' and category is not null
order by trade_value desc nulls last;
```

### 1-2. 이상치 검증 — 건너뛰지 않는다

국내 주식의 하루 가격제한폭은 ±30% 다. **|등락률| > 30% 인 종목은 정상 거래가 아니다.**

```sql
select ticker, name, change_rate, prev_close, close
from daily_movers
where base_date = 'BASE_DATE' and abs(change_rate) > 30;
```

걸린 종목은 반드시 뉴스로 원인을 확인한다 — 액면병합·액면분할·감자·거래재개·재상장 중 하나다.

- 확인되면 `issue_note` 에 **사실과 실제 등락률**을 쓰고, 구분값이 잘못 붙었다는 점도 명시한다.
- 확인 안 되면 "원인이 확인되지 않았다"고 쓴다. **추정으로 메우지 않는다.**

> 실제 사례 — 2026-07-31 금호전기가 +360%로 잡혔으나 5:1 액면병합 후 거래재개였다.
> 병합 기준가 4,470원 대비 실제로는 **-7.94% 하락**이었고, 급등주 분류가 잘못된 상태였다.

`close = 0`, `volume = 0`, `prev_close is null` 인 행도 같은 방식으로 확인하고 이상하면 제외한다.

---

## STEP 2 — 종목별 이슈 분석 → `stock_analysis`

### 테이블 구조

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `base_date` | date | **PK1.** 기준일 |
| `ticker` | text | **PK2.** 6자리 종목코드 |
| `name` | text | 종목명 |
| `industry_kw` | text | **산업키워드** — 핵심 사업 아이템 1개 (HBM, MLCC, 반도체기판) |
| `theme_kw` | text | **테마키워드** — 시장이 묶어 부르는 흐름 1개 (AI반도체, 전력인프라, 방산) |
| `issue_kw` | text | **이슈키워드** — 그날 주가를 움직인 **원인** 1개 |
| `issue_note` | text | **상승/하락 이유** — 배경·원인·전망 1~2문장 |
| `related` | text | 동일 테마·섹터 연관 종목 3~5개, 쉼표 구분 |
| `ref_link1~3` | text | 근거 기사 URL (최대 3개) |
| `ref_title1~3` | text | 각 기사 제목 |
| `source` | text | 기본값 `mcp`. 그대로 둔다 |
| `updated_at` | timestamptz | 갱신 시각. `now()` |

### 수집 방법

선정된 **모든 종목**에 대해 `get_korean_stock_news(query=종목명, count=10~15)` 를 호출한다.
이 도구는 **날짜 지정이 안 되고 최신순으로만** 주므로, `pubDate` 를 보고 **BASE_DATE 당일 기사**를 골라낸다.

- 당일 기사만으로 부족할 때만 D-1까지 쓰고 본문에 `(7/30 보도)` 처럼 날짜를 밝힌다.
- **D-2 이전은 쓰지 않는다.**
- 시장 전체 동인을 파악하려면 `get_market_news`, `get_korean_stock_news(query="코스피 반등 이유")` 같은
  질의를 먼저 돌려 **그날의 큰 그림**을 잡고 시작한다.

### `issue_note` 작성 기준 — 가장 중요

**숫자를 반복하지 마라.** 등락률·거래대금·변동폭은 이미 표에 컬럼으로 나온다.
"+29.95% 상한가로 마감했다"는 정보량이 0이다.

**왜 움직였는지, 배경에 무엇이 있는지, 앞으로 무엇이 우려·기대되는지를 써라.**

❌ 나쁜 예
> 전일까지 사흘간의 AI반도체 투매가 하루 만에 되돌려지며 +29.95% 상한가로 마감, 상장 이후 첫 상한가다. 외국인이 7조원대 순매수로 돌아서며 반등을 주도했고 거래대금 17.5조원으로 시장 1위였다.

✅ 좋은 예
> 아마존이 클라우드 수익 64% 증가와 함께 올해 자본지출을 2,200억 달러로 상향하는 등 빅테크의 AI 인프라 투자 확대 기조가 재확인되면서, 사흘간 주가를 눌렀던 메모리 업황 둔화 우려가 빠르게 해소됐다. 다만 중국 CXMT의 증설 일정은 여전히 공급과잉 논쟁의 불씨로 남아 있다.

### `issue_kw` 작성 기준

결과가 아니라 **원인**을 담는다.

| ❌ 결과형 | ✅ 원인형 |
|---|---|
| `사상첫상한가`, `상한가`, `급등`, `변동성확대` | `빅테크자본지출확대`, `메모리우려완화`, `SK실트론인수`, `수주목표상향`, `실적서프라이즈`, `액면병합거래재개` |

개별 촉매를 못 찾은 종목은 시장 전체 동인을 쓰되 `위험선호회복`, `순환매유입`, `수급주도변동` 처럼
**작동한 메커니즘**을 키워드로 삼는다.

### 사실 기반 원칙 — 예외 없다

- **추측을 쓰지 않는다.** 기사에 없는 인과관계를 만들지 않는다.
- 종목 고유 원인을 못 찾았으면 억지로 만들지 말고 `종목 고유 공시는 확인되지 않는다` 고 명시한다.
- **`ref_link` 는 도구 응답에 실제로 있던 URL만** 넣는다. 없으면 비운다. **링크를 지어내지 않는다.**
- `get_stock_info` 의 `sector`/`industry` 는 국내 종목에서 **대부분 `null`** 이다(SK하이닉스·삼성전자 확인).
  산업키워드는 뉴스 맥락으로 판정한다.

---

## STEP 3 — 뉴스 적재 → `news`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `base_date` | date | 기준일. `(base_date, url)` 이 유니크 |
| `published_at` | timestamptz | 기사 발행일시. `pubDate` 를 그대로 |
| `title` | text | **필수.** 기사 제목 |
| `url` | text | **필수.** 도구 응답의 실제 URL |
| `press` | text | 언론사 |
| `summary` | text | 기사 핵심 1~2문장. **제목 복사가 아니라 내용 요약** |
| `tickers` | text[] | 연관 종목코드 배열 |
| `stock_names` | text[] | 연관 종목명 배열. **tickers 와 순서 일치** |
| `theme_kw` / `issue_kw` | text | 해당 기사의 테마·이슈 |
| `sentiment` | text | `positive` / `negative` / `neutral` 중 하나 |
| `is_market_wide` | boolean | 개별종목이 아닌 시장 전체 뉴스면 `true` |

STEP 2에서 모은 기사 중 의미 있는 것을 넣고, 시장 전체 뉴스는 `get_market_news` 로 추가 수집한다.
`(base_date, url)` 유니크 제약이 있으므로 `on conflict do nothing` 으로 중복을 흘려보낸다.

---

## STEP 4 — 시황 적재 → `market_daily_commentary`

BASE_DATE 로 **정확히 1행**을 넣는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `report_date` | date | **PK.** 기준일 |
| `kospi_close` | numeric | KOSPI 종가 |
| `kospi_change_pt` | numeric | KOSPI 전일대비 **포인트** |
| `kospi_change` | numeric | KOSPI 전일대비 **퍼센트(%)** ← 이름이 헷갈리니 주의 |
| `kosdaq_close` / `kosdaq_change_pt` / `kosdaq_change` | numeric | 코스닥 동일 구조 |
| `usdkrw` / `usdkrw_change_pct` | numeric | 원/달러 종가·등락률 |
| `sp500_close` / `sp500_change_pct` | numeric | 직전 미국장 S&P500 |
| `nasdaq_close` / `nasdaq_change_pct` | numeric | 직전 미국장 나스닥 |
| `circuit_breaker` | boolean | 서킷브레이커 발동 여부 |
| `market_overview` | text | **서술 1** — 시장 개요 |
| `investor_trend` | text | **서술 2** — 투자주체 동향 |
| `additional_insight` | text | **서술 3** — 추가 인사이트 |
| `sector_theme_analysis` | text | **서술 4** — 테마·섹터 분석 |
| `updated_at` | timestamptz | `now()` |

> 화면의 "서술형 시황"은 이 4개 텍스트 칸을 2×2로 배치한다.
> 업종 막대그래프는 `sector_performance` 를 따로 읽으므로, `sector_theme_analysis` 에는 **해석만** 쓴다.

### 함께 적재 → `sector_performance`

`get_sector_performance(market='kr')` 결과를 넣는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `base_date` | date | 기준일 |
| `sector` | text | 업종명 (반도체, 자동차, 2차전지, 방산, 조선, 인터넷플랫폼, 금융, 바이오 …) |
| `avg_change_pct` | numeric | 해당 업종 대표 종목들의 평균 등락률 |

**같은 날짜를 다시 적재할 때는 먼저 그 날짜 행을 지우고 넣는다**(id 가 bigserial 이라 중복 누적됨).

```sql
delete from sector_performance where base_date = 'BASE_DATE';
```

### 서술 원칙 ① — 확보하지 못한 데이터는 아예 언급하지 않는다

아래 표현은 **금지**다.

> `실측 데이터를 확보하지 못했으므로` · `이번 실행에서 확인되지 않아` · `미확인으로 둔다`
> `검증되지 않아` · `API 접근이 차단되어` · `정성 해석이다`

확인된 사실만 쓰고, 확인 안 된 항목은 **그냥 빼면 된다.**

단 **정성 해석을 사실처럼 쓰는 것도 금지**다. 보도를 인용할 때는 `~로 보도됐다`, `~해석이 제기됐다`,
`~라고 평가했다` 처럼 출처를 밝혀 실측과 구분한다.

### 서술 원칙 ② — `additional_insight` 는 나열이 아니라 해석

무엇이 특이했고, 그게 **무엇을 시사하며**, 다음에 무엇을 봐야 하는지까지 이어져야 한다.

✅ 좋은 예
> 사흘간의 급락이 중국 CXMT 증설발 공급과잉 우려에서 비롯됐다면, 이날 반등은 수요 측 지표인 빅테크 자본지출로 그 우려를 상쇄한 구조다. 즉 공급 논쟁 자체가 해소된 것이 아니라 수요 전망이 이를 압도한 국면이어서, CXMT의 실제 증설 일정이 확인되기 전까지 같은 폭의 변동성이 재현될 여지가 남는다.

가능한 범위에서 다룰 것 — 서킷브레이커·사이드카·VI 발동, 공매도 과열종목 지정, 지수와 환율·금리·유가의
방향이 엇갈렸다면 그 의미, 업종 간 순환매인지 전면적 방향 전환인지, 해외 증시·정책 이벤트 연동,
다음 거래일 예정 이벤트.

---

## STEP 5 — 데일리 브리핑 → `daily_brief` (선택)

| 컬럼 | 타입 | 형식 |
|---|---|---|
| `base_date` | date | **PK.** 기준일 |
| `title` | text | 그날을 한 줄로 |
| `summary` | text | 2~4문장 |
| `highlights` | jsonb | `[{"label":"...","detail":"...","kind":"positive|negative|neutral"}]` |
| `keywords` | jsonb | `[{"word":"...","weight":1,"kind":"theme"}]` |
| `watch_next` | jsonb | `["다음 거래일 관전 포인트", ...]` |
| `sources` | jsonb | `[{"title":"...","url":"...","date":"..."}]` |

jsonb 4개는 **NOT NULL** 이라 값이 없으면 `'[]'::jsonb` 를 넣는다.

---

## STEP 6 — 발행 전 검증 (필수 · 건너뛰기 금지)

**적재하고 끝내지 않는다.** 아래 7개를 순서대로 실행하고 결과를 보고한다.
하나라도 걸리면 **고친 뒤 다시 실행**한다.

### 6-1. 날짜 오염 검사

```sql
select 'stock_analysis' t, base_date::text, count(*) from stock_analysis
  where base_date > 'BASE_DATE' group by 1,2
union all select 'news', base_date::text, count(*) from news
  where base_date > 'BASE_DATE' group by 1,2
union all select 'sector_performance', base_date::text, count(*) from sector_performance
  where base_date > 'BASE_DATE' group by 1,2;
```
미래 날짜로 잘못 들어간 행이 있으면 즉시 삭제한다.

### 6-2. 적재 건수 확인

```sql
select
  (select count(*) from stock_analysis          where base_date  = 'BASE_DATE') as analysis,
  (select count(*) from news                    where base_date  = 'BASE_DATE') as news,
  (select count(*) from market_daily_commentary where report_date= 'BASE_DATE') as commentary,
  (select count(*) from sector_performance      where base_date  = 'BASE_DATE') as sectors;
```
- `analysis` = STEP 1 선정 종목 수와 **정확히 일치**해야 한다. 다르면 누락 종목을 찾아 채운다.
- `commentary` 는 **반드시 1**.
- `sectors` 가 0이면 업종 막대그래프가 빈 채로 발행된다.

### 6-3. 금지 표현 검사

```sql
select report_date from market_daily_commentary
where report_date = 'BASE_DATE'
  and (coalesce(market_overview,'')||coalesce(investor_trend,'')||
       coalesce(sector_theme_analysis,'')||coalesce(additional_insight,''))
      ~ '확보하지 못|이번 실행|미확인|검증되지 않아|정성 해석|접근이 차단';
```
한 건이라도 걸리면 해당 문장을 지우고 다시 쓴다. **결과가 0행이어야 통과.**

### 6-4. 숫자 반복 검사

```sql
select ticker, name, issue_note from stock_analysis
where base_date = 'BASE_DATE' and issue_note ~ '[0-9]{1,2}\.[0-9]{1,2}%';
```
등락률이 본문에 박혀 있으면 원인 서술로 고쳐 쓴다.
기사에서 인용한 **실적·투자금액·점유율** 수치는 예외로 허용한다.

### 6-5. 결과형 키워드 검사

```sql
select ticker, name, issue_kw from stock_analysis
where base_date = 'BASE_DATE'
  and issue_kw ~ '상한가|하한가|급등|급락|변동성확대|폭등|폭락';
```
걸린 종목은 원인 기반 키워드로 교체한다.

### 6-6. 링크 무결성 검사

```sql
select ticker, name, ref_link1, ref_link2, ref_link3 from stock_analysis
where base_date = 'BASE_DATE'
  and (ref_link1 !~ '^https?://' or ref_link2 !~ '^https?://' or ref_link3 !~ '^https?://');

select id, title, url from news
where base_date = 'BASE_DATE' and url !~ '^https?://';
```
형식이 틀린 값은 비운다. 그리고 **넣은 모든 URL이 실제 도구 응답에 있던 것인지 스스로 대조한다.**
기억에 의존해 만든 링크가 하나라도 있으면 삭제한다.

### 6-7. 사실 대조 — 최종 관문

`stock_analysis` 상위 5종목과 `market_daily_commentary` 전문을 **다시 읽고** 아래를 확인한다.

- [ ] 인용한 금액·비율·순위가 첨부 기사에 나온 값과 **같은가** (예: 자본지출 2,200억 달러, 영업익 증가율 3600%)
- [ ] 기사에 없는 인과관계를 만들어 쓰지 않았는가
- [ ] 지수 종가·등락률이 **서로 다른 두 출처**에서 일치하는가
- [ ] `kospi_change_pt`(포인트)와 `kospi_change`(%)를 **바꿔 넣지 않았는가**
- [ ] 종목명과 `ticker` 가 올바르게 짝지어져 있는가
- [ ] STEP 1-2 이상치 종목의 서술이 실제 원인과 맞는가

불일치가 있으면 고치고, 확인이 안 되면 **그 문장을 삭제한다.**

---

## STEP 7 — 누락일 자동 보충 (STEP 6 통과 후에만)

**오늘치가 완전히 끝나고 STEP 6 검증을 모두 통과한 뒤에만 실행한다.**
오늘 리포트가 항상 우선이며, 보충은 실패해도 오늘치에 영향을 주지 않는다.

STEP 0-6 에서 찾은 누락일 중 **최근 5거래일 이내**만 대상으로 한다. 그보다 오래된 날짜는 건드리지 않는다.

### 7-1. 보충 범위 — 시황만 채운다

| 테이블 | 보충 | 이유 |
|---|---|---|
| `market_daily_commentary` | ✅ 채운다 | 날짜 지정 질의로 그날 마감 기사 확보 가능 |
| `stock_analysis` | ❌ 비워 둔다 | 개별 종목의 과거 기사에 도달할 방법이 없음 |
| `sector_performance` | ❌ 비워 둔다 | `get_sector_performance` 가 현재 시점만 반환 |
| `news` | ⚠️ 시장 기사만 | 확보된 마감 시황 기사는 `is_market_wide=true` 로 넣어도 된다 |

`daily_price` · `snapshot` 은 수집기 담당이라 **여기서 채울 수 없다.**
시세 자체가 없으면 그 날짜는 건너뛰고 보고에 남긴다(사용자가 `collect.py --mode backfill` 을 돌려야 함).

### 7-2. 날짜별 절차

각 누락일 `D` 에 대해:

1. **시세 확인** — `select count(*) from daily_price where date = 'D';`
   0이면 건너뛰고 `시세 없음` 으로 기록한다.

2. **그날 기사 확보** — 아래 형태로 질의한다. 종목명은 넣지 않는다(넣으면 날짜가 무시된다).

```
get_korean_stock_news(query="{M}월 {D}일 코스피 마감 시황", count=15)
get_korean_stock_news(query="{M}월 {D}일 증시 마감", count=15)
```

3. **pubDate 필터 — 필수.** 응답에서 `pubDate` 가 **그 날짜인 기사만** 남긴다.
   최신 기사가 섞여 오므로 이 단계를 건너뛰면 다른 날 기사로 그날을 설명하게 된다.

4. 남은 기사가 **2건 미만이면 그 날짜는 포기**하고 `근거 부족` 으로 기록한다.
   억지로 쓰지 않는다.

5. 확보된 기사로 `market_daily_commentary` 를 채운다.
   - `kospi_close` · `kospi_change_pt` · `kospi_change` · `kosdaq_*` — 기사에 명시된 수치만
   - `market_overview` · `investor_trend` · `additional_insight` · `sector_theme_analysis`
   - 지수 종가는 `macro_daily` 의 `kospi`/`kosdaq` 과 **교차 검증**한다

```sql
select date::text, kospi, kosdaq from macro_daily where date = 'D';
```

   - 값이 있고 기사 수치와 **다르면** `macro_daily`(KRX 수집분)를 신뢰하고 기사 수치는 버린다.
   - 값이 `null` 이면(국내지수 수집 전) 교차 검증을 건너뛰고 **기사 수치를 쓰되,
     서로 다른 두 기사에서 같은 값이 나오는지 확인**한다. 한 기사에만 있는 수치는 넣지 않는다.

6. 서술은 **STEP 4 와 동일한 원칙**을 적용한다 — 금지 표현 없이, 확인된 사실만, 해석 중심으로.

### 7-3. 보충분 검증

보충한 날짜마다 STEP 6-3(금지 표현)과 6-7(사실 대조)을 다시 돌린다.

```sql
select report_date from market_daily_commentary
where report_date in ('보충한 날짜들')
  and (coalesce(market_overview,'')||coalesce(investor_trend,'')||
       coalesce(sector_theme_analysis,'')||coalesce(additional_insight,''))
      ~ '확보하지 못|이번 실행|미확인|검증되지 않아|정성 해석|접근이 차단';
```

0행이 아니면 해당 문장을 고친다.

### 7-4. 보충 시 지켜야 할 선

- **오늘치를 덮어쓰지 않는다.** `where report_date = 'D'` 로만 쓴다.
- 이미 시황이 있는 날짜는 건너뛴다.
- `pubDate` 가 대상 날짜가 아닌 기사는 **근거로 쓰지 않는다.**
- 종목별 분석을 지금 시점 기사로 만들어 넣지 않는다. **비워 두는 것이 정답이다.**
- 5거래일보다 오래된 날짜는 아예 손대지 않는다.

---

## 공통 제약

- **기준일자는 하나.** 서로 다른 날짜의 시세·뉴스를 섞지 않는다.
- 전 종목 반복 스캔, 과거 시계열 루프 금지. STEP 1에서 확정된 유니버스로만 작업한다.
- 거래대금·시가총액·순매수는 **원 단위 정수**로 저장한다.
- 조건 미달 구분은 0종목으로 두고 명시한다. **숫자를 지어내지 않는다.**
- 웹 코드·수집기 코드·다른 날짜 데이터는 건드리지 않는다.

## 완료 후 보고 형식

1. **BASE_DATE** 와 각 테이블 적재 행 수 (`analysis` / `news` / `commentary` / `sectors`)
2. 구분별 종목 수 — 급등 / 급락 / 6%이상변동 / 거래대금상위
3. **STEP 1-2 이상치 검증** — 걸린 종목과 확인 결과 (없으면 "없음")
4. **STEP 6 검사 결과** — 6-1 ~ 6-7 각각 통과 여부와 수정 내역
5. 뉴스를 찾지 못해 시장 동인으로 대체한 종목 목록
6. 확인이 안 돼 서술에서 뺀 항목
7. **STEP 7 누락일 보충 결과** — 날짜별로 아래 중 하나

| 결과 | 의미 |
|---|---|
| `보충 완료` | 시황을 채웠다 |
| `시세 없음` | `daily_price` 가 비어 있어 건너뜀 → 사용자가 `collect.py --mode backfill` 실행 필요 |
| `근거 부족` | 그 날짜 기사를 2건 이상 확보하지 못해 포기 |
| `범위 밖` | 5거래일보다 오래돼 대상에서 제외 |

보충한 날짜는 **종목별 분석과 업종 등락이 비어 있다**는 점을 함께 밝힌다.

---

## 참고 — 화면과 테이블 대응

| 화면 영역 | 읽는 곳 |
|---|---|
| 상단 지수 5종 (KOSPI·KOSDAQ·S&P·나스닥·다우) + 스파크라인 | `market_daily_commentary`, `macro_daily` |
| 매크로 지표 보드 (🇰🇷한국 / 🇺🇸미국 분리) | `macro_series`, `macro_daily` — **수집기 자동** |
| 데일리 브리핑 | `daily_brief` |
| 테마·섹터 분석 **막대그래프** | `sector_performance` |
| 서술형 시황 4칸 | `market_daily_commentary` |
| 종목 스크리닝 표 | `daily_movers` 뷰 + `stock_analysis` |
| 수급 방향 전환 | `investor_flow_signal` 뷰 (`snapshot` 누적분) |
| 키워드보드 (🔥N일 연속 배지) | `keyword_streak` 뷰 |
| 급등 캘린더 (KOSPI 오버레이) | `keyword_streak`, `surge_calendar` 뷰 |
| 뉴스 카드 | `news` |
| 종목 상세 이슈 히스토리 | `stock_analysis` 전체 이력 |
| 날짜 선택기 | `report_dates` 뷰 |
