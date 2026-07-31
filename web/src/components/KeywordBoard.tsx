"use client";

import { useMemo, useState } from "react";
import { wonShort, wonFull, pct2, trend } from "@/lib/format";
import {
  naverLink,
  sortKeywords,
  sortStocks,
  KEYWORD_SORTS,
  TOP_N_OPTIONS,
  type KeywordRow,
  type KeywordSort,
  type StockSort,
  type TopN,
} from "@/lib/reportTypes";

const KINDS = [
  { key: "theme", label: "테마키워드" },
  { key: "industry", label: "산업키워드" },
  { key: "issue", label: "이슈키워드" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

/** 카드 헤더 색 — 순환 배정 */
const TONES = [
  "bg-sky-50",
  "bg-amber-50",
  "bg-emerald-50",
  "bg-violet-50",
  "bg-rose-50",
  "bg-cyan-50",
  "bg-lime-50",
  "bg-orange-50",
];

export default function KeywordBoard({
  rows,
  baseDate,
}: {
  rows: KeywordRow[];
  baseDate: string;
}) {
  const [kind, setKind] = useState<Kind>("theme");
  const [kwSort, setKwSort] = useState<KeywordSort>("value");
  const [stSort, setStSort] = useState<StockSort>("value");
  const [topN, setTopN] = useState<TopN>(10);
  const [upOnly, setUpOnly] = useState(false);

  const ofKind = useMemo(
    () => rows.filter((r) => r.kind === kind),
    [rows, kind]
  );

  const list = useMemo(() => {
    let out = ofKind;
    if (upOnly) out = out.filter((r) => (r.avg_change_pct ?? 0) > 0);
    out = sortKeywords(out, kwSort);
    return topN === 0 ? out : out.slice(0, topN);
  }, [ofKind, kwSort, topN, upOnly]);

  const stockCount = useMemo(
    () => new Set(ofKind.flatMap((r) => r.stocks.map((s) => s.code))).size,
    [ofKind]
  );
  const upCount = ofKind.filter((r) => (r.avg_change_pct ?? 0) > 0).length;

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        {baseDate} 의 키워드 데이터가 없습니다. 키워드는{" "}
        <code>screening</code> 테이블의 테마·산업·이슈 키워드에서 집계합니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 종류 탭 */}
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
        <span className="text-[11px] text-neutral-500 tabular">
          {ofKind.length}개 키워드 · {stockCount}종목 · 상승 {upCount}개
        </span>
      </div>

      {/* 정렬·표기 컨트롤 */}
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

        <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          종목 정렬
          <select
            value={stSort}
            onChange={(e) => setStSort(e.target.value as StockSort)}
            className="h-7 rounded border border-[var(--line)] bg-white px-1.5 text-[12px]"
          >
            {KEYWORD_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value) as TopN)}
          className="h-7 rounded border border-[var(--line)] bg-white px-1.5 text-[12px]"
          aria-label="키워드 표기 개수"
        >
          {TOP_N_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.key === 0 ? o.label : `${o.label} 키워드`}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
          <input
            type="checkbox"
            checked={upOnly}
            onChange={(e) => setUpOnly(e.target.checked)}
            className="accent-teal-700"
          />
          상승 키워드만
        </label>

        <span className="ml-auto text-[11px] text-neutral-400 tabular">
          {list.length} / {ofKind.length}개 키워드
        </span>
      </div>

      {/* 카드 컬럼 — 가로 스크롤 */}
      {list.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-center text-sm text-neutral-500">
          조건에 맞는 키워드가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3">
            {list.map((k, i) => {
              const stocks = sortStocks(k.stocks, stSort);
              return (
                <div
                  key={k.keyword}
                  className="flex w-[264px] shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-white"
                >
                  <div className={`px-3 py-2 text-center ${TONES[i % TONES.length]}`}>
                    <div className="truncate text-[13px] font-bold" title={k.keyword}>
                      {k.keyword}
                    </div>
                  </div>

                  <div
                    className={`flex items-end justify-between gap-2 border-b border-[var(--line)] px-3 py-2 ${TONES[i % TONES.length]}`}
                  >
                    <div>
                      <div className="text-[10px] text-neutral-500">평균상승률</div>
                      <div
                        className={`text-[14px] font-bold tabular ${trend(k.avg_change_pct)}`}
                      >
                        {pct2(k.avg_change_pct)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-neutral-500">누적거래대금</div>
                      <div
                        className="text-[14px] font-bold tabular"
                        title={wonFull(k.total_trade_value)}
                      >
                        {wonShort(k.total_trade_value)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-1 text-[10px] text-neutral-400">
                    <span>종목명</span>
                    <span className="flex gap-3">
                      <span>상승률</span>
                      <span>거래대금</span>
                    </span>
                  </div>

                  <div className="flex-1">
                    {stocks.map((s) => (
                      <a
                        key={s.code || s.name}
                        href={s.code ? naverLink(s.code) : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] hover:bg-neutral-50"
                      >
                        <span className="truncate text-neutral-700" title={s.name}>
                          {s.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 tabular">
                          <span
                            className={`w-14 text-right font-semibold ${trend(s.change_pct)}`}
                          >
                            {pct2(s.change_pct)}
                          </span>
                          <span
                            className="w-16 text-right text-neutral-500"
                            title={wonFull(s.trade_value)}
                          >
                            {wonShort(s.trade_value)}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>

                  <div className="border-t border-[var(--line)] bg-neutral-50 py-1 text-center text-[10px] text-neutral-400">
                    {k.mentions}종목
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ul className="space-y-0.5 text-[11px] leading-relaxed text-neutral-400">
        <li>
          · <strong>평균상승률</strong>은 해당 키워드 종목들의 등락률 산술평균,{" "}
          <strong>누적거래대금</strong>은 합계입니다.
        </li>
        <li>· 종목명을 누르면 네이버 증권 페이지가 열립니다.</li>
        <li>
          · 키워드는 스크리닝에 선정된 종목만을 대상으로 하므로 시장 전체 테마
          통계가 아닙니다.
        </li>
      </ul>
    </div>
  );
}
