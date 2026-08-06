"use client";

import { useMemo, useState } from "react";
import { wonShort, wonFull, pct2, trend } from "@/lib/format";
import { naverLink, type FlowSignal } from "@/lib/reportTypes";
import StatRow from "@/components/StatRow";

const TURN_LABEL: Record<"buy" | "sell", string> = {
  buy: "순매수 전환",
  sell: "순매도 전환",
};

const NO_KEYWORD = "키워드 없음";

const GROUP_OPTIONS = [
  { key: "none", label: "기본 (거래대금순)" },
  { key: "theme", label: "테마별로 모아보기" },
  { key: "industry", label: "산업별로 모아보기" },
] as const;
type GroupKey = (typeof GROUP_OPTIONS)[number]["key"];

function Turn({ v, who }: { v: "buy" | "sell" | null; who: string }) {
  if (!v) return null;
  const buy = v === "buy";
  return (
    <span
      className="whitespace-nowrap rounded px-2 py-0.5 text-[12px] font-semibold"
      style={{
        background: buy ? "var(--up-bg)" : "var(--down-bg)",
        color: buy ? "var(--up)" : "var(--down)",
      }}
    >
      {who} {TURN_LABEL[v]}
    </span>
  );
}

const signedWon = (v: number) =>
  `${v > 0 ? "+" : ""}${wonShort(v)}`;

type FlowGroup = {
  key: string;
  rows: FlowSignal[];
  n: number;
  tradeValue: number;
  foreignNetBuy: number;
  instNetBuy: number;
  foreignBuyN: number;
  foreignSellN: number;
};

/** 모바일 전용 — 그룹 헤더 행을 카드로 */
function FlowGroupCard({ g }: { g: FlowGroup }) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "var(--accent-bg)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[14px] font-bold" style={{ color: "var(--accent-fg)" }}>
          {g.key}
        </span>
        <span className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
          {g.n}종목 · 합계 거래대금 {wonShort(g.tradeValue)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <span className={`text-[12px] font-semibold tabular ${trend(g.foreignNetBuy)}`}>
          외국인 합계 {signedWon(g.foreignNetBuy)}
        </span>
        <span className={`text-[12px] font-semibold tabular ${trend(g.instNetBuy)}`}>
          기관 합계 {signedWon(g.instNetBuy)}
        </span>
        <span className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
          외국인 전환 매수 {g.foreignBuyN} · 매도 {g.foreignSellN}
        </span>
      </div>
    </div>
  );
}

