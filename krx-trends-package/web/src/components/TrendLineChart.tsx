"use client";

import { useEffect, useMemo, useRef, useState, useId } from "react";
import type { TrendSeries, TrendMetric, TopStock } from "@/lib/trendTypes";

/* ────────────────────────────────────────────────────────────────
   팔레트 — dataviz 기본 카테고리 팔레트 (light/dark 양쪽 검증 통과).
   슬롯 순서는 CVD 안전장치이므로 임의로 섞지 않는다.
   9·10번째 선은 새 색을 만들지 않고 1·2번 색조를 파선으로 재사용한다.
──────────────────────────────────────────────────────────────── */
const SERIES_LIGHT = ["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#4a3aa7","#e34948"];
const SERIES_DARK  = ["#3987e5","#d95926","#199e70","#c98500","#d55181","#008300","#9085e9","#e66767"];

function slotOf(i: number) {
  return { hue: i % 8, dashed: i >= 8 };
}

/* ── 숫자 포맷 ── */
function fmtTradeValue(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "0";
  const jo = 1e12, eok = 1e8;
  if (Math.abs(v) >= jo) {
    const n = v / jo;
    return `${n >= 100 ? Math.round(n) : n.toFixed(1)}조`;
  }
  if (Math.abs(v) >= eok) return `${Math.round(v / eok).toLocaleString("ko-KR")}억`;
  return v.toLocaleString("ko-KR");
}
const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const fmtDateShort = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/* ── 눈금 계산 ── */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

type Props = {
  title: string;
  /** 제목 아래 한 줄 — 이 차트가 무엇을 고른 결과인지 설명 */
  caption?: string;
  series: TrendSeries[];
  dates: string[];
  metric: TrendMetric;
  /** 범례 우측에 표시할 보조 지표 */
  badge?: (s: TrendSeries) => string;
  height?: number;
};

