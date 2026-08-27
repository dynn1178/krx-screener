// 테마·산업키워드 추이(/trends) 타입 정의
// 원천: Supabase RPC get_trend_board(p_days) — DB 마이그레이션 get_trend_board_rpc 참고

export type TrendPeriod = 7 | 30 | 180 | 365;

export const TREND_PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: 7, label: "1주" },
  { value: 30, label: "1개월" },
  { value: 180, label: "6개월" },
  { value: 365, label: "1년" },
];

export const DEFAULT_TREND_PERIOD: TrendPeriod = 30;

/** 선 하나 위의 점 하나 */
export type TrendPoint = {
  date: string;
  /** 그날 그 키워드에 묶인 종목들의 거래대금 합계 (원) */
  tradeValue: number;
  /** 그날 그 키워드의 평균 등락률 (%). 그날 등장하지 않았으면 null */
  changePct: number | null;
  /** 그날 그 키워드에 묶인 종목 수 */
  mentions: number;
};

/** 키워드 안에서 거래대금이 큰 종목 (그래프 우측 패널) */
export type TopStock = {
  code: string;
  name: string;
  /** 선택 기간 내 거래대금 합계 (원) */
  tradeValue: number;
  /** 가장 최근 등장일의 등락률 (%) */
  lastChangePct: number | null;
  /** 기간 내 이 키워드로 등장한 일수 */
  days: number;
};

export type TrendSeries = {
  /** 테마명 또는 산업키워드명 */
  key: string;
  points: TrendPoint[];
  /** 기간 내 거래대금 내림차순 상위 12종목 */
  topStocks: TopStock[];
  /** 기간 내 거래대금 합계 (원) */
  totalTradeValue: number;
  /** 차트 2 전용 — 기간 평균 등락률 */
  avgChangePct?: number;
  /** 차트 2·3 전용 — 기간 내 등장일 수 */
  appearances?: number;
  /** 차트 3 전용 — 상승일 비율 (0~1) */
  upRatio?: number;
  /** 차트 3 전용 — 상승한 날 수 */
  upDays?: number;
  /** 차트 3 전용 — 기간 누적 등락률 합 */
  cumChangePct?: number;
};

export type TrendBoard = {
  from: string | null;
  to: string | null;
  days: number;
  dates: string[];
  /** 차트 1 — 거래대금 상위 테마 10 */
  topTradeValue: TrendSeries[];
  /** 차트 2 — 상승폭이 큰 산업키워드 5 */
  topGainerIndustry: TrendSeries[];
  /** 차트 3 — 꾸준히 상승중인 테마 5 */
  steadyRisers: TrendSeries[];
};

/** 어떤 값을 y축에 그릴지 */
export type TrendMetric = "tradeValue" | "changePct";

/** 테마 변동 알림 (theme_drift_alert 뷰) */
export type ThemeDriftAlert = {
  ticker: string;
  name: string | null;
  master_theme: string;
  proposed_theme: string;
  proposed_industry_kw: string | null;
  hits: number;
  appearances: number;
  hit_ratio: number;
  first_seen: string;
  last_seen: string;
  span_days: number;
  locked: boolean;
  latest_evidence: string | null;
  /** ready = 한달 이상 지속되어 승인 대기 · watching = 관찰 중 · locked = 수동 고정 */
  status: "ready" | "watching" | "locked";
};
