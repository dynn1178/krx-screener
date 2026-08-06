"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { wonShort, pct2, trend, trendVar, dateKo } from "@/lib/format";
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

/** 지수 등락 강도 → 셀 배경. 개별 종목 급등이 시장 흐름인지 역행인지 구분하는 배경. */
function indexTint(pct: number | null | undefined): string | undefined {
  if (pct == null) return undefined;
  const a = Math.min(Math.abs(pct) / 5, 1);
  if (a < 0.12) return undefined;
  const c = pct > 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${c} ${Math.round(a * 16)}%, transparent)`;
}

export default function SurgeCalendar({
  rows,
  months,
  indexMap,
}: {
  rows: KeywordRow[];
  /** 표시할 달 목록 (YYYY-MM, 최신순) */
  months: string[];
  /** 날짜 → KOSPI 등락률 */
  indexMap: Record<string, { kospiClose: number | null; kospiChangePct: number | null }>;
}) {
  const [kind, setKind] = useState<Kind>("theme");
  const [kwSort, setKwSort] = useState<KeywordSort>("value");
  const [topN, setTopN] = useState<TopN>(10);
  const [upOnly, setUpOnly] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--card)] p-0.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                kind === k.key
                  ? "bg-[var(--fg)] text-[var(--bg)]"
                  : "text-[var(--fg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--line)] bg-[var(--card-2)] px-3 py-2">
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--fg-subtle)]">
          키워드 정렬
          <select
            value={kwSort}
            onChange={(e) => setKwSort(e.target.value as KeywordSort)}
            className="h-7 rounded border border-[var(--line)] bg-[var(--card)] px-1.5 text-[13px]"
          >
            {KEYWORD_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)]">
          <input
            type="checkbox"
            checked={upOnly}
            onChange={(e) => setUpOnly(e.target.checked)}
            className=""
          />
          급등 키워드만 (평균 상승률 &gt; 0)
        </label>

        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value) as TopN)}
          className="h-7 rounded border border-[var(--line)] bg-[var(--card)] px-1.5 text-[13px]"
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
              <span className="text-[12px] text-[var(--fg-subtle)] tabular">
                이 달 키워드 {st.total}건 · 상승 {st.up}건
              </span>
            </div>

            {/* 모바일 — 세로 일자 리스트, 옆스크롤 없이 탭해서 펼쳐본다 */}
            <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)] lg:hidden">
              {cells
                .filter((iso): iso is string => iso != null)
                .map((iso) => {
                  const list = byDate.get(iso) ?? [];
                  const idx = indexMap[iso];
                  const expanded = expandedDate === iso;
                  return (
                    <div
                      key={iso}
                      className="border-b last:border-0"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedDate((d) => (d === iso ? null : iso))}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      >
                        <span
                          className="h-8 w-1 shrink-0 rounded-full"
                          style={{
                            background:
                              idx?.kospiChangePct != null
                                ? trendVar(idx.kospiChangePct)
                                : "var(--line)",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                              className={`text-[13px] font-semibold tabular ${
                                list.length ? "text-[var(--fg)]" : "text-[var(--fg-subtle)]"
                              }`}
                            >
                              {dateKo(iso)}
                            </span>
                            {idx?.kospiChangePct != null && (
                              <span
                                className={`text-[11px] font-bold tabular ${trend(idx.kospiChangePct)}`}
                              >
                                KOSPI {pct2(idx.kospiChangePct)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[12px]" style={{ color: "var(--fg-subtle)" }}>
                            {list.length > 0 ? `${list.length}개 키워드` : "키워드 없음"}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px]" style={{ color: "var(--fg-subtle)" }}>
                          {expanded ? "▲" : "▼"}
                        </span>
                      </button>

                      {expanded && list.length > 0 && (
                        <div className="space-y-1 px-3 pb-3 pl-7">
                          {list.map((k) => (
                            <div
                              key={k.keyword}
                              className="flex items-baseline justify-between gap-2 text-[12px] tabular"
                            >
                              <span className="truncate" style={{ color: "var(--fg-muted)" }} title={k.keyword}>
                                {k.keyword}
                              </span>
                              <span className="flex shrink-0 gap-1.5">
                                <span className={`font-semibold ${trend(k.avg_change_pct)}`}>
                                  {pct2(k.avg_change_pct)}
                                </span>
                                <span style={{ color: "var(--fg-subtle)" }}>
                                  {wonShort(k.total_trade_value)}
                                </span>
                              </span>
                            </div>
                          ))}
                          <Link
                            href={`/?date=${iso}`}
                            className="mt-1 inline-block text-[12px]"
                            style={{ color: "var(--accent-fg)" }}
                          >
                            상세 →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* 데스크톱 — 기존 5칸 그리드 */}
            <div className="hidden overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)] lg:block">
              <div className="grid grid-cols-5 border-b border-[var(--line)] bg-[var(--card-2)]">
                {WEEK.map((w) => (
                  <div
                    key={w}
                    className="py-1.5 text-center text-[12px] font-medium text-[var(--fg-subtle)]"
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
                        className="min-h-[128px] border-b border-r border-[var(--line)] bg-[var(--card-2)]"
                      />
                    );

                  const day = Number(iso.slice(8, 10));
                  const list = byDate.get(iso) ?? [];
                  const idx = indexMap[iso];

                  return (
                    <div
                      key={i}
                      className="min-h-[128px] border-b border-r border-[var(--line)] p-1.5"
                      style={{ background: indexTint(idx?.kospiChangePct) }}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span
                          className={`text-[13px] font-semibold tabular ${
                            list.length ? "text-[var(--fg)]" : "text-[var(--fg-subtle)]"
                          }`}
                        >
                          {day}
                        </span>
                        {/* 그날 시장 전체가 어디로 갔는지 */}
                        {idx?.kospiChangePct != null && (
                          <span
                            className={`text-[11px] font-bold tabular ${trend(idx.kospiChangePct)}`}
                            title={`KOSPI ${idx.kospiClose ?? ""} (${pct2(idx.kospiChangePct)})`}
                          >
                            KOSPI {pct2(idx.kospiChangePct)}
                          </span>
                        )}
                        {list.length > 0 && (
                          <Link
                            href={`/?date=${iso}`}
                            className="text-[12px] text-[var(--accent-fg)] hover:underline"
                          >
                            상세
                          </Link>
                        )}
                      </div>

                      {list.length === 0 ? (
                        <div className="mt-6 text-center text-[12px] text-[var(--fg-subtle)]">
                          –
                        </div>
                      ) : (
                        <div className="mt-1 space-y-px">
                          {list.map((k) => (
                            <div
                              key={k.keyword}
                              className="flex items-baseline justify-between gap-1 text-[12px] tabular"
                            >
                              <span
                                className="truncate text-[var(--fg-muted)]"
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
                                <span className="text-[var(--fg-subtle)]">
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

      <p className="text-[12px] leading-relaxed text-[var(--fg-subtle)]">
        각 날짜에는 그날 스크리닝된 종목들의 키워드를 평균 상승률·누적 거래대금과
        함께 표시합니다. 셀 배경과 상단의 KOSPI 등락률은 그날 시장 전체가 어디로
        움직였는지를 나타내며, 키워드 등락률과 비교하면 해당 테마가 시장을
        따라간 것인지 역행한 것인지 구분할 수 있습니다. 주말·휴장일은 제외했고,
        뉴스 분석이 없는 날은 비어 있습니다.
      </p>
    </div>
  );
}
