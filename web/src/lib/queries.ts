import { supabase } from "./supabase";
import {
  MACRO_DESC,
  UNIT_DESC,
  FREQ_COMPARE_LABEL,
  CATEGORY_ORDER,
} from "./macroMeta";
import type {
  ReportDate,
  MacroSeries,
  MacroCard,
  Commentary,
  SectorPerf,
  FxRate,
  ReportRow,
  DailyBrief,
  KeywordRow,
  CalendarRow,
  ArticleRef,
  GlobalIndex,
  NewsRow,
  CalendarEvent,
  FlowSignal,
  AnalysisHistory,
  DailyIndex,
} from "./reportTypes";

/** 카테고리당 최대 종목 수 (STEP 1-3) */
const PER_CATEGORY = 20;
/** 거래대금 상위 기준 (원) */
const BIG_VALUE = 50_000_000_000;

const asNum = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);

// ──────────────────────────────────────────────────────────
// 날짜
// ──────────────────────────────────────────────────────────

export async function getReportDates(): Promise<ReportDate[]> {
  const { data, error } = await supabase
    .from("report_dates")
    .select("*")
    .order("base_date", { ascending: false })
    .limit(400);
  if (error) throw new Error(`report_dates: ${error.message}`);
  return (data ?? []) as ReportDate[];
}

/**
 * BASE_DATE 확정 (STEP 0).
 * 지정값이 리포트 날짜 목록에 있으면 그 날짜, 없으면 가장 최근 날짜.
 * 임의로 앞뒤 날짜로 이동하지 않는다 — 없으면 null 을 돌려주고 화면에서 알린다.
 */
export function resolveBaseDate(
  dates: ReportDate[],
  requested?: string
): { baseDate: string | null; requestedMissing: boolean } {
  if (!dates.length) return { baseDate: null, requestedMissing: false };
  if (requested) {
    const hit = dates.find((d) => d.base_date === requested);
    return hit
      ? { baseDate: hit.base_date, requestedMissing: false }
      : { baseDate: null, requestedMissing: true };
  }
  return { baseDate: dates[0].base_date, requestedMissing: false };
}

// ──────────────────────────────────────────────────────────
// STEP 1-1 매크로 지표 보드
// ──────────────────────────────────────────────────────────

export const shiftMonths = (iso: string, months: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, d));
  return dt.toISOString().slice(0, 10);
};

const shiftDays = (iso: string, days: number) => {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
};

/**
 * macro_daily 는 매일 1행이고 결측은 forward-fill 되어 있다.
 * 따라서 "직전 갱신값"을 구할 때 일간 지표는 같은 값이 반복되는 구간(주말·공휴일)을
 * 건너뛰어야 하고, 월간 지표는 정확히 1개월 전 행과 비교하면 된다.
 */
