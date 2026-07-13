-- ══════════════════════════════════════════════════════════════
-- KRX 스크리너 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- ══════════════════════════════════════════════════════════════

-- ── 1. 종목 마스터 (이름 / 시장 / 업종 / DART 고유번호)
create table if not exists stocks (
  ticker        text primary key,
  name          text not null,
  market        text,
  sector        text,
  dart_corp_code text,
  updated_at    timestamptz default now()
);

-- ── 2. 일별 시세 (전 종목 × 일자)
create table if not exists daily_price (
  date    date not null,
  ticker  text not null,
  open    bigint,
  high    bigint,
  low     bigint,
  close   bigint,
  volume  bigint,
  value   bigint,           -- 거래대금
  primary key (date, ticker)
);
create index if not exists idx_daily_price_ticker_date
  on daily_price (ticker, date desc);

-- ── 3. 일별 밸류에이션 (전 종목 × 일자)
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

-- ── 4. 스크리닝용 스냅샷 (최신 1일치 — 앱이 이 테이블만 읽음)
create table if not exists snapshot (
  ticker      text primary key,
  date        date not null,
  name        text,
  market      text,
  sector      text,
  close       bigint,
  market_cap  bigint,
  trade_value bigint,
  shares      bigint,
  per         numeric,
  pbr         numeric,
  eps         bigint,
  bps         bigint,
  div         numeric,
  ret_1y      numeric,
  ret_6m      numeric,
  ret_1m      numeric,
  rs_1y       numeric,       -- KOSPI 대비 초과수익 (%p)
  updated_at  timestamptz default now()
);
create index if not exists idx_snapshot_cap on snapshot (market_cap desc);

-- ── 5. 수집 로그 (Actions 성공/실패 추적)
create table if not exists collect_log (
  id         bigserial primary key,
  ran_at     timestamptz default now(),
  base_date  date,
  mode       text,
  rows       int,
  status     text,
  message    text
);

-- ══════════════════════════════════════════════════════════════
-- RLS : 익명 사용자는 읽기만. 쓰기는 service_role 키로만.
-- ══════════════════════════════════════════════════════════════
alter table stocks             enable row level security;
alter table daily_price        enable row level security;
alter table daily_fundamental  enable row level security;
alter table snapshot           enable row level security;
alter table collect_log        enable row level security;

drop policy if exists "public read stocks" on stocks;
drop policy if exists "public read daily_price" on daily_price;
drop policy if exists "public read daily_fundamental" on daily_fundamental;
drop policy if exists "public read snapshot" on snapshot;

create policy "public read stocks"            on stocks            for select using (true);
create policy "public read daily_price"       on daily_price       for select using (true);
create policy "public read daily_fundamental" on daily_fundamental for select using (true);
create policy "public read snapshot"          on snapshot          for select using (true);
-- collect_log 는 읽기 정책 없음 = 익명 접근 차단