/** 모바일 전용 카드 — 표 한 행을 옆스크롤 없이 세로로 */
function FlowCard({ r }: { r: FlowSignal }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <a
            href={naverLink(r.ticker)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-bold hover:underline"
          >
            {r.name ?? r.ticker}
          </a>
          <div className="mt-0.5 text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
            {r.ticker}
          </div>
        </div>
        <span className={`text-[15px] font-bold tabular ${trend(r.changeRate)}`}>
          {pct2(r.changeRate)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Turn v={r.foreignTurn} who="외국인" />
        <Turn v={r.instTurn} who="기관" />
      </div>

      <div
        className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t pt-2"
        style={{ borderColor: "var(--line)" }}
      >
        <StatRow
          label="거래대금"
          value={wonShort(r.tradeValue)}
          title={wonFull(r.tradeValue)}
        />
        <span />
        <StatRow
          label="외국인"
          value={r.foreignNetBuy == null ? "—" : wonShort(r.foreignNetBuy)}
          valueClassName={trend(r.foreignNetBuy)}
        />
        <StatRow
          label="기관"
          value={r.instNetBuy == null ? "—" : wonShort(r.instNetBuy)}
          valueClassName={trend(r.instNetBuy)}
        />
      </div>
    </div>
  );
}

function FlowRow({ r }: { r: FlowSignal }) {
  return (
    <tr className="border-b" style={{ borderColor: "var(--line)" }}>
      <td className="px-3 py-2.5">
        <a
          href={naverLink(r.ticker)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold hover:underline"
        >
          {r.name ?? r.ticker}
        </a>
        <div className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
          {r.ticker}
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right font-bold tabular ${trend(r.changeRate)}`}>
        {pct2(r.changeRate)}
      </td>
      <td className="px-3 py-2.5 text-right tabular" title={wonFull(r.tradeValue)}>
        {wonShort(r.tradeValue)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          <Turn v={r.foreignTurn} who="외국인" />
          <Turn v={r.instTurn} who="기관" />
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right tabular ${trend(r.foreignNetBuy)}`}>
        {r.foreignNetBuy == null ? "—" : wonShort(r.foreignNetBuy)}
      </td>
      <td className={`px-3 py-2.5 text-right tabular ${trend(r.instNetBuy)}`}>
        {r.instNetBuy == null ? "—" : wonShort(r.instNetBuy)}
      </td>
    </tr>
  );
}

/**
 * 전일 대비 수급 방향이 뒤집힌 종목.
 * snapshot 이 (date, ticker) 누적으로 쌓이기 시작한 뒤부터 값이 나온다.
 */
export default function FlowSignals({
  rows,
  baseDate,
}: {
  rows: FlowSignal[];
  baseDate: string;
}) {
  const [groupBy, setGroupBy] = useState<GroupKey>("none");

  const groups = useMemo(() => {
    if (groupBy === "none") return null;

    const map = new Map<string, FlowSignal[]>();
    for (const r of rows) {
      const key = (groupBy === "theme" ? r.themeKw : r.industryKw) ?? NO_KEYWORD;
      const g = map.get(key);
      if (g) g.push(r);
      else map.set(key, [r]);
    }

    const list = [...map.entries()].map(([key, grs]) => ({
      key,
      rows: [...grs].sort((a, b) => (b.tradeValue ?? -1) - (a.tradeValue ?? -1)),
      n: grs.length,
      tradeValue: grs.reduce((s, r) => s + (r.tradeValue ?? 0), 0),
      foreignNetBuy: grs.reduce((s, r) => s + (r.foreignNetBuy ?? 0), 0),
      instNetBuy: grs.reduce((s, r) => s + (r.instNetBuy ?? 0), 0),
      foreignBuyN: grs.filter((r) => r.foreignTurn === "buy").length,
      foreignSellN: grs.filter((r) => r.foreignTurn === "sell").length,
    }));

    list.sort((a, b) => {
      if (a.key === NO_KEYWORD) return 1;
      if (b.key === NO_KEYWORD) return -1;
      return b.tradeValue - a.tradeValue;
    });
    return list;
  }, [rows, groupBy]);

  if (!rows.length) return null;

  const fBuy = rows.filter((r) => r.foreignTurn === "buy").length;
  const fSell = rows.filter((r) => r.foreignTurn === "sell").length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight">수급 방향 전환</h2>
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          {baseDate} · 전일 대비 외국인·기관 순매수 부호가 바뀐 종목
        </span>
        <span className="ml-auto text-[13px] tabular" style={{ color: "var(--fg-subtle)" }}>
          외국인 <span className="t-up font-bold">매수전환 {fBuy}</span> ·{" "}
          <span className="t-down font-bold">매도전환 {fSell}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--fg-subtle)" }}>
          보기 방식
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="h-8 rounded-md border px-2 text-[13px]"
            style={{ borderColor: "var(--line)", background: "var(--card)" }}
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {groupBy !== "none" && (
          <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>
            그룹 헤더의 합계는 해당 {groupBy === "theme" ? "테마" : "산업"}에 속한
            종목들의 외국인·기관 순매수를 모두 더한 값입니다.
          </span>
        )}
      </div>

      {/* 모바일 — 카드 리스트 */}
      <div className="space-y-2 lg:hidden">
        {groups == null
          ? rows.map((r) => <FlowCard key={r.ticker} r={r} />)
          : groups.flatMap((g) => [
              <FlowGroupCard key={`g-${g.key}`} g={g} />,
              ...g.rows.map((r) => <FlowCard key={r.ticker} r={r} />),
            ])}
      </div>

      {/* 데스크톱 — 기존 표 */}
      <div
        className="hidden overflow-x-auto rounded-xl border lg:block"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        <table className="w-full min-w-[860px] border-collapse text-[14px]">
          <thead>
            <tr
              className="border-b text-left"
              style={{
                borderColor: "var(--line)",
                background: "var(--card-2)",
                color: "var(--fg-muted)",
              }}
            >
              <th className="px-3 py-2.5 text-[13px] font-semibold">종목</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">등락률</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">거래대금</th>
              <th className="px-3 py-2.5 text-left text-[13px] font-semibold">전환</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">외국인</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">기관</th>
            </tr>
          </thead>
          <tbody>
            {groups == null
              ? rows.map((r) => <FlowRow key={r.ticker} r={r} />)
              : groups.flatMap((g) => [
                  <tr key={`g-${g.key}`} style={{ background: "var(--accent-bg)" }}>
                    <td colSpan={6} className="px-3 py-2">
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span
                          className="text-[14px] font-bold"
                          style={{ color: "var(--accent-fg)" }}
                        >
                          {g.key}
                        </span>
                        <span className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
                          {g.n}종목
                        </span>
                        <span className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
                          합계 거래대금 {wonShort(g.tradeValue)}
                        </span>
                        <span className={`text-[12px] font-semibold tabular ${trend(g.foreignNetBuy)}`}>
                          외국인 합계 {signedWon(g.foreignNetBuy)}
                        </span>
                        <span className={`text-[12px] font-semibold tabular ${trend(g.instNetBuy)}`}>
                          기관 합계 {signedWon(g.instNetBuy)}
                        </span>
                        <span className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
                          외국인 전환 매수 {g.foreignBuyN} · 매도 {g.foreignSellN}
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...g.rows.map((r) => <FlowRow key={r.ticker} r={r} />),
                ])}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
        개별 종목 판단보다 시장 국면을 읽는 데 쓰는 지표입니다. 외국인 매수전환
        종목이 매도전환보다 뚜렷하게 많으면 수급이 돌아서는 신호로 볼 수 있습니다.
        테마·산업별로 모아보면 특정 흐름에 수급이 쏠렸는지 확인할 수 있고, 그날
        분석 데이터가 없는 종목은 &ldquo;{NO_KEYWORD}&rdquo;로 묶입니다.
      </p>
    </section>
  );
}