export async function getMacroBoard(baseDate: string): Promise<{
  cards: MacroCard[];
  updatedAt: string | null;
  dataDate: string | null;
}> {
  const from = shiftDays(baseDate, 400);

  const [seriesRes, dailyRes] = await Promise.all([
    supabase.from("macro_series").select("*"),
    supabase
      .from("macro_daily")
      .select("*")
      .lte("date", baseDate)
      .gte("date", from)
      .order("date", { ascending: true }),
  ]);

  if (seriesRes.error) throw new Error(`macro_series: ${seriesRes.error.message}`);
  if (dailyRes.error) throw new Error(`macro_daily: ${dailyRes.error.message}`);

  const series = (seriesRes.data ?? []) as MacroSeries[];
  const rows = (dailyRes.data ?? []) as Record<string, unknown>[];
  if (!rows.length) return { cards: [], updatedAt: null, dataDate: null };

  const last = rows[rows.length - 1];
  const dataDate = String(last.date);
  const updatedAt = last.updated_at ? String(last.updated_at) : null;

  const sparkStart = shiftDays(baseDate, 183);

  const cards: MacroCard[] = series.map((s) => {
    const col = s.series_id.toLowerCase();
    const daily = s.frequency === "D";

    // (날짜, 값) 시퀀스 — null 제외
    const pts: { date: string; v: number }[] = [];
    for (const r of rows) {
      const v = asNum(r[col]);
      if (v != null) pts.push({ date: String(r.date), v });
    }

    const latest = pts.length ? pts[pts.length - 1] : null;

    // 값이 마지막으로 실제 변한 날 = 현재 값이 시작된 날
    let effectiveDate: string | null = latest?.date ?? null;
    if (latest) {
      for (let i = pts.length - 1; i >= 0; i--) {
        if (pts[i].v !== latest.v) break;
        effectiveDate = pts[i].date;
      }
    }

    // 직전 비교값
    let prev: number | null = null;
    if (latest) {
      if (daily) {
        // 주말·공휴일 ffill 구간을 건너뛰고 최근 5일 안에서 값이 다른 지점을 찾는다.
        const floor = shiftDays(latest.date, 5);
        for (let i = pts.length - 2; i >= 0; i--) {
          if (pts[i].date < floor) break;
          if (pts[i].v !== latest.v) {
            prev = pts[i].v;
            break;
          }
        }
      } else if (effectiveDate) {
        // 월·분기·연 지표는 매일 같은 값이 반복(ffill)되므로 "1개월 전 행"과 비교하면
        // 대개 같은 발표값이라 0% 가 나온다. 현재 값이 시작된 시점(effectiveDate)
        // 직전의 값 = 직전 발표값과 비교해야 한다.
        for (let i = pts.length - 1; i >= 0; i--) {
          if (pts[i].date < effectiveDate) {
            prev = pts[i].v;
            break;
          }
        }
      }
    }

    const value = latest?.v ?? null;
    const change = value != null && prev != null ? value - prev : null;
    const changePct =
      change != null && prev != null && prev !== 0
        ? (change / Math.abs(prev)) * 100
        : null;

    // 스파크라인
    let spark: number[] = [];
    if (daily) {
      spark = pts.filter((p) => p.date >= sparkStart).map((p) => p.v);
    } else {
      // 월간 지표는 "값이 바뀐 시점"만 뽑으면 변화 없는 달이 통째로 빠져
      // 가로축이 시간이 아니게 된다. 월별로 1포인트씩 고정해 시간축을 지킨다.
      const since = shiftMonths(baseDate, 13);
      const byMonth = new Map<string, number>();
      for (const p of pts) {
        if (p.date < since) continue;
        byMonth.set(p.date.slice(0, 7), p.v); // 그 달의 마지막 값
      }
      spark = [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => v);
    }
    // 표본이 너무 많으면 균등 샘플링 (SVG 경로 길이 억제)
    if (spark.length > 200) {
      const step = spark.length / 200;
      spark = Array.from({ length: 200 }, (_, i) => spark[Math.floor(i * step)]);
    }

    return {
      seriesId: s.series_id,
      column: col,
      name: s.name_kr,
      category: s.category ?? "기타",
      source: s.source,
      frequency: s.frequency,
      unit: s.unit,
      desc: MACRO_DESC[s.series_id] ?? null,
      unitDesc: UNIT_DESC[s.unit] ?? null,
      value,
      effectiveDate,
      prev,
      change,
      changePct,
      compareLabel: FREQ_COMPARE_LABEL[s.frequency] ?? "직전 대비",
      spark,
      sparkFrom: daily ? sparkStart : shiftMonths(baseDate, 13),
      sparkTo: latest?.date ?? null,
    };
  });

  cards.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    if (a.frequency !== b.frequency) return a.frequency === "D" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

  return { cards, updatedAt, dataDate };
}

// ──────────────────────────────────────────────────────────
// 시황 (두 세대 테이블 통합)
// ──────────────────────────────────────────────────────────

