"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { wonShort, pct2, trend } from "@/lib/format";
import {
  sortKeywords,
  KEYWORD_SORTS,
  TOP_N_OPTIONS,
  type KeywordRow,
  type KeywordSort,
  type TopN,
} from "@/lib/reportTypes";

const WEEK = ["월", "화", "수", "목", "금"];

const KINDS = [
  { key: "theme", label: "테마키워드" },
  { key: "industry", label: "산업키워드" },
  { key: "issue", label: "이슈키워드" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

/** 평일(월~금) 5열 그리드로 한 달을 배치 */
function buildMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=일
  // 월요일 기준 선행 빈칸 (일요일은 이전 주로 취급)
  const lead = (firstDow + 6) % 7;
  for (let i = 0; i < Math.min(lead, 5); i++) cells.push(null);

  for (let d = 1; d <= total; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue; // 주말 제외
    cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 5 !== 0) cells.push(null);
  return { y, m, cells };
}

export default function SurgeCalendar({
  rows,
  months,
}: {
  rows: KeywordRow[];
  /** 표시할 달 목록 (YYYY-MM, 최신순) */
  months: string[];
}) {
  const [kind, setKind] = useState<Kind>("theme");
  const [kwSort, setKwSort] = useState<KeywordSort>("value");
  const [topN, setTopN] = useState<TopN>(10);
  const [upOnly, setUpOnly] = useState(false);

  const byDate = useMemo(() => {
    const m = new Map<string, KeywordRow[]>();
    for (const r of rows) {
      if (r.kind !== kind) continue;
      if (upOnly && (r.avg_change_pct ?? 0) <= 0) continue;
      const g = m.get(r.base_date) ?? [];
      g.push(r);
      m.set(r.base_date, g);
    }
    for (const [d, g] of m) {
      const sorted = sortKeywords(g, kwSort);
      m.set(d, topN === 0 ? sorted : sorted.slice(0, topN));
    }
    return m;
  }, [rows, kind, kwSort, topN, upOnly]);

  const monthStats = (ym: string) => {
    const inMonth = rows.filter(
      (r) => r.kind === kind && r.base_date.startsWith(ym)
    );
    return {
      total: inMonth.length,
      up: inMonth.filter((r) => (r.avg_change_pct ?? 0) > 0).length,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-0.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
                kind === k.key
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--line)] bg-neutral-50/60 px-3 py-2">
        <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          키워드 정렬
          <select
            value={kwSort}
            onChange={(e) => setKwSort(e.target.value as KeywordSort)}
            className="h-7 rounded border border-[var(--line)] bg-white px-1.5 text-[12px]"
          >
            {KEYWORD_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
          <input
            type="checkbox"
            checked={upOnly}
            onChange={(e) => setUpOnly(e.target.checked)}
            className="accent-teal-700"
          />
          급등 키워드만 (평균 상승률 &gt; 0)
        </label>

        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value) as TopN)}
          className="h-7 rounded border border-[var(--line)] bg-white px-1.5 text-[12px]"
          aria-label="키워드 표기 개수"
        >
          {TOP_N_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {months.map((ym) => {
        const { y, m, cells } = buildMonth(ym);
        const st = monthStats(ym);
        return (
          <section key={ym} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-[14px] font-bold tracking-tight">
                {y}년 {m}월
              </h2>
              <span className="text-[11px] text-neutral-500 tabular">
                이 달 키워드 {st.total}건 · 상승 {st.up}건
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)]">
              <div className="grid grid-cols-5 border-b border-[var(--line)] bg-neutral-50">
                {WEEK.map((w) => (
                  <div
                    key={w}
                    className="py-1.5 text-center text-[11px] font-medium text-neutral-500"
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-5">
                {cells.map((iso, i) => {
                  if (!iso)
                    return (
                      <div
                        key={i}
                        className="min-h-[128px] border-b border-r border-[var(--line)] bg-neutral-50/40"
                      />
                    );

                  const day = Number(iso.slice(8, 10));
                  const list = byDate.get(iso) ?? [];

                  return (
                    <div
                      key={i}
                      className="min-h-[128px] border-b border-r border-[var(--line)] p-1.5"
                    >
                      <div className="flex items-baseline justify-between">
                        <span
                          className={`text-[12px] font-semibold tabular ${
                            list.length ? "text-neutral-800" : "text-neutral-300"
                          }`}
                        >
                          {day}
                        </span>
                        {list.length > 0 && (
                          <Link
                            href={`/?date=${iso}`}
                            className="text-[10px] text-teal-700 hover:underline"
                          >
                            상세
                          </Link>
                        )}
                      </div>

                      {list.length === 0 ? (
                        <div className="mt-6 text-center text-[11px] text-neutral-300">
                          –
                        </div>
                      ) : (
                        <div className="mt-1 space-y-px">
                          {list.map((k) => (
                            <div
                              key={k.keyword}
                              className="flex items-baseline justify-between gap-1 text-[10px] tabular"
                            >
                              <span
                                className="truncate text-neutral-700"
                                title={k.keyword}
                              >
                                {k.keyword}
                              </span>
                              <span className="flex shrink-0 gap-1">
                                <span
                                  className={`font-semibold ${trend(k.avg_change_pct)}`}
                                >
                                  {pct2(k.avg_change_pct)}
                                </span>
                                <span className="text-neutral-400">
                                  {wonShort(k.total_trade_value)}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <p className="text-[11px] leading-relaxed text-neutral-400">
        각 날짜에는 그날 스크리닝된 종목들의 키워드를 평균 상승률·누적 거래대금과
        함께 표시합니다. 주말·휴장일은 제외했고, 뉴스 분석이 없는 날은 비어
        있습니다. 날짜의 &quot;상세&quot;를 누르면 해당일 리포트로 이동합니다.
      </p>
    </div>
  );
}
