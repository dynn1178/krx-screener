# 일별 분석 가이드라인 — 반영할 변경분

기존 `korea-stock-market-analyst` 프롬프트에 아래를 그대로 반영한다.
전체 배경과 상세는 [theme-keyword-system.md](./theme-keyword-system.md) 참고.

---

## 1. STEP 0 표 — "내가 쓰는 테이블" 갱신

기존 0번 역할 분담 표를 아래로 교체한다.

| 구분 | 테이블 | 누가 채우나 |
|---|---|---|
| ✍️ **내가 쓴다** | `stock_analysis` · `news` · `market_daily_commentary` · `sector_performance` · `daily_brief` · **`theme_drift_candidate`** · **`theme_master`(신규 종목만)** | 이 프롬프트 |
| 📖 읽기만 한다 | `daily_movers` · `daily_quote` · **`theme_master_lookup`** · **`theme_catalog`** · **`sector_ref`** | — |
| 🔐 승인으로만 바꾼다 | **`theme_master`(기존 종목)** | 사용자 요청 시 `approve_theme_drift()` |
| 🚫 건드리지 않는다 | `daily_price` · `daily_fundamental` · `snapshot` · `stocks` · `macro_daily` · `macro_series` | GitHub Actions 수집기 |

---

## 2. STEP 1-2 이상치 검증 — 마지막 문단 교체

> ~~걸린 종목은 `theme_kw` 를 비워 섹터 평균에서 제외한다~~

**교체 후:**

`keyword_board` 가 `abs(change_rate) > 30` 인 행을 자동으로 거르므로, 이상치 종목도
**테마는 원래 소속 그대로 넣는다.** 대신 `issue_kw` 에 `가격기준조정` 계열 원인을 쓰고,
`issue_note` 에 실제 등락률과 구분이 잘못 붙었다는 사실을 명시한다.

---

## 3. STEP 2 앞에 STEP 2-1 신설 (필수)

### STEP 2-1 — 테마키워드는 마스터에서 가져온다

STEP 1 종목이 확정되면 **분석문을 쓰기 전에** 반드시 조회한다.

```sql
select ticker, name, master_theme, master_industry_kw,
       sector_big, sector_small, in_master, locked
from theme_master_lookup
where ticker in ( /* STEP 1 선정 종목 전체 */ );
```

- `in_master = true` → `master_theme` 를 **그대로** `theme_kw` 에 넣는다.
  그날 뉴스가 다른 흐름을 가리켜도 **바꾸지 않는다.** 대신 STEP 6-8 에 후보로 남긴다.
- `in_master = false` → 새 종목이다. `sector_small` 을 근거로 `theme_catalog` 의 표준 테마 중
  하나를 골라 `theme_master` 에 추가하고 그 값을 쓴다.

```sql
insert into theme_master (ticker, name, theme, industry_kw, sector_big, sector_small, source, first_seen, note)
select 'XXXXXX','종목명','표준테마명','산업키워드',
       r.sector_big, r.sector_small, 'manual', 'BASE_DATE', '최초 등장 시 배정'
from sector_ref r where r.ticker = 'XXXXXX';
```

**`theme_catalog` 에 없는 테마는 쓰지 않는다.** 정말 새 흐름이면 카탈로그에 먼저 등록한다.

`industry_kw` 는 `sector_small`(업종소) 을 기본값으로 하되 더 좁고 정확한 표현이 있으면 그것을 쓴다.

---

## 4. STEP 2 — `theme_kw` 작성 기준 교체

> ~~테마키워드 — 시장이 묶어 부르는 흐름 1개. 같은 흐름은 같은 표기로 통일한다~~

**교체 후:**

**테마키워드 — 직접 짓지 않는다.** STEP 2-1 에서 조회한 `master_theme` 를 그대로 쓴다.
신규 종목만 `theme_catalog` 에서 골라 배정한다. 그날의 원인은 `issue_kw` 와 `issue_note` 가 담으므로
테마를 그날 사정에 맞춰 흔들 이유가 없다.

---

## 5. STEP 4 `sector_performance` 적재 쿼리 교체

메커니즘 제외가 `theme_catalog.is_mechanism` 으로 옮겨졌으므로 하드코딩을 뺀다.

```sql
delete from sector_performance where base_date = 'BASE_DATE';

insert into sector_performance (base_date, sector, avg_change_pct)
select b.base_date, b.keyword, b.avg_change_pct
from keyword_board b
join theme_catalog c on c.theme = b.keyword
where b.base_date = 'BASE_DATE'
  and b.kind = 'theme'
  and c.is_mechanism = false
  and (b.mentions >= 2 or b.total_trade_value >= 100000000000);
```

---

## 6. STEP 6 뒤에 STEP 6-8 신설 (필수)

### STEP 6-8 — 테마 불일치 후보 기록

STEP 6-1~6-7 을 통과한 뒤, 그날 뉴스 근거로 판단한 테마가 마스터와 달랐던 종목을 기록한다.
**마스터는 절대 바꾸지 않는다.**

```sql
insert into theme_drift_candidate
  (base_date, ticker, master_theme, proposed_theme, proposed_industry_kw, evidence)
values
  ('BASE_DATE','종목코드','마스터테마','제안테마','제안산업키워드','왜 다르게 봤는지 한 줄')
on conflict do nothing;
```

- `evidence` 는 판단 근거를 구체적으로 쓴다. "다름" 같은 말은 쓰지 않는다.
- 그날 주가를 움직인 원인이 마스터 테마와 **다른 흐름에 속할 때만** 기록한다.
  이슈가 특이한 것만으로는 후보가 아니다 — 그건 `issue_kw` 의 몫이다.
- `proposed_theme` 도 `theme_catalog` 안에서 고른다.

기록 후 현황을 확인한다.

```sql
select status, count(*) from theme_drift_alert group by status;
```

---

## 7. 완료 보고 형식 — 8~10 추가

기존 1~7 뒤에 이어서:

8. **테마 배정** — 마스터에서 가져온 종목 수 / 새로 추가한 종목 수(종목명과 배정 테마)
9. **drift 후보** — 이번 실행 기록 건수와 종목별 `master_theme → proposed_theme`
10. **승인 대기 현황** — `theme_drift_alert` 의 `ready` 건수. 있으면 종목명과 제안 테마를 함께 보고

---

## 8. 공통 제약 — 3줄 추가

- **테마키워드는 조회해서 쓴다.** 마스터에 있는 종목의 테마를 그날 판단으로 바꾸지 않는다.
- **`theme_master` 의 기존 행은 직접 UPDATE 하지 않는다.** 사용자가 요청했을 때만
  `approve_theme_drift()` 로 바꾼다.
- **업종(`sector_small`)과 테마(`theme_kw`)는 다른 축이다.** 업종은 회사가 무엇을 파는지,
  테마는 시장이 지금 무엇으로 묶어 부르는지다.

---

## 9. 화면 대응표 — 3줄 추가

| 화면 영역 | 읽는 곳 |
|---|---|
| 키워드 추이 3종 선 그래프 (`/trends`) | `get_trend_board()` ← `theme_trend_daily` · `industry_trend_daily` |
| 그래프 우측 구성 종목 패널 | `get_trend_board()` 의 `topStocks` ← `keyword_board.stocks` |
| 테마키워드 변동 알림 | `theme_drift_alert` 뷰 |
