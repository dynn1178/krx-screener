"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { eok, int, num, pct, trend } from "@/lib/format";
import type {
  Financials,
  FundPoint,
  NewsItem,
  PricePoint,
  Snapshot,
} from "@/lib/types";

type Props = { snap: Snapshot; price: PricePoint[]; fund: FundPoint[] };
type Tab = "price" | "financials" | "band" | "news";

const TABS: { id: Tab; label: string }[] = [
  { id: "price", label: "주가" },
  { id: "financials", label: "재무 (DART)" },
  { id: "band", label: "밸류에이션 밴드" },
  { id: "news", label: "뉴스" },
];

export default function StockDetail({ snap, price, fund }: Props) {
  const [tab, setTab] = useState<Tab>("price");

  return (
    <div className="space-y-5">
      {/* ── 헤더 */}
      <div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">{snap.name}</h1>
          <span className="tabular text-sm text-[var(--fg-subtle)]">{snap.ticker}</span>
          <span className="rounded bg-[var(--card-2)] px-1.5 py-0.5 text-[12px] text-[var(--fg-muted)]">
            {snap.market}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--fg-subtle)]">
          {snap.sector ?? "업종 미분류"} · 기준일 {snap.date}
        </p>
      </div>

      {/* ── 핵심 지표 */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="현재가" value={int(snap.close)} suffix="원" />
        <Metric
          label="1개월"
          value={pct(snap.ret_1m, true)}
          className={trend(snap.ret_1m)}
        />
        <Metric
          label="1년"
          value={pct(snap.ret_1y, true)}
          className={trend(snap.ret_1y)}
        />
        <Metric
          label="상대강도"
          value={pct(snap.rs_1y, true)}
          className={trend(snap.rs_1y)}
          hint="KOSPI 대비"
        />
        <Metric label="시가총액" value={eok(snap.market_cap)} suffix="억" />
        <Metric label="거래대금" value={eok(snap.trade_value)} suffix="억" />

        <Metric
          label="PER"
          value={snap.per && snap.per > 0 ? num(snap.per, 1) : "적자"}
        />
        <Metric label="PBR" value={num(snap.pbr)} />
        <Metric label="EPS" value={int(snap.eps)} suffix="원" />
        <Metric label="BPS" value={int(snap.bps)} suffix="원" />
        <Metric label="배당수익률" value={num(snap.div)} suffix="%" />
        <Metric label="상장주식수" value={int((snap.shares ?? 0) / 1e4)} suffix="만주" />
      </div>

      {/* ── 탭 */}
      <div className="flex gap-1 border-b border-[var(--line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition ${
              tab === t.id
                ? "border-[var(--accent)] font-medium text-[var(--accent-fg)]"
                : "border-transparent text-[var(--fg-subtle)] hover:text-[var(--fg)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        {tab === "price" && <PriceTab price={price} />}
        {tab === "financials" && <FinancialsTab ticker={snap.ticker} />}
        {tab === "band" && <BandTab fund={fund} />}
        {tab === "news" && <NewsTab name={snap.name} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ 주가 */
function PriceTab({ price }: { price: PricePoint[] }) {
  const [months, setMonths] = useState(12);

  const data = useMemo(() => {
    const days = Math.round(months * 21);
    const slice = price.slice(-days);
    return slice.map((p, i, arr) => ({
      ...p,
      ma20: ma(arr, i, 20),
      ma60: ma(arr, i, 60),
    }));
  }, [price, months]);

  if (!price.length)
    return <Empty text="주가 데이터가 없습니다. backfill 수집을 먼저 실행하세요." />;

  const closes = data.map((d) => d.close ?? 0).filter(Boolean);
  const hi = Math.max(...closes);
  const lo = Math.min(...closes);
  const cur = closes[closes.length - 1] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[
          { m: 3, l: "3개월" },
          { m: 6, l: "6개월" },
          { m: 12, l: "1년" },
          { m: 36, l: "3년" },
        ].map((o) => (
          <button
            key={o.m}
            onClick={() => setMonths(o.m)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              months === o.m
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] text-[var(--fg-muted)] hover:border-[var(--line-strong)]"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f5f5f4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a8a29e" }}
            tickFormatter={(d: string) => d.slice(2, 7)}
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin * 0.95", "dataMax * 1.05"]}
            tick={{ fontSize: 10, fill: "#a8a29e" }}
            tickFormatter={(v: number) => (v / 1000).toFixed(0) + "k"}
            width={38}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<PriceTip />} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#0f766e"
            strokeWidth={1.6}
            fill="url(#g)"
            name="종가"
          />
          <Line
            type="monotone"
            dataKey="ma20"
            stroke="#f59e0b"
            strokeWidth={1}
            dot={false}
            name="MA20"
          />
          <Line
            type="monotone"
            dataKey="ma60"
            stroke="#8b5cf6"
            strokeWidth={1}
            dot={false}
            name="MA60"
          />
        </AreaChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={70}>
        <BarChart data={data} margin={{ left: 4, right: 4 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Bar dataKey="volume" fill="#d6d3d1" />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)]">
        <Metric label="기간 최고가" value={int(hi)} />
        <Metric label="기간 최저가" value={int(lo)} />
        <Metric
          label="고점 대비"
          value={pct(((cur / hi - 1) * 100) || 0)}
          hint="0%에 가까울수록 신고가 근접"
          className={trend(cur / hi - 1)}
        />
      </div>
    </div>
  );
}