export async function getCommentary(
  baseDate: string
): Promise<Commentary | null> {
  const nu = await supabase
    .from("market_daily_commentary")
    .select("*")
    .eq("report_date", baseDate)
    .maybeSingle();
  if (nu.error) throw new Error(`market_daily_commentary: ${nu.error.message}`);
  if (!nu.data) return null;

  {
    const r = nu.data as Record<string, unknown>;
    return {
      baseDate,
      source: "market_daily_commentary",
      headline: null,
      kospiClose: asNum(r.kospi_close),
      kospiChange: asNum(r.kospi_change_pt),
      // 이 테이블의 kospi_change 는 포인트가 아니라 % 다
      kospiChangePct: asNum(r.kospi_change),
      kosdaqClose: asNum(r.kosdaq_close),
      kosdaqChange: asNum(r.kosdaq_change_pt),
      kosdaqChangePct: asNum(r.kosdaq_change),
      usdkrw: asNum(r.usdkrw),
      usdkrwChangePct: asNum(r.usdkrw_change_pct),
      dxy: null,
      dxyChangePct: null,
      sp500: asNum(r.sp500_close),
      sp500ChangePct: asNum(r.sp500_change_pct),
      nasdaq: asNum(r.nasdaq_close),
      nasdaqChangePct: asNum(r.nasdaq_change_pct),
      circuitBreaker: Boolean(r.circuit_breaker),
      overview: (r.market_overview as string) ?? null,
      investorFlow: (r.investor_trend as string) ?? null,
      themeAnalysis: (r.sector_theme_analysis as string) ?? null,
      insights: [],
      additionalInsight: (r.additional_insight as string) ?? null,
    };
  }

}

export async function getSectorPerf(baseDate: string): Promise<SectorPerf[]> {
  const { data, error } = await supabase
    .from("sector_performance")
    .select("sector, avg_change_pct")
    .eq("base_date", baseDate)
    .order("avg_change_pct", { ascending: false });
  if (error) throw new Error(`sector_performance: ${error.message}`);
  return (data ?? []).map((r) => ({
    sector: r.sector as string,
    avg_change_pct: Number(r.avg_change_pct),
  }));
}

export async function getFxRates(baseDate: string): Promise<FxRate[]> {
  const { data, error } = await supabase
    .from("fx_rates")
    .select("pair, rate, change_pct")
    .eq("base_date", baseDate);
  if (error) throw new Error(`fx_rates: ${error.message}`);
  return (data ?? []).map((r) => ({
    pair: r.pair as string,
    rate: Number(r.rate),
    change_pct: asNum(r.change_pct),
  }));
}

