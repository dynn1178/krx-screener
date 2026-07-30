export type Snapshot = {
  ticker: string;
  date: string;
  name: string;
  market: string | null;
  sector: string | null;
  close: number | null;
  market_cap: number | null;
  trade_value: number | null;
  shares: number | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  bps: number | null;
  div: number | null;
  ret_1y: number | null;
  ret_6m: number | null;
  ret_1m: number | null;
  rs_1y: number | null;
};

export type ScoredSnapshot = Snapshot & { score: number };

export type PricePoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export type FundPoint = {
  date: string;
  per: number | null;
  pbr: number | null;
};

export type NewsItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
};

export type Financials = {
  years: string[];
  accounts: Record<string, (number | null)[]>; // 단위: 억원
  growth: Record<string, number>;              // YoY %
};

export type Filters = {
  market: string;
  capMin: number; // 억원
  capMax: number;
  valueMin: number; // 억원
  ret1yMin: number;
  ret1yMax: number;
  ret1mMin: number;
  ret1mMax: number;
  rsPositive: boolean;
  excludeLoss: boolean;
  perMin: number;
  perMax: number;
  pbrMin: number;
  pbrMax: number;
  divMin: number;
  sectors: string[];
  momentumWeight: number; // 0~100
};

export const DEFAULT_FILTERS: Filters = {
  market: "ALL",
  capMin: 1000,
  capMax: 1000000,
  valueMin: 10,
  ret1yMin: 10,
  ret1yMax: 500,
  ret1mMin: -20,
  ret1mMax: 15,
  rsPositive: true,
  excludeLoss: true,
  perMin: 0,
  perMax: 40,
  pbrMin: 0,
  pbrMax: 8,
  divMin: 0,
  sectors: [],
  momentumWeight: 60,
};
