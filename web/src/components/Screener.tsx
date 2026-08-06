"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { eok, int, num, pct, trend, divFmt } from "@/lib/format";
import { screen, toCsv } from "@/lib/screen";
import {
  DEFAULT_FILTERS,
  type Filters,
  type NewsItem,
  type ScoredSnapshot,
  type Snapshot,
} from "@/lib/types";
import StatRow from "@/components/StatRow";

type Props = { rows: Snapshot[]; sectors: string[]; baseDate: string };

const naverFinanceUrl = (ticker: string) =>
  `https://finance.naver.com/item/main.naver?code=${ticker}`;

type NewsState = {
  status: "loading" | "done" | "error";
  items?: NewsItem[];
  msg?: string;
};

export default function Screener({ rows, sectors, baseDate }: Props) {
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [showFunnel, setShowFunnel] = useState(false);
  const [newsTicker, setNewsTicker] = useState<string | null>(null);
  const [newsCache, setNewsCache] = useState<Record<string, NewsState>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { rows: result, funnel } = useMemo(() => screen(rows, f), [rows, f]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  // 기본값과 달라진 조건 개수 — 모바일 필터 버튼 뱃지용
  const activeFilterCount = useMemo(
    () =>
      (Object.keys(f) as (keyof Filters)[]).filter((k) => {
        const a = f[k];
        const b = DEFAULT_FILTERS[k];
        if (Array.isArray(a) && Array.isArray(b)) return a.length !== b.length;
        return a !== b;
      }).length,
    [f]
  );

  // 모바일 필터 시트 — ESC 로 닫기
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileFiltersOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileFiltersOpen]);

  const download = () => {
    const blob = new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `screen_${baseDate}.csv`;
    a.click();
  };

  const toggleNews = (ticker: string, name: string) => {
    setNewsTicker((cur) => (cur === ticker ? null : ticker));
    if (newsCache[ticker]) return;

    setNewsCache((c) => ({ ...c, [ticker]: { status: "loading" } }));
    fetch(`/api/news?q=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((j) =>
        setNewsCache((c) => ({
          ...c,
          [ticker]: j.error
            ? { status: "error", msg: j.error }
            : { status: "done", items: (j.items ?? []).slice(0, 3) },
        }))
      )
      .catch((e) =>
        setNewsCache((c) => ({
          ...c,
          [ticker]: { status: "error", msg: String(e) },
        }))
      );
  };

  // 사이드바 본문 — 데스크톱 aside 와 모바일 전체화면 시트 양쪽에서 공유한다
  const filterPanel = (
    <>
      <Group label="시장">
          <div className="flex gap-1">
            {["ALL", "KOSPI", "KOSDAQ"].map((m) => (
              <button
                key={m}
                onClick={() => set("market", m)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                  f.market === m
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] text-[var(--fg-muted)] hover:border-[var(--line-strong)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Group>

        <Group label="규모 · 유동성">
          <Range
            label="시가총액 최소"
            unit="억"
            value={f.capMin}
            min={0}
            max={50000}
            step={500}
            onChange={(v) => set("capMin", v)}
          />
          <Range
            label="일 거래대금 최소"
            unit="억"
            value={f.valueMin}
            min={0}
            max={300}
            step={5}
            onChange={(v) => set("valueMin", v)}
          />
        </Group>

        <Group label="모멘텀">
          <Range
            label="1년 수익률 최소"
            unit="%"
            value={f.ret1yMin}
            min={-80}
            max={200}
            step={5}
            onChange={(v) => set("ret1yMin", v)}
          />
          <Range
            label="1개월 수익률 최대"
            unit="%"
            value={f.ret1mMax}
            min={-30}
            max={80}
            step={5}
            onChange={(v) => set("ret1mMax", v)}
            hint="낮출수록 '1년은 강했지만 최근 조정' 눌림목 구간"
          />
          <Check
            label="KOSPI 대비 초과수익만"
            checked={f.rsPositive}
            onChange={(v) => set("rsPositive", v)}
          />
        </Group>

        <Group label="밸류에이션">
          <Check
            label="적자기업 제외"
            checked={f.excludeLoss}
            onChange={(v) => set("excludeLoss", v)}
          />
          <Range
            label="PER 최대"
            value={f.perMax}
            min={1}
            max={100}
            step={1}
            onChange={(v) => set("perMax", v)}
          />
          <Range
            label="PBR 최대"
            value={f.pbrMax}
            min={0.5}
            max={20}
            step={0.5}
            onChange={(v) => set("pbrMax", v)}
          />
          <Range
            label="배당수익률 최소"
            unit="%"
            value={f.divMin}
            min={0}
            max={8}
            step={0.5}
            onChange={(v) => set("divMin", v)}
          />
        </Group>

        <Group label="랭킹 가중치">
          <Range
            label="모멘텀"
            unit="%"
            value={f.momentumWeight}
            min={0}
            max={100}
            step={10}
            onChange={(v) => set("momentumWeight", v)}
            hint={`밸류(저PER) ${100 - f.momentumWeight}%`}
          />
        </Group>

        <Group label={`업종 (${f.sectors.length || "전체"})`}>
          <select
            multiple
            size={6}
            value={f.sectors}
            onChange={(e) =>
              set(
                "sectors",
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
            className="w-full rounded-md border border-[var(--line)] p-1 text-xs"
          >
            {sectors.map((s) => (
              <option key={s} value={s} className="px-1 py-0.5">
                {s}
              </option>
            ))}
          </select>
          {f.sectors.length > 0 && (
            <button
              onClick={() => set("sectors", [])}
              className="text-xs text-[var(--fg-subtle)] hover:text-[var(--accent-fg)]"
            >
              업종 선택 해제
            </button>
          )}
        </Group>
    </>
  );

  return (
    <div className="flex gap-6">
      {/* 모바일 — 버튼으로 여는 전체화면 필터 시트 */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col lg:hidden"
          style={{ background: "var(--bg)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--line)" }}
          >
            <h2 className="text-sm font-semibold">스크리닝 조건</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setF(DEFAULT_FILTERS)}
                className="text-xs text-[var(--fg-subtle)] hover:text-[var(--accent-fg)]"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="필터 닫기"
                className="grid h-8 w-8 place-items-center rounded border text-[16px]"
                style={{ borderColor: "var(--line)", color: "var(--fg-muted)" }}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">{filterPanel}</div>
          <div className="border-t p-3" style={{ borderColor: "var(--line)" }}>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full rounded-md bg-[var(--accent)] py-2.5 text-sm font-semibold text-white"
            >
              {result.length.toLocaleString()}개 결과 보기
            </button>
          </div>
        </div>
      )}

      {/* ══════════ 사이드바 (lg 이상) ══════════ */}
      <aside className="hidden h-fit w-[280px] shrink-0 space-y-5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5 lg:sticky lg:top-[57px] lg:block">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">스크리닝 조건</h2>
          <button
            onClick={() => setF(DEFAULT_FILTERS)}
            className="text-xs text-[var(--fg-subtle)] hover:text-[var(--accent-fg)]"
          >
            초기화
          </button>
        </div>
        {filterPanel}
      </aside>

      {/* ══════════ 결과 ══════════ */}
      <section className="min-w-0 flex-1">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {result.length.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-[var(--fg-subtle)]">
                / {rows.length.toLocaleString()}종목
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">기준일 {baseDate}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs hover:border-[var(--line-strong)] lg:hidden"
            >
              필터{activeFilterCount > 0 && ` · ${activeFilterCount}`}
            </button>
            <button
              onClick={() => setShowFunnel((v) => !v)}
              className="rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-xs hover:border-[var(--line-strong)]"
            >
              퍼널 {showFunnel ? "닫기" : "보기"}
            </button>
            <button
              onClick={download}
              disabled={!result.length}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              CSV 다운로드
            </button>
          </div>
        </div>

        {(showFunnel || result.length === 0) && (
          <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
            <p className="mb-3 text-xs font-medium text-[var(--fg-muted)]">
              스크리닝 퍼널 — 어느 조건에서 많이 걸러지는지 확인하세요
            </p>
            <div className="space-y-1.5">
              {funnel.map((s, i) => {
                const prev = i > 0 ? funnel[i - 1].count : s.count;
                const drop = prev - s.count;
                return (
                  <div key={s.label} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 text-[var(--fg-muted)] lg:w-36">
                      {s.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--card-2)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{
                          width: `${(s.count / (funnel[0].count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="tabular w-14 text-right font-medium">
                      {s.count.toLocaleString()}
                    </span>
                    <span
                      className={`tabular w-16 text-right ${
                        drop > 0 ? "t-up" : "text-[var(--fg-subtle)]"
                      }`}
                    >
                      {drop > 0 ? `−${drop.toLocaleString()}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            {result.length === 0 && (
              <p className="mt-3 rounded-md bg-[var(--warn-bg)] p-2.5 text-xs text-[var(--warn-fg)]">
                조건이 너무 좁습니다. 감소폭(빨간 숫자)이 가장 큰 단계의 조건을
                완화해보세요.
              </p>
            )}
          </div>
        )}

        {result.length > 0 && (
          <>
            {/* 모바일 — 카드 리스트, 옆스크롤 없이 페이지 스크롤에 맡긴다 */}
            <div className="space-y-3 lg:hidden">
              {result.slice(0, 300).map((r) => (
                <ScreenerCard
                  key={r.ticker}
                  r={r}
                  isNewsOpen={newsTicker === r.ticker}
                  onToggleNews={() => toggleNews(r.ticker, r.name)}
                  newsEntry={newsCache[r.ticker]}
                />
              ))}
              {result.length > 300 && (
                <p className="text-center text-[12px] text-[var(--fg-subtle)]">
                  상위 300종목만 표시 · 전체 {result.length.toLocaleString()}
                  종목은 CSV로 받으세요
                </p>
              )}
            </div>

            {/* 데스크톱 — 기존 표 */}
            <div className="hidden overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] lg:block">
            <div className="max-h-[calc(100vh-220px)] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--card-2)] text-[12px] text-[var(--fg-subtle)]">
                  <tr className="border-b border-[var(--line)]">
                    <Th className="text-left">종목</Th>
                    <Th className="text-left">업종</Th>
                    <Th>현재가</Th>
                    <Th>시총(억)</Th>
                    <Th>1Y</Th>
                    <Th>6M</Th>
                    <Th>1M</Th>
                    <Th>RS</Th>
                    <Th>PER</Th>
                    <Th>PBR</Th>
                    <Th>EPS</Th>
                    <Th>BPS</Th>
                    <Th>배당</Th>
                    <Th>스코어</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.slice(0, 300).map((r) => (
                    <Fragment key={r.ticker}>
                      <tr className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--accent-bg)]/40">
                        <td className="px-3 py-2">
                          <a
                            href={naverFinanceUrl(r.ticker)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--fg)] hover:text-[var(--accent-fg)] hover:underline"
                          >
                            {r.name}
                          </a>
                          <span className="tabular ml-1.5 text-[12px] text-[var(--fg-subtle)]">
                            {r.ticker}
                          </span>
                          <button
                            onClick={() => toggleNews(r.ticker, r.name)}
                            className={`ml-1.5 rounded border px-1.5 py-0.5 text-[12px] transition ${
                              newsTicker === r.ticker
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--line)] text-[var(--fg-subtle)] hover:border-[var(--line-strong)]"
                            }`}
                          >
                            기사
                          </button>
                        </td>
                        <td className="max-w-[130px] truncate px-3 py-2 text-[var(--fg-subtle)]">
                          {r.sector ?? "-"}
                        </td>
                        <Td>{int(r.close)}</Td>
                        <Td>{eok(r.market_cap)}</Td>
                        <Td className={trend(r.ret_1y)}>{pct(r.ret_1y, true)}</Td>
                        <Td className={trend(r.ret_6m)}>{pct(r.ret_6m, true)}</Td>
                        <Td className={trend(r.ret_1m)}>{pct(r.ret_1m, true)}</Td>
                        <Td className={trend(r.rs_1y)}>{pct(r.rs_1y, true)}</Td>
                        <Td>{num(r.per, 1)}</Td>
                        <Td>{num(r.pbr)}</Td>
                        <Td>{int(r.eps)}</Td>
                        <Td>{int(r.bps)}</Td>
                        <Td>{divFmt(r.div)}</Td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-[var(--card-2)]">
                              <div
                                className="h-full bg-[var(--accent)]"
                                style={{ width: `${r.score}%` }}
                              />
                            </div>
                            <span className="tabular w-6 text-right font-semibold">
                              {r.score}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {newsTicker === r.ticker && (
                        <tr className="border-b border-[var(--line)] bg-[var(--card-2)] last:border-0">
                          <td colSpan={14} className="px-3 py-2.5">
                            <NewsRefs entry={newsCache[r.ticker]} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {result.length > 300 && (
              <p className="border-t border-[var(--line)] bg-[var(--card-2)] px-3 py-2 text-center text-[12px] text-[var(--fg-subtle)]">
                상위 300종목만 표시 · 전체 {result.length.toLocaleString()}종목은
                CSV로 받으세요
              </p>
            )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────── 작은 조각들 */

/** 모바일 전용 카드 — 표 한 행을 옆스크롤 없이 세로로 */
function ScreenerCard({
  r,
  isNewsOpen,
  onToggleNews,
  newsEntry,
}: {
  r: ScoredSnapshot;
  isNewsOpen: boolean;
  onToggleNews: () => void;
  newsEntry?: NewsState;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <a
            href={naverFinanceUrl(r.ticker)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] font-bold hover:text-[var(--accent-fg)] hover:underline"
          >
            {r.name}
          </a>
          <div className="mt-0.5 text-[12px] tabular text-[var(--fg-subtle)]">
            {r.ticker}
            {r.sector ? ` · ${r.sector}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-[var(--card-2)]">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${r.score}%` }} />
          </div>
          <span className="tabular w-6 text-right text-[13px] font-semibold">{r.score}</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-[var(--line)] pt-2">
        <StatRow label="현재가" value={int(r.close)} />
        <StatRow label="시총(억)" value={eok(r.market_cap)} />
        <StatRow label="1Y" value={pct(r.ret_1y, true)} valueClassName={trend(r.ret_1y)} />
        <StatRow label="6M" value={pct(r.ret_6m, true)} valueClassName={trend(r.ret_6m)} />
        <StatRow label="1M" value={pct(r.ret_1m, true)} valueClassName={trend(r.ret_1m)} />
        <StatRow label="RS" value={pct(r.rs_1y, true)} valueClassName={trend(r.rs_1y)} />
        <StatRow label="PER" value={num(r.per, 1)} />
        <StatRow label="PBR" value={num(r.pbr)} />
        <StatRow label="EPS" value={int(r.eps)} />
        <StatRow label="BPS" value={int(r.bps)} />
        <StatRow label="배당" value={divFmt(r.div)} />
      </div>

      <button
        type="button"
        onClick={onToggleNews}
        className={`mt-2 w-full rounded border px-2 py-1.5 text-[12px] transition ${
          isNewsOpen
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--line)] text-[var(--fg-subtle)] hover:border-[var(--line-strong)]"
        }`}
      >
        기사 {isNewsOpen ? "닫기" : "보기"}
      </button>
      {isNewsOpen && (
        <div className="mt-2 border-t border-[var(--line)] pt-2">
          <NewsRefs entry={newsEntry} />
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-t border-[var(--line)] pt-4 first-of-type:border-0 first-of-type:pt-0">
      <p className="text-[12px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs text-[var(--fg-muted)]">{label}</label>
        <span className="tabular text-xs font-medium">
          {value.toLocaleString()}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
      {hint && <p className="text-[12px] leading-tight text-[var(--fg-subtle)]">{hint}</p>}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--fg-muted)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 "
      />
      {label}
    </label>
  );
}

const Th = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <th className={`px-3 py-2 font-medium ${className || "text-right"}`}>
    {children}
  </th>
);

const Td = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <td className={`tabular px-3 py-2 text-right ${className}`}>{children}</td>
);

function NewsRefs({ entry }: { entry?: NewsState }) {
  if (!entry || entry.status === "loading")
    return <p className="text-[12px] text-[var(--fg-subtle)]">참조 기사 조회 중...</p>;

  if (entry.status === "error")
    return (
      <p className="text-[12px] text-[var(--fg-subtle)]">
        {entry.msg || "기사를 불러올 수 없습니다."}
      </p>
    );

  if (!entry.items?.length)
    return <p className="text-[12px] text-[var(--fg-subtle)]">관련 기사가 없습니다.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {entry.items.map((n, i) => (
        <a
          key={i}
          href={n.link}
          target="_blank"
          rel="noopener noreferrer"
          title={n.title}
          className="max-w-[340px] truncate rounded-md border border-[var(--line)] bg-[var(--card)] px-2.5 py-1 text-[12px] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-fg)]"
        >
          {n.title}
        </a>
      ))}
    </div>
  );
}