export async function getDailyBrief(
  baseDate: string
): Promise<DailyBrief | null> {
  const { data, error } = await supabase
    .from("daily_brief")
    .select("*")
    .eq("base_date", baseDate)
    .maybeSingle();
  if (error) throw new Error(`daily_brief: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    base_date: baseDate,
    title: (r.title as string) ?? null,
    summary: (r.summary as string) ?? null,
    highlights: Array.isArray(r.highlights) ? (r.highlights as DailyBrief["highlights"]) : [],
    keywords: Array.isArray(r.keywords) ? (r.keywords as DailyBrief["keywords"]) : [],
    watch_next: Array.isArray(r.watch_next) ? (r.watch_next as string[]) : [],
    sources: Array.isArray(r.sources) ? (r.sources as DailyBrief["sources"]) : [],
  };
}

// ──────────────────────────────────────────────────────────
// STEP 1-3 + STEP 2 스크리닝 테이블
// ──────────────────────────────────────────────────────────

const MOVER_COLS =
  "ticker,name,market,sector,open,high,low,close,prev_close,change_price,change_rate," +
  "swing_pct,trade_value,market_cap,per,pbr,eps,foreign_net_buy,inst_net_buy,indiv_net_buy,category";

type MoverRaw = Record<string, unknown>;

async function moversBy(
  baseDate: string,
  flag: string,
  orderCol: string,
  ascending: boolean
): Promise<MoverRaw[]> {
  const { data, error } = await supabase
    .from("daily_movers")
    .select(MOVER_COLS)
    .eq("base_date", baseDate)
    .eq(flag, true)
    .order(orderCol, { ascending, nullsFirst: false })
    .limit(PER_CATEGORY);
  if (error) throw new Error(`daily_movers(${flag}): ${error.message}`);
  // supabase-js 는 select 문자열을 타입 레벨에서 파싱한다. 클라이언트에
  // Database 제네릭이 없어 정확한 행 타입을 만들지 못하므로 unknown 을 경유한다.
  return (data ?? []) as unknown as MoverRaw[];
}

const refsOf = (r: Record<string, unknown>): ArticleRef[] => {
  const out: ArticleRef[] = [];
  for (const i of [1, 2, 3]) {
    const url = r[`ref_link${i}`] as string | null;
    if (url) out.push({ title: (r[`ref_title${i}`] as string) ?? null, url });
  }
  return out;
};

/**
 * 카테고리별 상위 20을 각각 뽑아 합치고, 동일 종목은 한 행으로 통합한다.
 * 시세는 daily_movers(= daily_price 이력), 뉴스·키워드는 stock_analysis 에서 온다.
 */
export async function getReportRows(baseDate: string): Promise<ReportRow[]> {
  const [surge, plunge, swing, bigval, analysisRes] = await Promise.all([
    moversBy(baseDate, "is_surge", "change_rate", false),
    moversBy(baseDate, "is_plunge", "change_rate", true),
    moversBy(baseDate, "is_swing", "swing_pct", false),
    moversBy(baseDate, "is_bigvalue", "trade_value", false),
    supabase.from("stock_analysis").select("*").eq("base_date", baseDate),
  ]);
  if (analysisRes.error)
    throw new Error(`stock_analysis: ${analysisRes.error.message}`);

  const byTicker = new Map<string, ReportRow>();

  for (const r of [...surge, ...plunge, ...swing, ...bigval]) {
    const ticker = String(r.ticker);
    if (byTicker.has(ticker)) continue;
    byTicker.set(ticker, {
      rank: 0,
      ticker,
      name: (r.name as string) ?? ticker,
      market: (r.market as string) ?? null,
      sector: (r.sector as string) ?? null,
      category: (r.category as string) ?? null,
      open: asNum(r.open),
      high: asNum(r.high),
      low: asNum(r.low),
      close: asNum(r.close),
      prevClose: asNum(r.prev_close),
      changePrice: asNum(r.change_price),
      changeRate: asNum(r.change_rate),
      swingPct: asNum(r.swing_pct),
      tradeValue: asNum(r.trade_value),
      marketCap: asNum(r.market_cap),
      per: asNum(r.per),
      pbr: asNum(r.pbr),
      eps: asNum(r.eps),
      foreignNetBuy: asNum(r.foreign_net_buy),
      instNetBuy: asNum(r.inst_net_buy),
      indivNetBuy: asNum(r.indiv_net_buy),
      industryKw: null,
      themeKw: null,
      issueKw: null,
      issueNote: null,
      related: null,
      refs: [],
      hasQuote: true,
      hasAnalysis: false,
    });
  }

  // 분석 필드는 stock_analysis 가 단일 출처
  for (const raw of (analysisRes.data ?? []) as Record<string, unknown>[]) {
    const ticker = String(raw.ticker ?? "").trim();
    if (!ticker) continue;
    const row = byTicker.get(ticker);
    if (!row) continue; // 스크리닝에 안 걸린 종목의 분석은 표에 넣지 않는다
    Object.assign(row, {
      industryKw: (raw.industry_kw as string) ?? null,
      themeKw: (raw.theme_kw as string) ?? null,
      issueKw: (raw.issue_kw as string) ?? null,
      issueNote: (raw.issue_note as string) ?? null,
      related: (raw.related as string) ?? null,
      refs: refsOf(raw),
      hasAnalysis: true,
    });
  }

  const rows = [...byTicker.values()].sort(
    (a, b) => (b.tradeValue ?? -1) - (a.tradeValue ?? -1)
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

// ──────────────────────────────────────────────────────────
// 키워드보드 / 급등 캘린더
// ──────────────────────────────────────────────────────────

export async function getKeywords(baseDate?: string): Promise<KeywordRow[]> {
  // keyword_streak = keyword_board + 평균 상승률 부호 연속일수(+당일 순위)
  let q = supabase.from("keyword_streak").select("*");
  if (baseDate) q = q.eq("base_date", baseDate);
  const { data, error } = await q
    .order("total_trade_value", { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) throw new Error(`keyword_streak: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    base_date: String(r.base_date),
    kind: r.kind as KeywordRow["kind"],
    keyword: String(r.keyword),
    mentions: Number(r.mentions),
    avg_change_pct: asNum(r.avg_change_pct),
    total_trade_value: asNum(r.total_trade_value),
    up_n: Number(r.up_n ?? 0),
    dayRank: Number(r.day_rank ?? 0),
    streakDays: Number(r.streak_days ?? 1),
    streakDirection: (r.streak_direction as KeywordRow["streakDirection"]) ?? "flat",
    stocks: (Array.isArray(r.stocks) ? r.stocks : []).map(
      (s: Record<string, unknown>) => ({
        name: String(s.name ?? ""),
        code: String(s.code ?? "").trim(),
        change_pct: asNum(s.change_pct),
        trade_value: asNum(s.trade_value),
      })
    ),
  }));
}

