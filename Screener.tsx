"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { eok, int, num, pct, trend } from "@/lib/format";
import { screen, toCsv } from "@/lib/screen";
import { DEFAULT_FILTERS, type Filters, type Snapshot } from "@/lib/types";

type Props = { rows: Snapshot[]; sectors: string[]; baseDate: string };

export default function Screener({ rows, sectors, baseDate }: Props) {
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [showFunnel, setShowFunnel] = useState(false);

  const { rows: result, funnel } = useMemo(() => screen(rows, f), [rows, f]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const download = () => {
    const blob = new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `screen_${baseDate}.csv`;
    a.click();
  };

  return (
    <div className="flex gap-6">
      {/* ══════════ 사이드바 ══════════ */}
      <aside className="sticky top-[57px] h-fit w-[280px] shrink-0 space-y-5 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">스크리닝 조건</h2>
          <button
            onClick={() => setF(DEFAULT_FILTERS)}
            className="text-xs text-neutral-500 hover:text-teal-700"
          >
            초기화
          </button>
        </div>

        <Group label="시장">
          <div className="flex gap-1">
            {["ALL", "KOSPI", "KOSDAQ"].map((m) => (
              <button
                key={m}
                onClick={() => set("market", m)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                  f.market === m
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-[var(--line)] text-neutral-600 hover:border-neutral-400"
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
              className="text-xs text-neutral-500 hover:text-teal-700"
            >
              업종 선택 해제
            </button>
          )}
        </Group>
      </aside>

      {/* ══════════ 결과 ══════════ */}
      <section className="min-w-0 flex-1">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {result.length.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-neutral-500">
                / {rows.length.toLocaleString()}종목
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">기준일 {baseDate}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFunnel((v) => !v)}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs hover:border-neutral-400"
            >
              퍼널 {showFunnel ? "닫기" : "보기"}
            </button>
            <button
              onClick={download}
              disabled={!result.length}
              className="rounded-md bg-teal-700 px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              CSV 다운로드
            </button>
          </div>
        </div>

        {(showFunnel || result.length === 0) && (
          <div className="mb-4 rounded-lg border border-[var(--line)] bg-white p-4">
            <p className="mb-3 text-xs font-medium text-neutral-600">
              스크리닝 퍼널 — 어느 조건에서 많이 걸러지는지 확인하세요
            </p>
            <div className="space-y-1.5">
              {funnel.map((s, i) => {
                const prev = i > 0 ? funnel[i - 1].count : s.count;
                const drop = prev - s.count;
                return (
                  <div key={s.label} className="flex items-center gap-3 text-xs">
                    <span className="w-36 shrink-0 text-neutral-600">
                      {s.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all"
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
                        drop > 0 ? "text-rose-500" : "text-neutral-300"
                      }`}
                    >
                      {drop > 0 ? `−${drop.toLocaleString()}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
            {result.length === 0 && (
              <p className="mt-3 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800">
                조건이 너무 좁습니다. 감소폭(빨간 숫자)이 가장 큰 단계의 조건을
                완화해보세요.
              </p>
            )}
          </div>
        )}

        {result.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            <div className="max-h-[calc(100vh-220px)] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-neutral-50 text-[11px] text-neutral-500">
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
                    <tr
                      key={r.ticker}
                      className="border-b border-neutral-100 last:border-0 hover:bg-teal-50/40"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/stock/${r.ticker}`}
                          className="font-medium text-neutral-900 hover:text-teal-700 hover:underline"
                        >
                          {r.name}
                        </Link>
                        <span className="tabular ml-1.5 text-[10px] text-neutral-400">
                          {r.ticker}
                        </span>
                      </td>
                      <td className="max-w-[130px] truncate px-3 py-2 text-neutral-500">
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
                      <Td>{num(r.div)}</Td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full bg-teal-600"
                              style={{ width: `${r.score}%` }}
                            />
                          </div>
                          <span className="tabular w-6 text-right font-semibold">
                            {r.score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.length > 300 && (
              <p className="border-t border-[var(--line)] bg-neutral-50 px-3 py-2 text-center text-[11px] text-neutral-500">
                상위 300종목만 표시 · 전체 {result.length.toLocaleString()}종목은
                CSV로 받으세요
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────── 작은 조각들 */
function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-t border-[var(--line)] pt-4 first-of-type:border-0 first-of-type:pt-0">
      <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
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
        <label className="text-xs text-neutral-600">{label}</label>
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
      {hint && <p className="text-[10px] leading-tight text-neutral-400">{hint}</p>}
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
    <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-teal-700"
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
