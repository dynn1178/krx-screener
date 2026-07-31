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

const selectCls = "h-8 rounded-lg border px-2 text-[14px]";

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

  const ofKind = useMemo(() => rows.filter((r) => r.kind === kind), [rows, kind]);

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
      <div
        className="rounded-xl border p-6 text-[14px]"
        style={{
          borderColor: "var(--warn-line)",
          background: "var(--warn-bg)",
          color: "var(--warn-fg)",
        }}
      >
        {baseDate} 의 키워드 데이터가 없습니다. 키워드는 <code>stock_analysis</code>{" "}
        테이블의 테마·산업·이슈 키워드에서 집계합니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-lg border p-0.5"
          style={{ borderColor: "var(--line)", background: "var(--card)" }}
        >
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className="rounded-md px-3.5 py-1.5 text-[14px] font-bold transition"
              style={
                kind === k.key
                  ? { background: "var(--fg)", color: "var(--bg)" }
                  : { color: "var(--fg-subtle)" }
              }
            >
              {k.label}
            </button>
          ))}
        </div>
        <span className="text-[13px] tabular" style={{ color: "var(--fg-muted)" }}>
          {ofKind.length}개 키워드 · {stockCount}종목 · 상승 {upCount}개
        </span>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5"
        style={{ borderColor: "var(--line)", background: "var(--card-2)" }}
      >
        <label
          className="flex items-center gap-1.5 text-[13px]"
          style={{ color: "var(--fg-muted)" }}
        >
          키워드 정렬
          <select
            value={kwSort}
            onChange={(e) => setKwSort(e.target.value as KeywordSort)}
            className={selectCls}
            style={{ borderColor: "var(--line)" }}
          >
            {KEYWORD_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label
          className="flex items-center gap-1.5 text-[13px]"
          style={{ color: "var(--fg-muted)" }}
        >
          종목 정렬
          <select
            value={stSort}
            onChange={(e) => setStSort(e.target.value as StockSort)}
            className={selectCls}
            style={{ borderColor: "var(--line)" }}
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
          className={selectCls}
          style={{ borderColor: "var(--line)" }}
          aria-label="키워드 표기 개수"
        >
          {TOP_N_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.key === 0 ? o.label : `${o.label} 키워드`}
            </option>
          ))}
        </select>

        <label
          className="flex items-center gap-1.5 text-[13px]"
          style={{ color: "var(--fg-muted)" }}
        >
          <input
            type="checkbox"
            checked={upOnly}
            onChange={(e) => setUpOnly(e.target.checked)}
          />
          상승 키워드만
        </label>

        <span
          className="ml-auto text-[13px] tabular"
          style={{ color: "var(--fg-subtle)" }}
        >
          {list.length} / {ofKind.length}개 키워드
        </span>
      </div>

      {list.length === 0 ? (
        <p
          className="rounded-xl border p-6 text-center text-[14px]"
          style={{
            borderColor: "var(--line)",
            background: "var(--card)",
            color: "var(--fg-muted)",
          }}
        >
          조건에 맞는 키워드가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3">
            {list.map((k) => {
              const stocks = sortStocks(k.stocks, stSort);
              const up = (k.avg_change_pct ?? 0) > 0;
              const head = up
                ? "var(--up-bg)"
                : (k.avg_change_pct ?? 0) < 0
                  ? "var(--down-bg)"
                  : "var(--card-2)";
              return (
                <div
                  key={k.keyword}
                  className="flex w-[286px] shrink-0 flex-col overflow-hidden rounded-xl border"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--card)",
                  }}
                >
                  <div className="px-3 py-2.5 text-center" style={{ background: head }}>
                    <div className="truncate text-[15px] font-bold" title={k.keyword}>
                      {k.keyword}
                    </div>
                  </div>

                  <div
                    className="flex items-end justify-between gap-2 border-b px-3 py-2.5"
                    style={{ background: head, borderColor: "var(--line)" }}
                  >
                    <div>
                      <div className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                        평균상승률
                      </div>
                      <div
                        className={`text-[16px] font-bold tabular ${trend(k.avg_change_pct)}`}
                      >
                        {pct2(k.avg_change_pct)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                        누적거래대금
                      </div>
                      <div
                        className="text-[16px] font-bold tabular"
                        title={wonFull(k.total_trade_value)}
                      >
                        {wonShort(k.total_trade_value)}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between border-b px-3 py-1.5 text-[11px]"
                    style={{ borderColor: "var(--line)", color: "var(--fg-subtle)" }}
                  >
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
                        className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] hover:underline"
                      >
                        <span
                          className="truncate"
                          title={s.name}
                          style={{ color: "var(--fg-muted)" }}
                        >
                          {s.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 tabular">
                          <span
                            className={`w-16 text-right font-bold ${trend(s.change_pct)}`}
                          >
                            {pct2(s.change_pct)}
                          </span>
                          <span
                            className="w-16 text-right"
                            style={{ color: "var(--fg-subtle)" }}
                            title={wonFull(s.trade_value)}
                          >
                            {wonShort(s.trade_value)}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>

                  <div
                    className="border-t py-1.5 text-center text-[12px]"
                    style={{
                      borderColor: "var(--line)",
                      background: "var(--card-2)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {k.mentions}종목
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ul
        className="space-y-0.5 text-[12px] leading-relaxed"
        style={{ color: "var(--fg-subtle)" }}
      >
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
