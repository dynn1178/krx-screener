"use client";

import { useMemo, useState } from "react";
import { naverLink, type NewsRow } from "@/lib/reportTypes";

const SENTIMENT: Record<string, { label: string; cls: string }> = {
  positive: { label: "호재", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  negative: { label: "악재", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  neutral: { label: "중립", cls: "bg-neutral-100 text-neutral-600 border-neutral-200" },
};

const timeKo = (ts: string | null) => {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NewsList({ rows }: { rows: NewsRow[] }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "stock" | "market">("all");
  const [kw, setKw] = useState("전체");

  const keywords = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.theme_kw) s.add(r.theme_kw);
      if (r.issue_kw) s.add(r.issue_kw);
    });
    return ["전체", ...[...s].sort()];
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (scope === "stock" && r.is_market_wide) return false;
      if (scope === "market" && !r.is_market_wide) return false;
      if (kw !== "전체" && r.theme_kw !== kw && r.issue_kw !== kw) return false;
      if (!needle) return true;
      return [r.title, r.summary, r.press, ...r.stock_names]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(needle));
    });
  }, [rows, q, scope, kw]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목·요약·종목명 검색"
          className="h-8 w-60 rounded border border-[var(--line)] bg-white px-2.5 text-[12px] outline-none focus:border-teal-600"
        />
        <div className="inline-flex rounded border border-[var(--line)] bg-white p-0.5">
          {(
            [
              ["all", "전체"],
              ["stock", "종목"],
              ["market", "시장"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={`rounded px-2.5 py-1 text-[12px] font-medium transition ${
                scope === k
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          className="h-8 rounded border border-[var(--line)] bg-white px-2 text-[12px]"
          aria-label="키워드 필터"
        >
          {keywords.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-neutral-400 tabular">
          {shown.length} / {rows.length}건
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-center text-sm text-neutral-500">
          조건에 맞는 기사가 없습니다.
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((n) => {
            const s = n.sentiment ? SENTIMENT[n.sentiment] : null;
            const when = timeKo(n.published_at);
            return (
              <article
                key={n.id}
                className="flex flex-col rounded-lg border border-[var(--line)] bg-[var(--card)] p-3"
              >
                <div className="flex flex-wrap items-center gap-1">
                  {s && (
                    <span
                      className={`rounded border px-1.5 py-px text-[10px] font-medium ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  )}
                  {n.theme_kw && (
                    <span className="rounded bg-sky-50 px-1.5 py-px text-[10px] text-sky-700">
                      {n.theme_kw}
                    </span>
                  )}
                  {n.issue_kw && (
                    <span className="rounded bg-orange-50 px-1.5 py-px text-[10px] text-orange-700">
                      {n.issue_kw}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-neutral-400 tabular">
                    {[n.press, when].filter(Boolean).join(" · ")}
                  </span>
                </div>

                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 text-[13px] font-bold leading-snug text-neutral-900 hover:text-teal-700 hover:underline"
                >
                  {n.title}
                </a>

                {n.summary && (
                  <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-neutral-600">
                    {n.summary}
                  </p>
                )}

                {n.stock_names.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-[var(--line)] pt-2">
                    {n.stock_names.map((name, i) => {
                      const code = n.tickers[i];
                      return code ? (
                        <a
                          key={`${name}-${i}`}
                          href={naverLink(code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 hover:text-teal-700"
                        >
                          {name}
                        </a>
                      ) : (
                        <span
                          key={`${name}-${i}`}
                          className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-500"
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
