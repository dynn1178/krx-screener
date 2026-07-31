-- ══════════════════════════════════════════════════════════════
-- KRX 일별 분석 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- 테이블은 세 계열로 나뉩니다.
--   ① 수집기(pykrx)      stocks / daily_price / daily_fundamental / snapshot / collect_log
--   ② 매크로 수집기      macro_series / macro_daily
--   ③ 분석 파이프라인    screening / market_summary / market_daily_commentary /
--                        sector_performance / fx_rates / trading_days /
--                        stock_fundamentals / daily_brief
-- 웹앱은 아래 뷰들만 읽으면 세 계열이 하나로 합쳐진 형태로 조회됩니다.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- ① 수집기 (pykrx)
-- ══════════════════════════════════════════════════════════════

-- 종목 마스터
create table if not exists stocks (
  ticker         text primary key,
  name           text not null,
  market         text,
  sector         text,
  dart_corp_code text,
  updated_at     timestamptz default now()
);

-- 일별 시세 (전 종목 × 일자) — 급등 캘린더·전일종가 계산의 기반
create table if not exists daily_price (
  date    date not null,
  ticker  text not null,
  open    bigint,
  high    bigint,
  low     bigint,
  close   bigint,
  volume  bigint,
  value   bigint,           -- 거래대금 (원 단위 정수)
  primary key (date, ticker)
);
create index if not exists idx_daily_price_ticker_date
  on daily_price (ticker, date desc);

-- 일별 밸류에이션
create table if not exists daily_fundamental (
  date   date not null,
  ticker text not null,
  bps    bigint,
  per    numeric,
  pbr    numeric,
  eps    bigint,
  div    numeric,
  dps    bigint,
  primary key (date, ticker)
);
create index if not exists idx_daily_fund_ticker_date
  on daily_fundamental (ticker, date desc);

-- 스크리닝용 스냅샷 — PK 가 ticker 단독이라 "종목별 최신 상태" 1행만 유지된다.
-- 날짜별 이력이 필요하면 daily_price 를 쓸 것.
create table if not exists snapshot (
  ticker          text primary key,
  date            date not null,
  name            text,
  market          text,
  sector          text,
  open            bigint,
  high            bigint,
  low             bigint,
  close           bigint,
  prev_close      bigint,
  change          bigint,          -- 전일대비 변동가
  change_rate     numeric,         -- 전일대비 등락률(%)
  market_cap      bigint,
  trade_value     bigint,
  shares          bigint,
  per             numeric,
  pbr             numeric,
  eps             bigint,
  bps             bigint,
  div             numeric,
  foreign_net_buy bigint,          -- 외국인 순매수거래대금(원)
  inst_net_buy    bigint,          -- 기관합계 순매수거래대금(원)
  indiv_net_buy   bigint,          -- 개인 순매수거래대금(원)
  sector_index    text,            -- 소속 WICS 업종지수 당일 종가
  ret_1y          numeric,
  ret_6m          numeric,
  ret_1m          numeric,
  rs_1y           numeric,         -- KOSPI 대비 초과수익 (%p)
  updated_at      timestamptz default now()
);
create index if not exists idx_snapshot_cap on snapshot (market_cap desc);

-- 수집 로그
create table if not exists collect_log (
  id        bigserial primary key,
  ran_at    timestamptz default now(),
  base_date date,
  mode      text,
  rows      int,
  status    text,
  message   text
);

-- ══════════════════════════════════════════════════════════════
-- ② 매크로 (FRED + 한국은행 ECOS)
-- ══════════════════════════════════════════════════════════════

-- 지표 메타 — 화면의 카테고리 그룹핑·이름·단위·갱신주기가 여기서 온다
create table if not exists macro_series (
  series_id text primary key,
  source    text not null check (source in ('FRED', 'ECOS', 'DERIVED')),
  stat_code text,
  item_code text,
  name_kr   text not null,
  category  text,
  frequency text not null,     -- D / M / Q / A
  unit      text not null
);

