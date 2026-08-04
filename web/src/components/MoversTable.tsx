"use client";

import { useMemo, useState } from "react";
import {
  wonShort,
  wonFull,
  pct2,
  trend,
  int,
  num,
  marketCapShort,
  perFmt,
  epsFmt,
} from "@/lib/format";
import { naverLink, type ReportRow } from "@/lib/reportTypes";

const CATEGORIES = ["전체", "급등주", "급락주", "6%이상변동", "거래대금상위"] as const;

/** 구분값은 daily_movers 뷰가 만들므로 라벨이 하나로 통일돼 있다 */
const matches = (category: string | null, cat: string) =>
  !!category && category.includes(cat);

/** 구분값 뱃지 색 — CSS 변수 기반이라 다크모드에서도 대비가 유지된다 */
function catStyle(c: string): React.CSSProperties {
  if (c.includes("급등"))
    return { background: "var(--up-bg)", color: "var(--up)" };
  if (c.includes("급락"))
    return { background: "var(--down-bg)", color: "var(--down)" };
  if (c.includes("변동"))
    return { background: "var(--warn-bg)", color: "var(--warn-fg)" };
  // 거래대금상위
  return { background: "var(--accent-bg)", color: "var(--accent-fg)" };
}

const SORTS = [
  { key: "value", label: "거래대금순" },
  { key: "change", label: "등락률순" },
  { key: "swing", label: "변동폭순" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const signedInt = (v: number | null) =>
  v == null
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(Math.round(v)).toLocaleString("ko-KR")}`;

function NetBuy({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: "var(--fg-subtle)" }}>—</span>;
  return (
    <span className={trend(v)} title={wonFull(v)}>
      {v > 0 ? "+" : ""}
      {wonShort(v)}
    </span>
  );
}

function Chip({
  text,
  tone,
}: {
  text: string;
  tone: "industry" | "theme" | "issue";
}) {
  const style: React.CSSProperties =
    tone === "industry"
      ? { background: "var(--card-2)", color: "var(--fg-muted)" }
      : tone === "theme"
        ? { background: "var(--accent-bg)", color: "var(--accent-fg)" }
        : { background: "var(--warn-bg)", color: "var(--warn-fg)" };
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-2 py-0.5 text-[12px] font-semibold"
      style={style}
    >
      {text}
    </span>
  );
}

/** 관련 종목 — 쉼표로 나열된 원문을 개별 뱃지로 부각해서 보여준다 */
function RelatedChips({ text }: { text: string }) {
  const names = text
    .split(/[,、·]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span
        className="text-[12px] font-semibold"
        style={{ color: "var(--fg-subtle)" }}
      >
        관련
      </span>
      {names.map((n, i) => (
        <span
          key={i}
          className="inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-bold"
          style={{
            borderColor: "var(--accent)",
            background: "var(--accent-bg)",
            color: "var(--accent-fg)",
          }}
        >
          {n}
        </span>
      ))}
    </div>
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
  const [sort, setSort] = useState<SortKey>("value");
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
      value: (a, b) => (b.tradeValue ?? -1) - (a.tradeValue ?? -1),
      change: (a, b) => (b.changeRate ?? -Infinity) - (a.changeRate ?? -Infinity),
      swing: (a, b) => (b.swingPct ?? -Infinity) - (a.swingPct ?? -Infinity),
    };
    return [...out].sort(by[sort]);
  }, [rows, cat, sort, q]);

  if (!rows.length) {
    return (
      <section className="space-y-2">
        <h2 className="text-[17px] font-bold tracking-tight">종목 스크리닝</h2>
        <p
          className="rounded-lg border p-4 text-[14px]"
          style={{
            borderColor: "var(--warn-line)",
            background: "var(--warn-bg)",
            color: "var(--warn-fg)",
          }}
        >
          {baseDate} 기준으로 스크리닝 조건(급등 +15% 이상 / 급락 -10% 이하 /
          장중 변동폭 6% 이상 / 거래대금 500억원 이상)을 충족한 종목이 없거나,
          해당 일자의 시세·분석 데이터가 아직 적재되지 않았습니다.
        </p>
      </section>
    );
  }

  const th = "px-3 py-2.5 text-[13px] font-semibold";

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[17px] font-bold tracking-tight">
          종목 스크리닝 — 총 {rows.length}종목
        </h2>
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          {baseDate} 기준
        </span>
      </div>

      {/* 카테고리 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const active = cat === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className="rounded-lg border px-3 py-1.5 text-[14px] font-semibold transition"
              style={
                active
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--accent)",
                      color: "#fff",
                    }
                  : {
                      borderColor: "var(--line)",
                      background: "var(--card)",
                      color: "var(--fg-muted)",
                    }
              }
            >
              {c}
              <span className="ml-1.5 opacity-70">{counts[c] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="종목명·코드·키워드 검색"
          className="h-9 w-64 rounded-lg border px-3 text-[14px] outline-none"
          style={{ borderColor: "var(--line)" }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-lg border px-2 text-[14px]"
          style={{ borderColor: "var(--line)" }}
          aria-label="정렬"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-[13px] tabular" style={{ color: "var(--fg-subtle)" }}>
          {shown.length} / {rows.length}종목
        </span>
      </div>

      <div
        className="max-h-[75vh] overflow-auto rounded-xl border"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        <table className="w-full min-w-[1500px] border-collapse text-[14px]">
          <thead className="sticky top-0 z-10">
            <tr
              className="border-b text-left"
              style={{
                borderColor: "var(--line)",
                background: "var(--card-2)",
                color: "var(--fg-muted)",
              }}
            >
              <th className={`${th} text-left`}>종목</th>
              <th className={`${th} text-right`}>시가~종가</th>
              <th className={`${th} text-right`}>장중 저가~고가</th>
              <th className={`${th} text-right`}>증감가</th>
              <th className={`${th} text-right`}>등락률</th>
              <th className={`${th} text-right`}>거래대금</th>
              <th className={`${th} text-right`}>시가총액</th>
              <th className={`${th} text-right`}>PER</th>
              <th className={`${th} text-right`}>PBR</th>
              <th className={`${th} text-right`}>EPS</th>
              <th className={`${th} text-left`}>구분값</th>
              <th className={`${th} text-left`}>산업 · 테마 · 이슈</th>
              <th className={`${th} text-left`}>상승/하락 이슈</th>
              <th className={`${th} text-right`}>외국인</th>
              <th className={`${th} text-right`}>기관</th>
              <th className={`${th} text-right`}>개인</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const cats = (r.category ?? "").split(" / ").filter(Boolean);
              return (
                <tr
                  key={r.ticker}
                  className="border-b align-top"
                  style={{ borderColor: "var(--line)" }}
                >
                  {/* 종목명 + 코드를 한 칸에 세로로 */}
                  <td className="px-3 py-3">
                    <a
                      href={naverLink(r.ticker)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="네이버 증권에서 보기"
                      className="text-[15px] font-bold hover:underline"
                    >
                      {r.name}
                    </a>
                    <div
                      className="mt-0.5 text-[12px] tabular"
                      style={{ color: "var(--fg-subtle)" }}
                    >
                      {r.ticker}
                      {r.market ? ` · ${r.market}` : ""}
                    </div>
                  </td>

                  <td
                    className="px-3 py-3 text-right tabular"
                    title={`시가 ${int(r.open)} · 종가 ${int(r.close)}`}
                  >
                    <span style={{ color: "var(--fg-muted)" }}>{int(r.open)}</span>
                    <span className="mx-1" style={{ color: "var(--fg-subtle)" }}>~</span>
                    <span className="font-bold">{int(r.close)}</span>
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular"
                    title={`장중 저가 ${int(r.low)} · 장중 고가 ${int(r.high)}`}
                  >
                    <span className="t-down">{int(r.low)}</span>
                    <span className="mx-1" style={{ color: "var(--fg-subtle)" }}>~</span>
                    <span className="t-up">{int(r.high)}</span>
                  </td>
                  <td className={`px-3 py-3 text-right tabular ${trend(r.changePrice)}`}>
                    {signedInt(r.changePrice)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right text-[15px] font-bold tabular ${trend(r.changeRate)}`}
                  >
                    {pct2(r.changeRate)}
                  </td>
                  <td className="px-3 py-3 text-right tabular" title={wonFull(r.tradeValue)}>
                    {wonShort(r.tradeValue)}
                    {r.swingPct != null && (
                      <div
                        className="text-[12px]"
                        style={{ color: "var(--fg-subtle)" }}
                      >
                        변동폭 {r.swingPct.toFixed(2)}%
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular" title={wonFull(r.marketCap)}>
                    {marketCapShort(r.marketCap)}
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    {perFmt(r.per, r.eps)}
                  </td>
                  <td className="px-3 py-3 text-right tabular">{num(r.pbr)}</td>
                  <td className="px-3 py-3 text-right tabular">
                    {epsFmt(r.eps, r.per)}
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      {cats.length ? (
                        cats.map((c) => (
                          <span
                            key={c}
                            className="whitespace-nowrap rounded px-2 py-0.5 text-center text-[12px] font-semibold"
                            style={catStyle(c)}
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "var(--fg-subtle)" }}>—</span>
                      )}
                    </div>
                  </td>

                  {/* 산업/테마/이슈를 한 칸에 모아 컬럼 수를 줄인다 */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {r.industryKw && <Chip text={r.industryKw} tone="industry" />}
                      {r.themeKw && <Chip text={r.themeKw} tone="theme" />}
                      {r.issueKw && <Chip text={r.issueKw} tone="issue" />}
                      {!r.industryKw && !r.themeKw && !r.issueKw && (
                        <span style={{ color: "var(--fg-subtle)" }}>—</span>
                      )}
                    </div>
                  </td>

                  <td className="min-w-[340px] px-3 py-3">
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {r.issueNote ?? (
                        <span style={{ color: "var(--fg-subtle)" }}>—</span>
                      )}
                    </p>
                    {r.related && <RelatedChips text={r.related} />}
                    {r.refs.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.refs.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border px-1.5 py-0.5 text-[11px] hover:underline"
                            style={{
                              borderColor: "var(--line)",
                              color: "var(--fg-subtle)",
                            }}
                          >
                            📰 {a.title ?? `기사 ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right tabular">
                    <NetBuy v={r.foreignNetBuy} />
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    <NetBuy v={r.instNetBuy} />
                  </td>
                  <td className="px-3 py-3 text-right tabular">
                    <NetBuy v={r.indivNetBuy} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--fg-subtle)" }}
      >
        분류 기준 — 급등주: 전일 대비 +15% 이상 · 급락주: -10% 이하 ·
        6%이상변동: 당일 고가/저가 변동폭 6% 이상 · 거래대금상위: 500억원 이상.
        각 카테고리 상위 20종목을 뽑아 합친 결과이며, 여러 조건에 걸린 종목은
        구분값에 모두 표기했습니다. 거래대금·순매수는 원 단위 정수이며 표기만
        축약했습니다(마우스를 올리면 원 단위 전체값). 종목명을 누르면 네이버
        증권으로 이동합니다.
      </p>
    </section>
  );
}
