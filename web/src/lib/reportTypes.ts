/** 일별 리포트 화면이 쓰는 타입들 (기존 스크리너용 types.ts 와 분리) */

export type ReportDate = {
  base_date: string;
  has_screening: boolean;
  has_summary: boolean;
  has_commentary: boolean;
  has_sector: boolean;
  has_price: boolean;
  has_brief: boolean;
};

export type MacroSeries = {
  series_id: string;
  source: "FRED" | "ECOS" | "DERIVED";
  name_kr: string;
  category: string | null;
  frequency: string;
  unit: string;
};

/** 지표 카드 하나에 필요한 모든 계산 결과 */
export type MacroCard = {
  seriesId: string;
  column: string;
  name: string;
  category: string;
  source: string;
  frequency: string;
  unit: string;
  desc: string | null;
  unitDesc: string | null;
  value: number | null;
  /** 값이 마지막으로 실제로 바뀐 날 — 월간 지표의 "발표 시점" */
  effectiveDate: string | null;
  prev: number | null;
  change: number | null;
  changePct: number | null;
  compareLabel: string;
  /** 일간 지표는 6개월치, 그 외는 최근 13개월 시점값 */
  spark: number[];
  sparkFrom: string | null;
  sparkTo: string | null;
};

/** market_summary(구세대) / market_daily_commentary(신세대) 를 하나로 정규화 */
export type Commentary = {
  baseDate: string;
  source: "market_summary" | "market_daily_commentary";
  headline: string | null;
  kospiClose: number | null;
  kospiChange: number | null;
  kospiChangePct: number | null;
  kosdaqClose: number | null;
  kosdaqChange: number | null;
  kosdaqChangePct: number | null;
  usdkrw: number | null;
  usdkrwChangePct: number | null;
  dxy: number | null;
  dxyChangePct: number | null;
  sp500: number | null;
  sp500ChangePct: number | null;
  nasdaq: number | null;
  nasdaqChangePct: number | null;
  circuitBreaker: boolean;
  overview: string | null;
  investorFlow: string | null;
  themeAnalysis: string | null;
  insights: string[];
  additionalInsight: string | null;
};

/** macro_daily 에서 뽑은 해외지수 (FRED, 하루 지연) */
export type GlobalIndex = {
  key: string;
  name: string;
  value: number | null;
  changePct: number | null;
  asOf: string | null;
};

export type SectorPerf = {
  sector: string;
  avg_change_pct: number;
};

export type FxRate = {
  pair: string;
  rate: number;
  change_pct: number | null;
};

export type ArticleRef = { title: string | null; url: string };

/** 스크리닝 테이블 한 행 — 시세(daily_movers)와 분석(screening)을 합친 결과 */
export type ReportRow = {
  rank: number;
  ticker: string;
  name: string;
  market: string | null;
  sector: string | null;
  category: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  prevClose: number | null;
  changePrice: number | null;
  changeRate: number | null;
  swingPct: number | null;
  tradeValue: number | null;
  marketCap: number | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  foreignNetBuy: number | null;
  instNetBuy: number | null;
  indivNetBuy: number | null;
  industryKw: string | null;
  themeKw: string | null;
  issueKw: string | null;
  issueNote: string | null;
  related: string | null;
  refs: ArticleRef[];
  hasQuote: boolean;
  hasAnalysis: boolean;
};

export type DailyBrief = {
  base_date: string;
  title: string | null;
  summary: string | null;
  highlights: { label: string; detail?: string; kind?: string }[];
  keywords: { word: string; weight?: number; kind?: string }[];
  watch_next: string[];
  sources: { title?: string; url?: string; date?: string }[];
};

export type KeywordStock = {
  name: string;
  code: string;
  change_pct: number | null;
  trade_value: number | null;
};

