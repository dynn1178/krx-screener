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

const shiftMonths = (iso: string, months: number) => {
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

    // 스파크라인: 일간=최근 6개월 전 구간, 그 외=최근 13개월의 값 변화 시점만
    let spark: number[] = [];
    if (daily) {
      spark = pts.filter((p) => p.date >= sparkStart).map((p) => p.v);
    } else {
      const since = shiftMonths(baseDate, 13);
      const seen: number[] = [];
      for (const p of pts) {
        if (p.date < since) continue;
        if (!seen.length || seen[seen.length - 1] !== p.v) seen.push(p.v);
      }
      spark = seen;
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
  // 신세대 우선
  const nu = await supabase
    .from("market_daily_commentary")
    .select("*")
    .eq("report_date", baseDate)
    .maybeSingle();
  if (nu.error) throw new Error(`market_daily_commentary: ${nu.error.message}`);

  if (nu.data) {
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

  const old = await supabase
    .from("market_summary")
    .select("*")
    .eq("base_date", baseDate)
    .maybeSingle();
  if (old.error) throw new Error(`market_summary: ${old.error.message}`);
  if (!old.data) return null;

  const r = old.data as Record<string, unknown>;
  return {
    baseDate,
    source: "market_summary",
    headline: (r.headline as string) ?? null,
    kospiClose: asNum(r.kospi_close),
    kospiChange: asNum(r.kospi_change),
    kospiChangePct: asNum(r.kospi_change_pct),
    kosdaqClose: asNum(r.kosdaq_close),
    kosdaqChange: asNum(r.kosdaq_change),
    kosdaqChangePct: asNum(r.kosdaq_change_pct),
    usdkrw: asNum(r.usdkrw),
    usdkrwChangePct: asNum(r.usdkrw_change_pct),
    dxy: asNum(r.dxy),
    dxyChangePct: asNum(r.dxy_change_pct),
    sp500: null,
    sp500ChangePct: null,
    nasdaq: null,
    nasdaqChangePct: null,
    circuitBreaker: Boolean(r.circuit_breaker),
    overview: (r.overview as string) ?? null,
    investorFlow: (r.investor_flow as string) ?? null,
    themeAnalysis: (r.theme_analysis as string) ?? null,
    insights: Array.isArray(r.insights) ? (r.insights as string[]) : [],
    additionalInsight: null,
  };
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
  "ticker,name,market,sector,open,close,prev_close,change_price,change_rate," +
  "swing_pct,trade_value,market_cap,foreign_net_buy,inst_net_buy,indiv_net_buy,category";

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
 * 시세는 daily_movers(= daily_price 이력), 뉴스·키워드는 screening 에서 온다.
 * 둘 중 한쪽만 있는 날짜도 있으므로 양쪽을 합집합으로 처리한다.
 */
export async function getReportRows(baseDate: string): Promise<ReportRow[]> {
  const [surge, plunge, swing, bigval, screenRes, analysisRes] =
    await Promise.all([
      moversBy(baseDate, "is_surge", "change_rate", false),
      moversBy(baseDate, "is_plunge", "change_rate", true),
      moversBy(baseDate, "is_swing", "swing_pct", false),
      moversBy(baseDate, "is_bigvalue", "trade_value", false),
      // 구세대 날짜(daily_price 가 없는 7/28·7/29)의 시세·구분값 폴백
      supabase.from("screening").select("*").eq("base_date", baseDate),
      supabase.from("stock_analysis").select("*").eq("base_date", baseDate),
    ]);
  if (screenRes.error) throw new Error(`screening: ${screenRes.error.message}`);
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
      close: asNum(r.close),
      prevClose: asNum(r.prev_close),
      changePrice: asNum(r.change_price),
      changeRate: asNum(r.change_rate),
      swingPct: asNum(r.swing_pct),
      tradeValue: asNum(r.trade_value),
      marketCap: asNum(r.market_cap),
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

  // daily_price 가 없는 날짜(구세대)는 screening 이 시세·구분값의 유일한 출처다
  for (const raw of (screenRes.data ?? []) as Record<string, unknown>[]) {
    const code = String(raw.code ?? "").trim();
    if (!code) continue;
    const existing = byTicker.get(code);
    if (existing) {
      if (!existing.category && raw.category)
        existing.category = raw.category as string;
      continue;
    }
    byTicker.set(code, {
      rank: 0,
      ticker: code,
      name: (raw.name as string) ?? code,
      market: null,
      sector: null,
      category: (raw.category as string) ?? null,
      open: asNum(raw.open_price),
      close: asNum(raw.close_price),
      prevClose: null,
      changePrice: asNum(raw.change_price),
      changeRate: asNum(raw.change_pct),
      swingPct: null,
      tradeValue: asNum(raw.trade_value),
      marketCap: null,
      foreignNetBuy: null,
      instNetBuy: null,
      indivNetBuy: null,
      industryKw: null,
      themeKw: null,
      issueKw: null,
      issueNote: null,
      related: null,
      refs: [],
      hasQuote: false,
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
  let q = supabase.from("keyword_board").select("*");
  if (baseDate) q = q.eq("base_date", baseDate);
  const { data, error } = await q
    .order("total_trade_value", { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) throw new Error(`keyword_board: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    base_date: String(r.base_date),
    kind: r.kind as KeywordRow["kind"],
    keyword: String(r.keyword),
    mentions: Number(r.mentions),
    avg_change_pct: asNum(r.avg_change_pct),
    total_trade_value: asNum(r.total_trade_value),
    up_n: Number(r.up_n ?? 0),
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