export default function TrendLineChart({
  title, caption, series, dates, metric, badge, height = 300,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [dark, setDark] = useState(false);
  /** 우측 패널에 종목을 보여줄 키워드. null 이면 1순위 계열 */
  const [focusKey, setFocusKey] = useState<string | null>(null);

  /* 컨테이너 폭 추적 */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 테마 추적 — 범례 스와치와 선 색을 맞추기 위해 JS 쪽에서도 모드를 안다 */
  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const attr = root.getAttribute("data-theme");
      if (attr === "dark") return true;
      if (attr === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    setDark(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => setDark(read());
    mq.addEventListener("change", onMq);
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener("change", onMq); mo.disconnect(); };
  }, []);

  const colors = dark ? SERIES_DARK : SERIES_LIGHT;
  const visible = series.filter((s) => !hidden.has(s.key));

  /* ── 스케일 ── */
  const M = { top: 16, right: 92, bottom: 30, left: 60 };
  const innerW = Math.max(80, width - M.left - M.right);
  const innerH = Math.max(80, height - M.top - M.bottom);

  const valueOf = (p: { tradeValue: number; changePct: number | null }) =>
    metric === "tradeValue" ? p.tradeValue : p.changePct;

  const { yMin, yMax } = useMemo(() => {
    const vals: number[] = [];
    visible.forEach((s) => s.points.forEach((p) => {
      const v = valueOf(p);
      if (v != null && Number.isFinite(v)) vals.push(v);
    }));
    if (!vals.length) return { yMin: 0, yMax: 1 };
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (metric === "tradeValue") lo = 0;
    if (lo === hi) { hi = hi + Math.abs(hi || 1) * 0.1; lo = lo - Math.abs(lo || 1) * 0.1; }
    const pad = (hi - lo) * 0.08;
    return { yMin: metric === "tradeValue" ? 0 : lo - pad, yMax: hi + pad };
  }, [visible, metric]);

  const x = (i: number) => (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const y = (v: number) => innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const yTicks = niceTicks(yMin, yMax, 4);
  const xTickIdx = useMemo(() => {
    const maxLabels = Math.max(2, Math.floor(innerW / 64));
    if (dates.length <= maxLabels) return dates.map((_, i) => i);
    const step = Math.ceil(dates.length / maxLabels);
    const out: number[] = [];
    for (let i = 0; i < dates.length; i += step) out.push(i);
    if (out[out.length - 1] !== dates.length - 1) out.push(dates.length - 1);
    return out;
  }, [dates.length, innerW]);

  /* 결측(그날 등장 안 함)에서 선을 끊는다 — 0으로 잇지 않는다 */
  const pathOf = (s: TrendSeries) => {
    let d = "", pen = false;
    s.points.forEach((p, i) => {
      const v = valueOf(p);
      const gap = v == null || !Number.isFinite(v) || (metric === "tradeValue" && p.mentions === 0);
      if (gap) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v as number).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    if (px < -8 || px > innerW + 8 || dates.length === 0) return setHoverX(null);
    const i = dates.length === 1 ? 0 : Math.round((px / innerW) * (dates.length - 1));
    setHoverX(Math.min(dates.length - 1, Math.max(0, i)));
  };

  const hoverRows = useMemo(() => {
    if (hoverX == null) return [];
    return visible
      .map((s) => ({ s, p: s.points[hoverX] }))
      .filter((r) => r.p && valueOf(r.p) != null && !(metric === "tradeValue" && r.p.mentions === 0))
      .sort((a, b) => (valueOf(b.p) as number) - (valueOf(a.p) as number));
  }, [hoverX, visible, metric]);

  /* 범례 클릭 = 우측 패널 포커스 이동. 이미 포커스된 항목을 다시 누르면 선을 끈다 */
  const onLegendClick = (key: string) => {
    if (hidden.has(key)) {
      setHidden((prev) => { const n = new Set(prev); n.delete(key); return n; });
      setFocusKey(key);
      return;
    }
    if (focusKey === key || (focusKey === null && series[0]?.key === key)) {
      setHidden((prev) => {
        const n = new Set(prev);
        n.add(key);
        if (n.size === series.length) return prev; // 전부 끄는 것은 막는다
        const nextVisible = series.find((s) => !n.has(s.key));
        setFocusKey(nextVisible ? nextVisible.key : null);
        return n;
      });
      return;
    }
    setFocusKey(key);
  };

  const fmtV = (v: number) => (metric === "tradeValue" ? fmtTradeValue(v) : fmtPct(v));

  /* 우측 패널 — 포커스된 키워드의 구성 종목을 거래대금 내림차순으로 */
  const focused: TrendSeries | undefined =
    series.find((s) => s.key === focusKey) ?? visible[0] ?? series[0];
  const focusedIdx = focused ? series.findIndex((s) => s.key === focused.key) : -1;
  const panelStocks: TopStock[] = focused?.topStocks ?? [];

  if (!series.length) {
    return (
      <section className="trend-card">
        <header className="trend-head"><h3>{title}</h3></header>
        <p className="trend-empty">이 기간에 표시할 데이터가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="trend-card">
      <header className="trend-head">
        <div>
          <h3>{title}</h3>
          {caption && <p className="trend-caption">{caption}</p>}
        </div>
        <button type="button" className="trend-tablebtn"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}>
          {showTable ? "그래프" : "표로 보기"}
        </button>
      </header>

      {/* 범례 — 클릭하면 해당 계열을 끄고 켠다 */}
      <ul className="trend-legend">
        {series.map((s, i) => {
          const { hue, dashed } = slotOf(i);
          const off = hidden.has(s.key);
          const isFocus = focused?.key === s.key && !off;
          return (
            <li key={s.key}>
              <button type="button" onClick={() => onLegendClick(s.key)}
                className={`${off ? "off" : ""} ${isFocus ? "focus" : ""}`.trim()}
                aria-pressed={!off}
                title={off ? "클릭하면 다시 표시합니다" : "클릭하면 우측에 구성 종목을 보여줍니다"}>
                <svg width="18" height="10" aria-hidden="true">
                  <line x1="1" y1="5" x2="17" y2="5" stroke={colors[hue]} strokeWidth="2.5"
                    strokeLinecap="round" strokeDasharray={dashed ? "4 3" : undefined} />
                </svg>
                <span className="lg-key">{s.key}</span>
                {badge && <span className="lg-badge">{badge(s)}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="trend-body">
      <div ref={wrapRef} className="trend-plotwrap">
        {showTable ? (
          <div className="trend-tablescroll">
            <table className="trend-table">
              <thead>
                <tr>
                  <th scope="col" className="sticky-col">키워드</th>
                  {dates.map((d) => <th key={d} scope="col">{fmtDateShort(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.key}>
                    <th scope="row" className="sticky-col">{s.key}</th>
                    {s.points.map((p, i) => {
                      const v = valueOf(p);
                      return <td key={i}>{v == null ? "–" : fmtV(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <svg width={width} height={height} role="img"
            aria-label={`${title} 선 그래프`}
            onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}>
            <g transform={`translate(${M.left},${M.top})`}>
              {/* 그리드 + y축 */}
              {yTicks.map((t) => (
                <g key={t} transform={`translate(0,${y(t).toFixed(1)})`}>
                  <line x1={0} x2={innerW} className="trend-grid" />
                  <text x={-10} dy="0.32em" textAnchor="end" className="trend-axis-text">{fmtV(t)}</text>
                </g>
              ))}
              {metric === "changePct" && yMin < 0 && yMax > 0 && (
                <line x1={0} x2={innerW} y1={y(0)} y2={y(0)} className="trend-zero" />
              )}

              {/* x축 */}
              {xTickIdx.map((i) => (
                <text key={i} x={x(i)} y={innerH + 20} textAnchor="middle" className="trend-axis-text">
                  {fmtDateShort(dates[i])}
                </text>
              ))}

              {/* 크로스헤어 */}
              {hoverX != null && (
                <line x1={x(hoverX)} x2={x(hoverX)} y1={0} y2={innerH} className="trend-crosshair" />
              )}

              {/* 선 */}
              {series.map((s, i) => {
                if (hidden.has(s.key)) return null;
                const { hue, dashed } = slotOf(i);
                return (
                  <path key={s.key} d={pathOf(s)} fill="none" stroke={colors[hue]}
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={dashed ? "5 4" : undefined} />
                );
              })}

              {/* 호버 지점 마커 — 겹침 방지용 서피스 링 */}
              {hoverX != null && series.map((s, i) => {
                if (hidden.has(s.key)) return null;
                const p = s.points[hoverX];
                const v = p ? valueOf(p) : null;
                if (v == null || (metric === "tradeValue" && p.mentions === 0)) return null;
                const { hue } = slotOf(i);
                return (
                  <circle key={s.key} cx={x(hoverX)} cy={y(v)} r={4.5}
                    fill={colors[hue]} className="trend-marker" />
                );
              })}

              {/* 선 끝 직접 라벨 — 색만으로 식별하지 않도록 (light 대비 WARN 해소) */}
              {series.map((s, i) => {
                if (hidden.has(s.key)) return null;
                let last = -1;
                s.points.forEach((p, k) => {
                  const v = valueOf(p);
                  if (v != null && !(metric === "tradeValue" && p.mentions === 0)) last = k;
                });
                if (last < 0) return null;
                const { hue } = slotOf(i);
                return (
                  <text key={s.key} x={x(last) + 8} y={y(valueOf(s.points[last]) as number)}
                    dy="0.32em" className="trend-endlabel" fill={colors[hue]}>
                    {s.key.length > 8 ? s.key.slice(0, 7) + "…" : s.key}
                  </text>
                );
              })}
            </g>
          </svg>
        )}

        {/* 툴팁 */}
        {!showTable && hoverX != null && hoverRows.length > 0 && (
          <div className="trend-tooltip"
            style={{
              left: Math.min(Math.max(M.left + x(hoverX) + 14, 8), Math.max(8, width - 210)),
              top: M.top,
            }}>
            <div className="tt-date">{dates[hoverX]}</div>
            <ul>
              {hoverRows.map(({ s, p }) => {
                const i = series.findIndex((q) => q.key === s.key);
                const { hue, dashed } = slotOf(i);
                return (
                  <li key={s.key}>
                    <svg width="12" height="8" aria-hidden="true">
                      <line x1="1" y1="4" x2="11" y2="4" stroke={colors[hue]} strokeWidth="2.5"
                        strokeLinecap="round" strokeDasharray={dashed ? "3 2" : undefined} />
                    </svg>
                    <span className="tt-key">{s.key}</span>
                    <span className="tt-val">{fmtV(valueOf(p) as number)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* 우측 패널 — 포커스된 키워드의 구성 종목, 거래대금 내림차순 */}
      <aside className="trend-panel" aria-live="polite">
        <div className="tp-head">
          {focusedIdx >= 0 && (
            <svg width="14" height="10" aria-hidden="true">
              <line x1="1" y1="5" x2="13" y2="5" strokeWidth="2.5" strokeLinecap="round"
                stroke={colors[slotOf(focusedIdx).hue]}
                strokeDasharray={slotOf(focusedIdx).dashed ? "3 2" : undefined} />
            </svg>
          )}
          <strong>{focused?.key ?? "–"}</strong>
          <span className="tp-sub">거래대금 상위</span>
        </div>

        {panelStocks.length === 0 ? (
          <p className="tp-empty">구성 종목이 없습니다.</p>
        ) : (
          <ol className="tp-list">
            {panelStocks.map((st, i) => (
              <li key={st.code}>
                <span className="tp-rank">{i + 1}</span>
                <span className="tp-name" title={`${st.name} (${st.code}) · ${st.days}일 등장`}>
                  {st.name}
                </span>
                <span className="tp-tv">{fmtTradeValue(st.tradeValue)}</span>
                <span className={`tp-chg ${
                  st.lastChangePct == null ? "" : st.lastChangePct > 0 ? "up" : st.lastChangePct < 0 ? "down" : ""
                }`}>
                  {st.lastChangePct == null ? "–" : fmtPct(st.lastChangePct)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="tp-foot">범례를 클릭하면 해당 키워드로 바뀝니다.</p>
      </aside>
      </div>

      <span className="sr-only" id={`${uid}-desc`}>
        {title}. {dates[0]}부터 {dates[dates.length - 1]}까지 {series.length}개 계열.
      </span>
    </section>
  );
}