export type KeywordRow = {
  base_date: string;
  kind: "theme" | "issue" | "industry";
  keyword: string;
  mentions: number;
  avg_change_pct: number | null;
  total_trade_value: number | null;
  up_n: number;
  stocks: KeywordStock[];
  /** 그날 거래대금 기준 순위 */
  dayRank: number;
  /** 평균 상승률 부호가 며칠째 이어지는지 (같은 방향으로 연속) */
  streakDays: number;
  /** 그 연속이 상승세인지 하락세인지 */
  streakDirection: "up" | "down" | "flat";
};

/** 전일 대비 수급 방향이 뒤집힌 종목 */
export type FlowSignal = {
  ticker: string;
  name: string | null;
  market: string | null;
  themeKw: string | null;
  industryKw: string | null;
  changeRate: number | null;
  tradeValue: number | null;
  foreignNetBuy: number | null;
  instNetBuy: number | null;
  indivNetBuy: number | null;
  foreignTurn: "buy" | "sell" | null;
  instTurn: "buy" | "sell" | null;
};

/** 종목 상세의 과거 이슈 기록 */
export type AnalysisHistory = {
  base_date: string;
  industry_kw: string | null;
  theme_kw: string | null;
  issue_kw: string | null;
  issue_note: string | null;
  related: string | null;
  refs: ArticleRef[];
};

/** 급등 캘린더 배경에 깔 그날의 지수 등락 */
export type DailyIndex = {
  base_date: string;
  kospiClose: number | null;
  kospiChangePct: number | null;
};

export type CalendarRow = {
  base_date: string;
  total_n: number;
  surge_n: number;
  plunge_n: number;
  swing_n: number;
  bigvalue_n: number;
  total_trade_value: number | null;
  avg_change_rate: number | null;
};

export type NewsRow = {
  id: number;
  base_date: string;
  published_at: string | null;
  title: string;
  url: string;
  press: string | null;
  summary: string | null;
  tickers: string[];
  stock_names: string[];
  theme_kw: string | null;
  issue_kw: string | null;
  sentiment: "positive" | "negative" | "neutral" | null;
  is_market_wide: boolean;
};

export type CalendarEvent = {
  id: number;
  event_date: string;
  kind: string;
  region: "KR" | "US" | "GLOBAL";
  title: string;
  ticker: string | null;
  detail: string | null;
  importance: number;
  source: string | null;
  source_url: string | null;
};

/** 종목 클릭 시 이동할 네이버 증권 페이지 */
export const naverLink = (code: string) =>
  `https://stock.naver.com/domestic/stock/${code}/price`;

// ── 화면 공통 정렬/표기 옵션 (키워드보드·급등캘린더 공유) ──

export type KeywordSort = "value" | "change";
export type StockSort = "value" | "change";
export type TopN = 0 | 5 | 10 | 15 | 20; // 0 = 전체

export const KEYWORD_SORTS: { key: KeywordSort; label: string }[] = [
  { key: "value", label: "거래대금 많은순" },
  { key: "change", label: "상승률 높은순" },
];

export const TOP_N_OPTIONS: { key: TopN; label: string }[] = [
  { key: 0, label: "전체 표시" },
  { key: 5, label: "5개" },
  { key: 10, label: "10개" },
  { key: 15, label: "15개" },
  { key: 20, label: "20개" },
];

export const sortKeywords = <T extends { avg_change_pct: number | null; total_trade_value: number | null }>(
  rows: T[],
  by: KeywordSort
): T[] =>
  [...rows].sort((a, b) =>
    by === "change"
      ? (b.avg_change_pct ?? -Infinity) - (a.avg_change_pct ?? -Infinity)
      : (b.total_trade_value ?? -1) - (a.total_trade_value ?? -1)
  );

export const sortStocks = (rows: KeywordStock[], by: StockSort): KeywordStock[] =>
  [...rows].sort((a, b) =>
    by === "change"
      ? (b.change_pct ?? -Infinity) - (a.change_pct ?? -Infinity)
      : (b.trade_value ?? -1) - (a.trade_value ?? -1)
  );