-- 일별 매크로 값 — 2015-01-01 부터 매일 1행. 휴일·미발표는 forward-fill.
-- 컬럼명은 macro_series.series_id 의 소문자.
create table if not exists macro_daily (
  date                   date primary key,
  -- FRED
  dgs10                  numeric,
  dgs2                   numeric,
  dff                    numeric,
  t10y2y                 numeric,
  dexkous                numeric,
  dtwexbgs               numeric,
  dcoilwtico             numeric,
  vixcls                 numeric,
  usslind                numeric,
  umcsent                numeric,
  cpiaucsl               numeric,
  unrate                 numeric,
  -- ECOS
  rate_base_m            numeric,
  fx_usd_d               numeric,
  fx_cny_d               numeric,
  fx_jpy_d               numeric,
  m2_total_m             numeric,
  cli_leading_m          numeric,
  cli_coincident_m       numeric,
  cli_lagging_m          numeric,
  cli_leading_cycle_m    numeric,
  cli_coincident_cycle_m numeric,
  cpi_total_m            numeric,
  ccsi_m                 numeric,
  ccsi_travel_m          numeric,
  bsi_actual_m           numeric,
  bsi_forecast_m         numeric,
  -- 해외지수 (FRED, 종가 기준이라 1일 지연)
  sp500                  numeric,
  nasdaqcom              numeric,
  djia                   numeric,
  -- 파생
  m2_total_yoy_m         numeric,
  updated_at             timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- ③ 분석 파이프라인
-- ══════════════════════════════════════════════════════════════

create table if not exists trading_days (
  base_date       date primary key,
  report_html_url text,
  csv_url         text,
  data_source     text not null default 'yahoo',
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 종목별 뉴스·키워드 분석 (STEP 2)
create table if not exists screening (
  id          bigserial primary key,
  base_date   date not null,
  rank        int  not null,
  name        text not null,
  code        char(6) not null check (code ~ '^[0-9]{6}$'),
  open_price  bigint,
  close_price bigint,
  change_price bigint,
  change_pct  numeric,
  trade_value bigint,          -- 원 단위 정수
  category    text,            -- '급등주 / 거래대금상위' 처럼 다중 매칭을 모두 나열
  industry_kw text,
  theme_kw    text,
  issue_kw    text,
  issue_note  text,
  related     text,
  ref_link1   text, ref_title1 text,
  ref_link2   text, ref_title2 text,
  ref_link3   text, ref_title3 text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_screening_date on screening (base_date desc);

-- 서술형 시황 (구세대)
create table if not exists market_summary (
  base_date         date primary key,
  kospi_close       numeric, kospi_change  numeric, kospi_change_pct  numeric,
  kosdaq_close      numeric, kosdaq_change numeric, kosdaq_change_pct numeric,
  usdkrw            numeric, usdkrw_change_pct numeric,
  dxy               numeric, dxy_change_pct    numeric,
  circuit_breaker   boolean not null default false,
  headline          text,
  overview          text,
  investor_flow     text,
  theme_analysis    text,
  insights          jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

-- 서술형 시황 (신세대) — 컬럼명이 다르므로 웹앱이 두 테이블을 통합해서 읽는다
create table if not exists market_daily_commentary (
  report_date           date primary key,
  kospi_change          numeric,   -- % (포인트가 아님)
  kosdaq_change         numeric,   -- %
  kospi_close           numeric,
  kospi_change_pt       numeric,   -- 포인트
  kosdaq_close          numeric,
  kosdaq_change_pt      numeric,
  usdkrw                numeric,
  usdkrw_change_pct     numeric,
  sp500_close           numeric,
  sp500_change_pct      numeric,
  nasdaq_close          numeric,
  nasdaq_change_pct     numeric,
  market_overview       text,
  investor_trend        text,
  sector_theme_analysis text,
  additional_insight    text,
  circuit_breaker       boolean default false,
  updated_at            timestamptz default now()
);

create table if not exists sector_performance (
  id             bigserial primary key,
  base_date      date not null,
  sector         text not null,
  avg_change_pct numeric not null
);
create index if not exists idx_sector_perf_date on sector_performance (base_date desc);

create table if not exists fx_rates (
  id         bigserial primary key,
  base_date  date not null,
  pair       text not null,
  rate       numeric not null,
  change_pct numeric
);

-- 종목별 지표 스냅샷 (MCP compare_stocks / get_stock_analysis 수집분)
create table if not exists stock_fundamentals (
  code               char(6) primary key,
  name               text,
  market             text,
  as_of              date not null,
  price              bigint,
  market_cap         bigint,
  per numeric, pbr numeric, eps numeric, peg numeric,
  eps_growth_pct numeric, roe_pct numeric, debt_to_equity numeric,
  profit_margin_pct numeric, dividend_yield_pct numeric,
  week52_high bigint, week52_low bigint,
  listed_shares bigint, par_value numeric, listed_date date,
  target_price_mean numeric, target_price_high numeric, target_price_low numeric,
  target_upside_pct numeric, analyst_summary text,
  sma50 numeric, rsi numeric, rsi_signal text,
  macd numeric, macd_signal text,
  bb_upper numeric, bb_middle numeric, bb_lower numeric, bb_percent_b numeric,
  rec_strong_buy int, rec_buy int, rec_hold int, rec_sell int, rec_strong_sell int,
  signal_bullish int, signal_bearish int, signal_neutral int,
  updated_at timestamptz not null default now()
);

-- STEP 4 — 그날의 특이점·인사이트·동향 요약
create table if not exists daily_brief (
  base_date  date primary key,
  title      text,
  summary    text,
  highlights jsonb not null default '[]'::jsonb,  -- [{label, detail, kind}]
  keywords   jsonb not null default '[]'::jsonb,  -- [{word, weight, kind}]
  watch_next jsonb not null default '[]'::jsonb,  -- ["관전 포인트", ...]
  sources    jsonb not null default '[]'::jsonb,  -- [{title, url, date}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 종목별 뉴스·키워드 분석 (STEP 2 산출물).
-- screening 은 시세와 분석이 섞여 있고 구세대 파이프라인에 묶여 있어 분리했다.
-- 매일 선정된 종목 전체를 이 테이블에 적재하면 웹의 스크리닝 표·키워드보드가 채워진다.
create table if not exists stock_analysis (
  base_date   date not null,
  ticker      text not null,
  name        text,
  industry_kw text,          -- 핵심 사업 아이템 1개
  theme_kw    text,          -- 시장이 묶어 부르는 흐름 1개
  issue_kw    text,          -- 그날의 구체적 트리거 1개
  issue_note  text,          -- 상승/하락 이유 1~2문장
  related     text,          -- 동일 테마·섹터 연관 종목 3~5개
  ref_link1   text, ref_title1 text,
  ref_link2   text, ref_title2 text,
  ref_link3   text, ref_title3 text,
  source      text not null default 'mcp',
  updated_at  timestamptz not null default now(),
  primary key (base_date, ticker)
);
create index if not exists idx_stock_analysis_date on stock_analysis (base_date desc);

-- 뉴스 (STEP 2 의 get_korean_stock_news / get_market_news 결과)
create table if not exists news (
  id           bigserial primary key,
  base_date    date not null,
  published_at timestamptz,
  title        text not null,
  url          text not null,
  press        text,
  summary      text,
  tickers      text[] not null default '{}',
  stock_names  text[] not null default '{}',
  theme_kw     text,
  issue_kw     text,
  sentiment    text check (sentiment in ('positive','negative','neutral')),
  is_market_wide boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (base_date, url)
);
create index if not exists idx_news_date    on news (base_date desc, published_at desc);
create index if not exists idx_news_tickers on news using gin (tickers);

-- 증시 캘린더 — FRED releases / 규칙계산 / DART / 수동입력으로 채운다
create table if not exists market_calendar (
  id         bigserial primary key,
  event_date date not null,
  kind       text not null,   -- earnings / macro / dividend / ipo / holiday / policy / expiry
  region     text not null default 'KR' check (region in ('KR','US','GLOBAL')),
  title      text not null,
  ticker     text,
  detail     text,
  importance smallint not null default 1 check (importance between 1 and 3),
  source     text,            -- FRED / DART / RULE / MANUAL
  source_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_market_calendar_date on market_calendar (event_date);
-- 표현식은 테이블 제약에 못 쓰므로 유니크 인덱스로
create unique index if not exists uq_market_calendar_event
  on market_calendar (event_date, kind, title, coalesce(ticker, ''));

-- ══════════════════════════════════════════════════════════════
-- 뷰 — 웹앱은 이 네 개만 읽는다
-- security_invoker=on 이라 아래 테이블의 RLS 정책이 그대로 적용된다.
-- ══════════════════════════════════════════════════════════════

-- 날짜별 시세 + 전일종가/등락률/장중변동폭
create or replace view daily_quote
with (security_invoker = on) as
with px as (
  select
    p.date as base_date, p.ticker,
    p.open, p.high, p.low, p.close, p.volume,
    p.value as trade_value,
    lag(p.close) over (partition by p.ticker order by p.date) as lag_close
  from daily_price p
),
j as (
  select
    px.*,
    coalesce(sn.name,   st.name)   as name,
    coalesce(sn.market, st.market) as market,
    coalesce(sn.sector, st.sector) as sector,
    case when sn.date = px.base_date then sn.prev_close      end as snap_prev_close,
    case when sn.date = px.base_date then sn.market_cap      end as market_cap,
    case when sn.date = px.base_date then sn.foreign_net_buy end as foreign_net_buy,
    case when sn.date = px.base_date then sn.inst_net_buy    end as inst_net_buy,
    case when sn.date = px.base_date then sn.indiv_net_buy   end as indiv_net_buy,
    f.per, f.pbr, f.eps, f.bps, f.div
  from px
  left join stocks            st on st.ticker = px.ticker
  left join snapshot          sn on sn.ticker = px.ticker
  left join daily_fundamental f  on f.ticker  = px.ticker and f.date = px.base_date
)
select
  base_date, ticker, name, market, sector,
  open, high, low, close, volume, trade_value,
  coalesce(lag_close, snap_prev_close) as prev_close,
  close - coalesce(lag_close, snap_prev_close) as change_price,
  case when coalesce(lag_close, snap_prev_close) > 0
       then round((close - coalesce(lag_close, snap_prev_close))::numeric
                  / coalesce(lag_close, snap_prev_close) * 100, 2) end as change_rate,
  case when low > 0 and high is not null
       then round((high - low)::numeric / low * 100, 2) end as swing_pct,
  market_cap, per, pbr, eps, bps, div,
  foreign_net_buy, inst_net_buy, indiv_net_buy
from j;

-- STEP 1-3 카테고리 판정 (급등 / 급락 / 6%이상변동 / 거래대금상위)
create or replace view daily_movers
with (security_invoker = on) as
select
  q.*,
  (q.change_rate >= 15)           as is_surge,
  (q.change_rate <= -10)          as is_plunge,
  (q.swing_pct   >= 6)            as is_swing,
  (q.trade_value >= 50000000000)  as is_bigvalue,
  nullif(array_to_string(array_remove(array[
    case when q.change_rate >= 15          then '급등주'       end,
    case when q.change_rate <= -10         then '급락주'       end,
    case when q.swing_pct   >= 6           then '6%이상변동'   end,
    case when q.trade_value >= 50000000000 then '거래대금상위' end
  ], null), ' / '), '') as category
from daily_quote q;

-- 급등 캘린더용 일자별 집계
create or replace view surge_calendar
with (security_invoker = on) as
select
  base_date,
  count(*)::int                            as total_n,
  count(*) filter (where is_surge)::int    as surge_n,
  count(*) filter (where is_plunge)::int   as plunge_n,
  count(*) filter (where is_swing)::int    as swing_n,
  count(*) filter (where is_bigvalue)::int as bigvalue_n,
  sum(trade_value)                         as total_trade_value,
  round(avg(change_rate), 2)               as avg_change_rate
from daily_movers
group by base_date;

-- 키워드보드 — stock_analysis 의 키워드 × 시세를 조인해 집계.
-- 시세는 daily_quote 우선, 없으면(구세대 날짜) screening 값으로 보완한다.
drop view if exists keyword_board;
create view keyword_board
with (security_invoker = on) as
with joined as (
  select
    a.base_date, a.ticker,
    coalesce(a.name, q.name, s.name)       as name,
    coalesce(q.change_rate, s.change_pct)  as change_pct,
    coalesce(q.trade_value, s.trade_value) as trade_value,
    a.theme_kw, a.industry_kw, a.issue_kw
  from stock_analysis a
  left join daily_quote q on q.base_date = a.base_date and q.ticker = a.ticker
  left join screening   s on s.base_date = a.base_date and btrim(s.code) = a.ticker
),
unpivot as (
  select base_date, ticker, name, change_pct, trade_value,
         k.kind, btrim(k.keyword) as keyword
  from joined
  cross join lateral (values
    ('theme', theme_kw), ('industry', industry_kw), ('issue', issue_kw)
  ) as k(kind, keyword)
  where coalesce(btrim(k.keyword), '') <> ''
)
select
  base_date, kind, keyword,
  count(*)::int                               as mentions,
  round(avg(change_pct), 2)                   as avg_change_pct,
  sum(trade_value)                            as total_trade_value,
  count(*) filter (where change_pct > 0)::int as up_n,
  jsonb_agg(
    jsonb_build_object(
      'name', name, 'code', ticker,
      'change_pct', change_pct, 'trade_value', trade_value
    ) order by trade_value desc nulls last
  ) as stocks
from unpivot
group by base_date, kind, keyword;

-- 날짜 선택기용 — 어떤 날짜에 어떤 콘텐츠가 있는지
create or replace view report_dates
with (security_invoker = on) as
select
  d as base_date,
  bool_or(src = 'screening')  as has_screening,
  bool_or(src = 'summary')    as has_summary,
  bool_or(src = 'commentary') as has_commentary,
  bool_or(src = 'sector')     as has_sector,
  bool_or(src = 'price')      as has_price,
  bool_or(src = 'brief')      as has_brief
from (
  select base_date  as d, 'screening'  as src from screening
  union all select base_date,   'summary'    from market_summary
  union all select report_date, 'commentary' from market_daily_commentary
  union all select base_date,   'sector'     from sector_performance
  union all select date,        'price'      from daily_price
  union all select base_date,   'brief'      from daily_brief
) x
group by d;

-- ══════════════════════════════════════════════════════════════
-- RLS : 익명 사용자는 읽기만. 쓰기는 service_role 키로만.
-- ══════════════════════════════════════════════════════════════
alter table stocks                  enable row level security;
alter table daily_price             enable row level security;
alter table daily_fundamental       enable row level security;
alter table snapshot                enable row level security;
alter table collect_log             enable row level security;
alter table macro_series            enable row level security;
alter table macro_daily             enable row level security;
alter table trading_days            enable row level security;
alter table screening               enable row level security;
alter table market_summary          enable row level security;
alter table market_daily_commentary enable row level security;
alter table sector_performance      enable row level security;
alter table fx_rates                enable row level security;
alter table stock_fundamentals      enable row level security;
alter table daily_brief             enable row level security;
alter table news                    enable row level security;
alter table market_calendar         enable row level security;
alter table stock_analysis          enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'stocks', 'daily_price', 'daily_fundamental', 'snapshot',
    'macro_series', 'macro_daily', 'trading_days', 'screening',
    'market_summary', 'market_daily_commentary', 'sector_performance',
    'fx_rates', 'stock_fundamentals', 'daily_brief', 'news', 'market_calendar',
    'stock_analysis'
  ] loop
    execute format('drop policy if exists "public read %1$s" on %1$I', t);
    execute format('create policy "public read %1$s" on %1$I for select using (true)', t);
  end loop;
end $$;

-- collect_log 는 읽기 정책 없음 = 익명 접근 차단
