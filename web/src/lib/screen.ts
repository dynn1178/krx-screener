import type { Filters, ScoredSnapshot, Snapshot } from "./types";

export type FunnelStep = { label: string; count: number };

export function screen(all: Snapshot[], f: Filters) {
  let rows = all;
  const funnel: FunnelStep[] = [{ label: "전체", count: rows.length }];

  const step = (label: string, fn: (r: Snapshot) => boolean) => {
    rows = rows.filter(fn);
    funnel.push({ label, count: rows.length });
  };

  if (f.market !== "ALL") step("시장", (r) => r.market === f.market);

  step("시가총액", (r) => {
    const cap = (r.market_cap ?? 0) / 1e8;
    return cap >= f.capMin && cap <= f.capMax;
  });
  step("거래대금(유동성)", (r) => (r.trade_value ?? 0) / 1e8 >= f.valueMin);
  step(
    "1년 수익률",
    (r) => r.ret_1y != null && r.ret_1y >= f.ret1yMin && r.ret_1y <= f.ret1yMax
  );
  step(
    "1개월 수익률",
    (r) => r.ret_1m != null && r.ret_1m >= f.ret1mMin && r.ret_1m <= f.ret1mMax
  );

  if (f.rsPositive) step("상대강도 > 0", (r) => (r.rs_1y ?? -1) > 0);
  if (f.excludeLoss) step("적자 제외", (r) => (r.per ?? 0) > 0);

  step("PER", (r) => r.per != null && r.per >= f.perMin && r.per <= f.perMax);
  step("PBR", (r) => r.pbr != null && r.pbr >= f.pbrMin && r.pbr <= f.pbrMax);
  step("배당수익률", (r) => (r.div ?? 0) >= f.divMin);

  if (f.sectors.length)
    step("업종", (r) => !!r.sector && f.sectors.includes(r.sector));

  return { rows: rank(rows, f.momentumWeight), funnel };
}

/** 모멘텀 백분위 + 밸류(저PER) 백분위 가중합 → 0~100 */
function rank(rows: Snapshot[], momentumWeight: number): ScoredSnapshot[] {
  if (!rows.length) return [];

  const wm = momentumWeight / 100;
  const wv = 1 - wm;

  const makeRanker = (values: (number | null)[]) => {
    const sorted = values
      .filter((v): v is number => v != null && Number.isFinite(v))
      .sort((a, b) => a - b);
    return (v: number | null) => {
      if (v == null || !sorted.length) return 0;
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] < v) lo = mid + 1;
        else hi = mid;
      }
      return lo / sorted.length;
    };
  };

  const inversePer = (r: Snapshot) =>
    r.per != null && r.per > 0 ? 1 / r.per : null;

  const rMom = makeRanker(rows.map((r) => r.rs_1y));
  const rVal = makeRanker(rows.map(inversePer));

  return rows
    .map((r) => ({
      ...r,
      score: Math.round((rMom(r.rs_1y) * wm + rVal(inversePer(r)) * wv) * 100),
    }))
    .sort((a, b) => b.score - a.score);
}

export function toCsv(rows: ScoredSnapshot[]): string {
  const head = [
    "티커","종목명","업종","시장","현재가","시총(억)","1년","6개월","1개월",
    "상대강도","PER","PBR","EPS","BPS","배당%","스코어",
  ];
  const body = rows.map((r) =>
    [
      r.ticker, r.name, r.sector ?? "", r.market ?? "", r.close ?? "",
      r.market_cap ? Math.round(r.market_cap / 1e8) : "",
      r.ret_1y ?? "", r.ret_6m ?? "", r.ret_1m ?? "", r.rs_1y ?? "",
      r.per ?? "", r.pbr ?? "", r.eps ?? "", r.bps ?? "", r.div ?? "", r.score,
    ].join(",")
  );
  return "\uFEFF" + [head.join(","), ...body].join("\n");
}
