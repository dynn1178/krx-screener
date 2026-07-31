"use client";

import { useMemo, useState } from "react";
import { wonShort, wonFull, pct2, trend, int } from "@/lib/format";
import { naverLink, type ReportRow } from "@/lib/reportTypes";

const CATEGORIES = ["전체", "급등주", "급락주", "6%이상변동", "거래대금상위"] as const;

/** 구세대 screening 은 '변동폭확대' 처럼 다른 라벨을 쓴다 */
const ALIASES: Record<string, string[]> = {
  급등주: ["급등주"],
  급락주: ["급락주"],
  "6%이상변동": ["6%이상변동", "변동폭확대"],
  거래대금상위: ["거래대금상위", "상위거래대금"],
};

const matches = (category: string | null, cat: string) =>
  !!category && (ALIASES[cat] ?? [cat]).some((a) => category.includes(a));

const catClass = (c: string) =>
  c.includes("급등")
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : c.includes("급락")
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : c.includes("변동")
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-teal-50 text-teal-700 border-teal-200";

const SORTS = [
  { key: "rank", label: "번호순" },
  { key: "change", label: "등락률순" },
  { key: "value", label: "거래대금순" },
  { key: "swing", label: "변동폭순" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const signedInt = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(Math.round(v)).toLocaleString("ko-KR")}`;

function NetBuy({ v }: { v: number | null }) {
  if (v == null) return <span className="text-neutral-300">—</span>;
  return (
    <span className={trend(v)} title={wonFull(v)}>
      {v > 0 ? "+" : ""}
      {wonShort(v)}
    </span>
  );
}

export default function MoversTable({
  rows,
  baseDate,
}: {
  rows: ReportRow[];
  baseDate: string;
}) {
  const [cat, setCat] = useState<string>("전체");
  const [sort, setSort] = useState<SortKey>("rank");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const m: Record<string, number> = { 전체: rows.length };
    for (const c of CATEGORIES.slice(1))
      m[c] = rows.filter((r) => matches(r.category, c)).length;
    return m;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = cat === "전체" ? rows : rows.filter((r) => matches(r.category, cat));

    if (needle) {
      out = out.filter((r) =>
        [r.name, r.ticker, r.industryKw, r.themeKw, r.issueKw, r.related]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle))
      );
    }

    const by: Record<SortKey, (a: ReportRow, b: ReportRow) => number> = {
      rank: (a, b) => a.rank - b.rank,
      change: (a, b) => (b.changeRate ?? -Infinity) - (a.changeRate ?? -Infinity),
      value: (a, b) => (b.tradeValue ?? -1) - (a.tradeValue ?? -1),
      swing: (a, b) => (b.swingPct ?? -Infinity) - (a.swingPct ?? -Infinity),
    };
    return [...out].sort(by[sort]);
  }, [rows, cat, sort, q]);

  if (!rows.length) {
    return (
      <section className="space-y-2">
        <h2 className="text-[15px] font-bold tracking-tight">종목 스크리닝</h2>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {baseDate} 기준으로 스크리닝 조건(급등 +15% 이상 / 급락 -10% 이하 /
          장중 변동폭 6% 이상 / 거래대금 500억원 이상)을 충족한 종목이 없거나,
          해당 일자의 시세·분석 데이터가 아직 적재되지 않았습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-bold tracking-tight">
          종목 스크리닝 — 총 {rows.length}종목
        </h2>
        <span className="text-xs text-neutral-500">{baseDate} 기준</span>
      </div>

      <p className="rounded-md border border-[var(--line)] bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
        급등주 {counts["급등주"]}종목 · 거래대금상위 {counts["거래대금상위"]}종목 ·
        변동폭확대 {counts["6%이상변동"]}종목 · 급락주 {counts["급락주"]}종목 (중복
        통합 후 {rows.length}종목)
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="종목명·코드·키워드 검색"
          className="h-8 w-56 rounded border border-[var(--line)] bg-white px-2.5 text-[12px] outline-none focus:border-teal-600"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-8 rounded border border-[var(--line)] bg-white px-2 text-[12px]"
          aria-label="구분 필터"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c} ({counts[c] ?? 0})
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 rounded border border-[var(--line)] bg-white px-2 text-[12px]"
          aria-label="정렬"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-neutral-400 tabular">
          {shown.length} / {rows.length}종목
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full min-w-[1680px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-neutral-50 text-[11px] text-neutral-500">
              <th className="px-2 py-2 text-right font-medium">번호</th>
              <th className="px-2 py-2 text-left font-medium">종목명</th>
              <th className="px-2 py-2 text-left font-medium">코드</th>
              <th className="px-2 py-2 text-right font-medium">시가</th>
              <th className="px-2 py-2 text-right font-medium">종가</th>
              <th className="px-2 py-2 text-right font-medium">증감가</th>
              <th className="px-2 py-2 text-left font-medium">구분값</th>
              <th className="px-2 py-2 text-right font-medium">등락률</th>
              <th className="px-2 py-2 text-right font-medium">거래대금(원)</th>
              <th className="px-2 py-2 text-center font-medium">산업</th>
              <th className="px-2 py-2 text-center font-medium">테마</th>
              <th className="px-2 py-2 text-left font-medium">상승/하락 이슈</th>
              <th className="px-2 py-2 text-center font-medium">이슈</th>
              <th className="px-2 py-2 text-left font-medium">관련 종목</th>
              <th className="px-2 py-2 text-right font-medium">외국인</th>
              <th className="px-2 py-2 text-right font-medium">기관</th>
              <th className="px-2 py-2 text-right font-medium">개인</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const cats = (r.category ?? "").split(" / ").filter(Boolean);
              return (
                <tr
                  key={r.ticker}
                  className="border-b border-[var(--line)] align-top hover:bg-neutral-50/60"
                >
                  <td className="px-2 py-2.5 text-right tabular text-neutral-400">
                    {r.rank}
                  </td>
                  <td className="px-2 py-2.5">
                    <a
                      href={naverLink(r.ticker)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="네이버 증권에서 보기"
                      className="font-bold text-neutral-900 hover:text-teal-700 hover:underline"
                    >
                      {r.name}
                    </a>
                    {r.market && (
                      <div className="text-[10px] text-neutral-400">
                        {r.market}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 tabular text-neutral-400">
                    {r.ticker}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular text-neutral-600">
                    {int(r.open)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular font-semibold">
                    {int(r.close)}
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right tabular ${trend(r.changePrice)}`}
                  >
                    {signedInt(r.changePrice)}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap gap-0.5">
                      {cats.length ? (
                        cats.map((c) => (
                          <span
                            key={c}
                            className={`whitespace-nowrap rounded border px-1 py-px text-[10px] font-medium ${catClass(c)}`}
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right tabular font-bold ${trend(r.changeRate)}`}
                  >
                    {pct2(r.changeRate)}
                  </td>
                  <td
                    className="px-2 py-2.5 text-right tabular"
                    title={wonFull(r.tradeValue)}
                  >
                    {wonShort(r.tradeValue)}
                    {r.swingPct != null && (
                      <div className="text-[10px] text-neutral-400">
                        변동폭 {r.swingPct.toFixed(2)}%
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {r.industryKw ? (
                      <span className="whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        {r.industryKw}
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {r.themeKw ? (
                      <span className="whitespace-nowrap rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        {r.themeKw}
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="min-w-[300px] max-w-[420px] px-2 py-2.5 text-[11px] leading-relaxed text-neutral-700">
                    {r.issueNote ?? <span className="text-neutral-300">—</span>}
                    {r.refs.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.refs.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-[var(--line)] px-1 py-px text-[10px] text-neutral-500 hover:bg-neutral-50"
                          >
                            📰 {a.title ?? `기사 ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {r.issueKw ? (
                      <span className="whitespace-nowrap rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                        {r.issueKw}
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="min-w-[150px] max-w-[200px] px-2 py-2.5 text-[10px] leading-relaxed text-neutral-500">
                    {r.related ?? <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular">
                    <NetBuy v={r.foreignNetBuy} />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular">
                    <NetBuy v={r.instNetBuy} />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular">
                    <NetBuy v={r.indivNetBuy} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        분류 기준 — 급등주: 전일 대비 +15% 이상 · 급락주: -10% 이하 ·
        6%이상변동: 당일 고가/저가 변동폭 6% 이상 · 거래대금상위: 500억원 이상.
        각 카테고리 상위 20종목을 뽑아 합친 뒤 거래대금 내림차순으로 번호를
        재부여했으며, 여러 조건에 걸린 종목은 구분값에 모두 표기했습니다.
        거래대금·순매수는 원 단위 정수이며 표기만 축약했습니다(마우스를 올리면
        원 단위 전체값). 종목명을 누르면 네이버 증권으로 이동합니다.
      </p>
    </section>
  );
}
