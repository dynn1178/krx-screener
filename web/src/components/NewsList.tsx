"use client";

import { useMemo, useState } from "react";
import { naverLink, type NewsRow } from "@/lib/reportTypes";

const SENTIMENT: Record<string, { label: string; cls: string }> = {
  positive: { label: "호재", cls: "border-[var(--up)] bg-[var(--up-bg)] t-up" },
  negative: { label: "악재", cls: "border-[var(--down)] bg-[var(--down-bg)] t-down" },
  neutral: { label: "중립", cls: "bg-[var(--card-2)] text-[var(--fg-muted)] border-[var(--line)]" },
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
          className="h-8 w-full rounded border border-[var(--line)] bg-[var(--card)] px-2.5 text-[13px] outline-none focus:border-[var(--accent)] sm:w-60"
        />
        <div className="inline-flex rounded border border-[var(--line)] bg-[var(--card)] p-0.5">
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
              className={`rounded px-2.5 py-1 text-[13px] font-medium transition ${
                scope === k
                  ? "bg-[var(--fg)] text-[var(--bg)]"
                  : "text-[var(--fg-subtle)] hover:text-[var(--fg)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          className="h-8 rounded border border-[var(--line)] bg-[var(--card)] px-2 text-[13px]"
          aria-label="키워드 필터"
        >
          {keywords.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-[var(--fg-subtle)] tabular">
          {shown.length} / {rows.length}건
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-6 text-center text-sm text-[var(--fg-subtle)]">
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
                      className={`rounded border px-1.5 py-px text-[12px] font-medium ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  )}
                  {n.theme_kw && (
                    <span className="rounded bg-[var(--accent-bg)] px-1.5 py-px text-[12px] text-[var(--accent-fg)]">
                      {n.theme_kw}
                    </span>
                  )}
                  {n.issue_kw && (
                    <span className="rounded bg-[var(--warn-bg)] px-1.5 py-px text-[12px] text-[var(--warn-fg)]">
                      {n.issue_kw}
                    </span>
                  )}
                  <span className="ml-auto text-[12px] text-[var(--fg-subtle)] tabular">
                    {[n.press, when].filter(Boolean).join(" · ")}
                  </span>
                </div>

                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 text-[14px] font-bold leading-snug text-[var(--fg)] hover:text-[var(--accent-fg)] hover:underline"
                >
                  {n.title}
                </a>

                {n.summary && (
                  <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--fg-muted)]">
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
                          className="rounded bg-[var(--card-2)] px-1.5 py-0.5 text-[12px] text-[var(--fg-muted)] hover:bg-[var(--card-2)] hover:text-[var(--accent-fg)]"
                        >
                          {name}
                        </a>
                      ) : (
                        <span
                          key={`${name}-${i}`}
                          className="rounded bg-[var(--card-2)] px-1.5 py-0.5 text-[12px] text-[var(--fg-subtle)]"
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
