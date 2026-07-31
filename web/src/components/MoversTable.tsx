"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { wonShort, wonFull, pct2, trend, int } from "@/lib/format";
import { naverLink, type ReportRow } from "@/lib/reportTypes";

const CATEGORIES = [
  "전체",
  "급등주",
  "급락주",
  "6%이상변동",
  "거래대금상위",
] as const;

/**
 * 구세대 screening 테이블은 '변동폭확대' 라는 다른 라벨을 쓴다.
 * 필터가 두 표기를 모두 잡도록 별칭을 둔다.
 */
const ALIASES: Record<string, string[]> = {
  급등주: ["급등주"],
  급락주: ["급락주"],
  "6%이상변동": ["6%이상변동", "변동폭확대"],
  거래대금상위: ["거래대금상위", "상위거래대금"],
};

const matches = (category: string | null, cat: string) =>
  !!category && (ALIASES[cat] ?? [cat]).some((a) => category.includes(a));

const catClass = (c: string) =>
  c === "급등주"
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : c === "급락주"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : c === "6%이상변동" || c === "변동폭확대"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-teal-50 text-teal-700 border-teal-200";

/** 전일대비 변동가 — 부호 + 천단위 구분 */
const signedInt = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(Math.round(v)).toLocaleString("ko-KR")}`;

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

  const counts = useMemo(() => {
    const m: Record<string, number> = { 전체: rows.length };
    for (const c of CATEGORIES.slice(1))
      m[c] = rows.filter((r) => matches(r.category, c)).length;
    return m;
  }, [rows]);

  const shown = useMemo(
    () => (cat === "전체" ? rows : rows.filter((r) => matches(r.category, cat))),
    [rows, cat]
  );

  if (!rows.length) {
    return (
      <section className="space-y-2">
        <h2 className="text-[15px] font-bold tracking-tight">종목 스크리닝</h2>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {baseDate} 기준으로 스크리닝 조건(급등 15% 이상 / 급락 -10% 이하 /
          장중 변동폭 6% 이상 / 거래대금 500억원 이상)을 충족한 종목이 없거나,
          해당 일자의 시세·분석 데이터가 아직 적재되지 않았습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold tracking-tight">종목 스크리닝</h2>
        <span className="text-xs text-neutral-500">
          {baseDate} 기준 · {rows.length}종목
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`rounded border px-2 py-1 text-[11px] font-medium transition ${
                cat === c
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-[var(--line)] bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {c}
              <span className="ml-1 opacity-60">{counts[c] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full min-w-[1080px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-neutral-50 text-[11px] text-neutral-500">
              <th className="px-2 py-2 text-right font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">종목</th>
              <th className="px-2 py-2 text-left font-medium">구분</th>
              <th className="px-2 py-2 text-right font-medium">종가</th>
              <th className="px-2 py-2 text-right font-medium">전일대비</th>
              <th className="px-2 py-2 text-right font-medium">등락률</th>
              <th className="px-2 py-2 text-right font-medium">장중변동폭</th>
              <th className="px-2 py-2 text-right font-medium">거래대금</th>
              <th className="px-2 py-2 text-right font-medium">시가총액</th>
              <th className="px-2 py-2 text-right font-medium">외국인</th>
              <th className="px-2 py-2 text-right font-medium">기관</th>
              <th className="px-2 py-2 text-right font-medium">개인</th>
            </tr>
          </thead>
          {shown.map((r) => {
              const cats = (r.category ?? "").split(" / ").filter(Boolean);
              const hasAnalysis =
                r.hasAnalysis &&
                (r.issueNote || r.themeKw || r.industryKw || r.refs.length);
              return (
                <tbody key={r.ticker} className="border-b border-[var(--line)]">
                  <tr className="hover:bg-neutral-50/60">
                    <td className="px-2 py-2 text-right tabular text-neutral-400">
                      {r.rank}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/stock/${r.ticker}`}
                        className="font-semibold text-neutral-900 hover:text-teal-700 hover:underline"
                      >
                        {r.name}
                      </Link>
                      <a
                        href={naverLink(r.ticker)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="네이버 증권에서 보기"
                        className="ml-1.5 tabular text-[10px] text-neutral-400 hover:text-teal-700 hover:underline"
                      >
                        {r.ticker} ↗
                      </a>
                      {r.market && (
                        <span className="ml-1 text-[10px] text-neutral-400">
                          {r.market}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-0.5">
                        {cats.length ? (
                          cats.map((c) => (
                            <span
                              key={c}
                              className={`rounded border px-1 py-px text-[10px] font-medium ${catClass(c)}`}
                            >
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular font-semibold">
                      {int(r.close)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right tabular ${trend(r.changePrice)}`}
                    >
                      {signedInt(r.changePrice)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right tabular font-bold ${trend(r.changeRate)}`}
                    >
                      {pct2(r.changeRate)}
                    </td>
                    <td className="px-2 py-2 text-right tabular text-neutral-600">
                      {r.swingPct == null ? "—" : `${r.swingPct.toFixed(2)}%`}
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular"
                      title={wonFull(r.tradeValue)}
                    >
                      {wonShort(r.tradeValue)}
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular text-neutral-600"
                      title={wonFull(r.marketCap)}
                    >
                      {wonShort(r.marketCap)}
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      <NetBuy v={r.foreignNetBuy} />
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      <NetBuy v={r.instNetBuy} />
                    </td>
                    <td className="px-2 py-2 text-right tabular">
                      <NetBuy v={r.indivNetBuy} />
                    </td>
                  </tr>

                  {hasAnalysis && (
                    <tr>
                      <td />
                      <td colSpan={11} className="px-2 pb-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {r.industryKw && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">
                              산업 · {r.industryKw}
                            </span>
                          )}
                          {r.themeKw && (
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                              테마 · {r.themeKw}
                            </span>
                          )}
                          {r.issueKw && (
                            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700">
                              이슈 · {r.issueKw}
                            </span>
                          )}
                        </div>
                        {r.issueNote && (
                          <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                            {r.issueNote}
                          </p>
                        )}
                        {r.related && (
                          <p className="mt-1 text-[11px] text-neutral-400">
                            관련종목 · {r.related}
                          </p>
                        )}
                        {r.refs.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.refs.map((a, i) => (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-50"
                              >
                                📰 {a.title ?? `기사 ${i + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
          })}
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-neutral-400">
        분류 기준 — 급등주: 전일 대비 +15% 이상 · 급락주: -10% 이하 ·
        6%이상변동: 당일 고가/저가 변동폭 6% 이상 · 거래대금상위: 500억원 이상.
        각 카테고리 상위 20종목을 뽑아 합친 뒤 거래대금 내림차순으로 번호를
        재부여했으며, 여러 조건에 걸린 종목은 구분값에 모두 표기했습니다.
        거래대금·시가총액·순매수는 원 단위 정수이며 표기만 축약했습니다(마우스를
        올리면 원 단위 전체값).
      </p>
    </section>
  );
}