function ma(arr: PricePoint[], i: number, w: number) {
  if (i < w - 1) return null;
  let s = 0;
  for (let k = i - w + 1; k <= i; k++) s += arr[k].close ?? 0;
  return Math.round(s / w);
}

function PriceTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PricePoint;
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      <p className="tabular">종가 {int(p.close)}원</p>
      <p className="tabular text-[var(--fg-subtle)]">
        고 {int(p.high)} / 저 {int(p.low)}
      </p>
    </div>
  );
}

/* ═══════════════════════════════ 재무 */
function FinancialsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Financials | null>(null);
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/dart?ticker=${ticker}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) {
          setMsg(j.error);
          setState("error");
        } else {
          setData(j);
          setState("done");
        }
      })
      .catch((e) => {
        setMsg(String(e));
        setState("error");
      });
  }, [ticker]);

  if (state === "loading") return <Empty text="DART 재무제표 조회 중..." />;
  if (state === "error" || !data) return <Empty text={msg || "재무 데이터 없음"} />;

  const chartData = data.years.map((y, i) => ({
    year: y,
    매출액: data.accounts["매출액"]?.[i] ?? null,
    영업이익: data.accounts["영업이익"]?.[i] ?? null,
  }));

  return (
    <div className="space-y-5">
      {Object.keys(data.growth).length > 0 && (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)]">
          {Object.entries(data.growth).map(([k, v]) => (
            <Metric
              key={k}
              label={k}
              value={pct(v, true)}
              className={trend(v)}
            />
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid stroke="#f5f5f4" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "#a8a29e" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a8a29e" }}
            width={48}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v: number) => `${Math.round(v).toLocaleString()}억`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="매출액" fill="#0f766e" radius={[3, 3, 0, 0]} />
          <Bar dataKey="영업이익" fill="#5eead4" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--fg-subtle)]">
              <th className="px-2 py-2 text-left font-medium">계정 (억원)</th>
              {data.years.map((y) => (
                <th key={y} className="px-2 py-2 text-right font-medium">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.accounts).map(([acct, vals]) => (
              <tr key={acct} className="border-b border-[var(--line)] last:border-0">
                <td className="px-2 py-1.5 text-[var(--fg-muted)]">{acct}</td>
                {vals.map((v, i) => (
                  <td key={i} className="tabular px-2 py-1.5 text-right">
                    {v == null
                      ? "-"
                      : acct.includes("%")
                        ? v.toFixed(1)
                        : Math.round(v).toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-[var(--fg-subtle)]">
        ※ 외부 정보 — 금융감독원 OpenDART 공시 원문 (연결 기준 우선)
      </p>
    </div>
  );
}

/* ═══════════════════════════════ 밸류에이션 밴드 */
function BandTab({ fund }: { fund: FundPoint[] }) {
  const [metric, setMetric] = useState<"per" | "pbr">("per");

  const data = fund.filter((f) => (f[metric] ?? 0) > 0);
  if (!data.length)
    return <Empty text="밸류에이션 이력이 없습니다. backfill 수집을 먼저 실행하세요." />;

  const vals = data.map((d) => d[metric] as number).sort((a, b) => a - b);
  const q = (p: number) => vals[Math.floor(vals.length * p)];
  const cur = data[data.length - 1][metric] as number;
  const percentile = (vals.filter((v) => v < cur).length / vals.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["per", "pbr"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md border px-2.5 py-1 text-xs uppercase transition ${
                metric === m
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] text-[var(--fg-muted)] hover:border-[var(--line-strong)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--fg-subtle)]">
          현재 {metric.toUpperCase()}{" "}
          <strong className="text-[var(--fg)]">{cur.toFixed(2)}</strong> · 과거
          3년 중{" "}
          <strong
            className={percentile < 30 ? "t-down" : percentile > 70 ? "t-up" : ""}
          >
            {percentile.toFixed(0)} 분위
          </strong>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid stroke="#f5f5f4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a8a29e" }}
            tickFormatter={(d: string) => d.slice(2, 7)}
            minTickGap={50}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a8a29e" }}
            width={38}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <ReferenceLine
            y={q(0.2)}
            stroke="#2563eb"
            strokeDasharray="3 3"
            label={{ value: `20분위 ${q(0.2).toFixed(1)}`, fontSize: 10, fill: "#2563eb", position: "insideLeft" }}
          />
          <ReferenceLine y={q(0.5)} stroke="#a8a29e" strokeDasharray="4 4" />
          <ReferenceLine
            y={q(0.8)}
            stroke="#dc2626"
            strokeDasharray="3 3"
            label={{ value: `80분위 ${q(0.8).toFixed(1)}`, fontSize: 10, fill: "#dc2626", position: "insideLeft" }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke="#1c1917"
            strokeWidth={1.4}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[12px] leading-relaxed text-[var(--fg-subtle)]">
        파란선(20분위) 아래면 과거 3년 대비 저평가 구간, 빨간선(80분위) 위면 고평가
        구간입니다. 다만 실적이 꺾이는 중이라면 낮은 PER이 오히려 함정일 수 있습니다.
      </p>
    </div>
  );
}

/* ═══════════════════════════════ 뉴스 */
function NewsTab({ name }: { name: string }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/news?q=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setMsg(j.error) : setItems(j.items)))
      .catch((e) => setMsg(String(e)));
  }, [name]);

  if (msg) return <Empty text={msg} />;
  if (!items) return <Empty text="뉴스 검색 중..." />;
  if (!items.length) return <Empty text="관련 뉴스가 없습니다." />;

  return (
    <div className="divide-y divide-[var(--line)]">
      {items.map((n, i) => (
        <a
          key={i}
          href={n.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-3 first:pt-0 last:pb-0 hover:bg-[var(--accent-bg)]/40"
        >
          <p className="text-sm font-medium text-[var(--fg)]">{n.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--fg-muted)]">
            {n.description}
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">{n.pubDate}</p>
        </a>
      ))}
      <p className="pt-3 text-[12px] text-[var(--fg-subtle)]">
        ※ 외부 정보 — 네이버 뉴스 검색 API
      </p>
    </div>
  );
}

/* ═══════════════════════════════ 공통 */
function Metric({
  label,
  value,
  suffix = "",
  hint,
  className = "",
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className="bg-[var(--card)] px-4 py-3">
      <p className="text-[12px] text-[var(--fg-subtle)]" title={hint}>
        {label}
      </p>
      <p className={`tabular mt-0.5 text-lg font-semibold ${className}`}>
        {value}
        {suffix && (
          <span className="ml-0.5 text-xs font-normal text-[var(--fg-subtle)]">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="py-12 text-center text-sm text-[var(--fg-subtle)]">{text}</p>
);