/** 전일 대비 외국인·기관 순매수 방향이 뒤집힌 종목 */
export async function getFlowSignals(baseDate: string): Promise<FlowSignal[]> {
  const [flowRes, analysisRes] = await Promise.all([
    supabase
      .from("investor_flow_signal")
      .select("*")
      .eq("base_date", baseDate)
      .or("foreign_turn.not.is.null,inst_turn.not.is.null")
      .order("trade_value", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("stock_analysis")
      .select("ticker,theme_kw,industry_kw")
      .eq("base_date", baseDate),
  ]);
  if (flowRes.error)
    throw new Error(`investor_flow_signal: ${flowRes.error.message}`);
  if (analysisRes.error)
    throw new Error(`stock_analysis: ${analysisRes.error.message}`);

  // 테마·산업 키워드는 stock_analysis 가 단일 출처 — 종목코드로 매칭한다
  const kwByTicker = new Map<string, { theme: string | null; industry: string | null }>();
  for (const raw of (analysisRes.data ?? []) as Record<string, unknown>[]) {
    const ticker = String(raw.ticker ?? "").trim();
    if (!ticker) continue;
    kwByTicker.set(ticker, {
      theme: (raw.theme_kw as string) ?? null,
      industry: (raw.industry_kw as string) ?? null,
    });
  }

  return ((flowRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const ticker = String(r.ticker);
    const kw = kwByTicker.get(ticker);
    return {
      ticker,
      name: (r.name as string) ?? null,
      market: (r.market as string) ?? null,
      themeKw: kw?.theme ?? null,
      industryKw: kw?.industry ?? null,
      changeRate: asNum(r.change_rate),
      tradeValue: asNum(r.trade_value),
      foreignNetBuy: asNum(r.foreign_net_buy),
      instNetBuy: asNum(r.inst_net_buy),
      indivNetBuy: asNum(r.indiv_net_buy),
      foreignTurn: (r.foreign_turn as FlowSignal["foreignTurn"]) ?? null,
      instTurn: (r.inst_turn as FlowSignal["instTurn"]) ?? null,
    };
  });
}

/** 종목 상세용 — 그 종목의 과거 이슈 기록 */
export async function getAnalysisHistory(
  ticker: string
): Promise<AnalysisHistory[]> {
  const { data, error } = await supabase
    .from("stock_analysis")
    .select("*")
    .eq("ticker", ticker)
    .order("base_date", { ascending: false })
    .limit(60);
  if (error) throw new Error(`stock_analysis(history): ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    base_date: String(r.base_date),
    industry_kw: (r.industry_kw as string) ?? null,
    theme_kw: (r.theme_kw as string) ?? null,
    issue_kw: (r.issue_kw as string) ?? null,
    issue_note: (r.issue_note as string) ?? null,
    related: (r.related as string) ?? null,
    refs: refsOf(r),
  }));
}

/** 급등 캘린더 배경용 — 날짜별 KOSPI 종가·등락률 */
export async function getDailyIndexMap(): Promise<Map<string, DailyIndex>> {
  const [macroRes, newRes] = await Promise.all([
    supabase
      .from("macro_daily")
      .select("date,kospi")
      .not("kospi", "is", null)
      .order("date", { ascending: true })
      .limit(2000),
    supabase
      .from("market_daily_commentary")
      .select("report_date,kospi_close,kospi_change"),
  ]);
  if (macroRes.error) throw new Error(`macro_daily(kospi): ${macroRes.error.message}`);
  if (newRes.error)
    throw new Error(`market_daily_commentary(idx): ${newRes.error.message}`);

  const out = new Map<string, DailyIndex>();

  // 1순위 — 수집기가 채운 KOSPI 시계열. 등락률은 직전 값과 비교해 계산한다.
  const macro = (macroRes.data ?? []) as Record<string, unknown>[];
  let prev: number | null = null;
  for (const r of macro) {
    const v = asNum(r.kospi);
    if (v == null) continue;
    out.set(String(r.date), {
      base_date: String(r.date),
      kospiClose: v,
      kospiChangePct:
        prev != null && prev !== 0 ? ((v - prev) / prev) * 100 : null,
    });
    prev = v;
  }

  // 2순위 — 시황 테이블에 적힌 종가·등락률로 보완(수집 전 날짜)
  for (const r of (newRes.data ?? []) as Record<string, unknown>[]) {
    const d = String(r.report_date);
    const close = asNum(r.kospi_close);
    const pct = asNum(r.kospi_change); // 이 테이블의 kospi_change 는 %
    const existing = out.get(d);
    if (existing?.kospiChangePct != null) continue;
    out.set(d, { base_date: d, kospiClose: close, kospiChangePct: pct });
  }

  return out;
}

/** FRED 해외지수 — market_daily_commentary 에 값이 없을 때의 대체 소스 */
export async function getGlobalIndices(
  baseDate: string
): Promise<GlobalIndex[]> {
  const defs = [
    { key: "sp500", name: "S&P 500" },
    { key: "nasdaqcom", name: "나스닥" },
    { key: "djia", name: "다우존스" },
  ];

  const { data, error } = await supabase
    .from("macro_daily")
    .select("date,sp500,nasdaqcom,djia")
    .lte("date", baseDate)
    .gte("date", shiftDays(baseDate, 14))
    .order("date", { ascending: true });
  if (error) throw new Error(`macro_daily(indices): ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];

  return defs.map(({ key, name }) => {
    const pts = rows
      .map((r) => ({ date: String(r.date), v: asNum(r[key]) }))
      .filter((p): p is { date: string; v: number } => p.v != null);

    if (!pts.length)
      return { key, name, value: null, changePct: null, asOf: null };

    const last = pts[pts.length - 1];
    let prev: number | null = null;
    for (let i = pts.length - 2; i >= 0; i--) {
      if (pts[i].v !== last.v) {
        prev = pts[i].v;
        break;
      }
    }
    return {
      key,
      name,
      value: last.v,
      changePct: prev != null && prev !== 0 ? ((last.v - prev) / prev) * 100 : null,
      asOf: last.date,
    };
  });
}

/**
 * 시장 개요 카드의 배경 스파크라인.
 * 해외지수·환율은 macro_daily 의 6개월 일별 시계열,
 * KOSPI/KOSDAQ 는 시황 테이블에 쌓인 종가(거래일 수만큼)를 쓴다.
 */
export async function getIndexSparklines(
  baseDate: string
): Promise<Record<string, { values: number[]; asOf: string | null }>> {
  const from = shiftDays(baseDate, 183);

  const [macroRes, newRes] = await Promise.all([
    supabase
      .from("macro_daily")
      .select("date,sp500,nasdaqcom,djia,fx_usd_d,dtwexbgs,kospi,kosdaq")
      .lte("date", baseDate)
      .gte("date", from)
      .order("date", { ascending: true }),
    supabase
      .from("market_daily_commentary")
      .select("report_date,kospi_close,kosdaq_close")
      .lte("report_date", baseDate)
      .order("report_date", { ascending: true }),
  ]);
  if (macroRes.error) throw new Error(`macro_daily(spark): ${macroRes.error.message}`);
  if (newRes.error)
    throw new Error(`market_daily_commentary(spark): ${newRes.error.message}`);

  const out: Record<string, { values: number[]; asOf: string | null }> = {};

  const macroRows = (macroRes.data ?? []) as Record<string, unknown>[];
  for (const [key, col] of [
    ["sp500", "sp500"],
    ["nasdaqcom", "nasdaqcom"],
    ["djia", "djia"],
    ["usdkrw", "fx_usd_d"],
    ["dxy", "dtwexbgs"],
  ] as const) {
    const pts = macroRows
      .map((r) => ({ d: String(r.date), v: asNum(r[col]) }))
      .filter((p): p is { d: string; v: number } => p.v != null);
    out[key] = {
      values: pts.map((p) => p.v),
      asOf: pts.length ? pts[pts.length - 1].d : null,
    };
  }

  // 국내지수는 macro_daily(pykrx 수집분)가 우선.
  // 아직 수집 전이면 시황 테이블에 쌓인 종가로 대체한다.
  for (const [key, macroCol, cmtCol] of [
    ["kospi", "kospi", "kospi_close"],
    ["kosdaq", "kosdaq", "kosdaq_close"],
  ] as const) {
    const fromMacro = macroRows
      .map((r) => ({ d: String(r.date), v: asNum(r[macroCol]) }))
      .filter((p): p is { d: string; v: number } => p.v != null);

    if (fromMacro.length > 1) {
      out[key] = {
        values: fromMacro.map((p) => p.v),
        asOf: fromMacro[fromMacro.length - 1].d,
      };
      continue;
    }

    const byDate = new Map<string, number>();
    for (const r of (newRes.data ?? []) as Record<string, unknown>[]) {
      const v = asNum(r[cmtCol]);
      if (v != null) byDate.set(String(r.report_date), v);
    }
    const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    out[key] = {
      values: sorted.map(([, v]) => v),
      asOf: sorted.length ? sorted[sorted.length - 1][0] : null,
    };
  }

  return out;
}

export async function getNews(baseDate: string): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("base_date", baseDate)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) throw new Error(`news: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    base_date: String(r.base_date),
    published_at: (r.published_at as string) ?? null,
    title: String(r.title),
    url: String(r.url),
    press: (r.press as string) ?? null,
    summary: (r.summary as string) ?? null,
    tickers: Array.isArray(r.tickers) ? (r.tickers as string[]) : [],
    stock_names: Array.isArray(r.stock_names) ? (r.stock_names as string[]) : [],
    theme_kw: (r.theme_kw as string) ?? null,
    issue_kw: (r.issue_kw as string) ?? null,
    sentiment: (r.sentiment as NewsRow["sentiment"]) ?? null,
    is_market_wide: Boolean(r.is_market_wide),
  }));
}

export async function getCalendarEvents(
  from: string,
  to: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("market_calendar")
    .select("*")
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true })
    .order("importance", { ascending: false });
  if (error) throw new Error(`market_calendar: ${error.message}`);
  return (data ?? []) as unknown as CalendarEvent[];
}

export async function getCalendar(limit = 120): Promise<CalendarRow[]> {
  const { data, error } = await supabase
    .from("surge_calendar")
    .select("*")
    .order("base_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`surge_calendar: ${error.message}`);
  return (data ?? []).map((r) => ({
    base_date: r.base_date as string,
    total_n: Number(r.total_n),
    surge_n: Number(r.surge_n),
    plunge_n: Number(r.plunge_n),
    swing_n: Number(r.swing_n),
    bigvalue_n: Number(r.bigvalue_n),
    total_trade_value: asNum(r.total_trade_value),
    avg_change_rate: asNum(r.avg_change_rate),
  }));
}

export { PER_CATEGORY, BIG_VALUE };
