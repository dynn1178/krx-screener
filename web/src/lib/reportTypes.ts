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
  /** BASE_DATE 시점의 값 */
  value: number | null;
  /** 값이 마지막으로 실제로 바뀐 날 — 월간 지표의 "발표 시점" */
  effectiveDate: string | null;
  /** 갱신주기 기준 직전 값 */
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
  circuitBreaker: boolean;
  overview: string | null;
  investorFlow: string | null;
  themeAnalysis: string | null;
  insights: string[];
  additionalInsight: string | null;
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
  close: number | null;
  prevClose: number | null;
  changePrice: number | null;
  changeRate: number | null;
  swingPct: number | null;
  tradeValue: number | null;
  marketCap: number | null;
  foreignNetBuy: number | null;
  instNetBuy: number | null;
  indivNetBuy: number | null;
  industryKw: string | null;
  themeKw: string | null;
  issueKw: string | null;
  issueNote: string | null;
  related: string | null;
  refs: ArticleRef[];
  /** 시세 실측이 있는지 (daily_movers 매칭) */
  hasQuote: boolean;
  /** 뉴스·키워드 분석이 있는지 (screening 매칭) */
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

export type KeywordRow = {
  base_date: string;
  kind: "theme" | "issue" | "industry";
  keyword: string;
  mentions: number;
  stocks: string[];
  codes: string[];
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

export const naverLink = (code: string) =>
  `https://finance.naver.com/item/main.naver?code=${code}`;
