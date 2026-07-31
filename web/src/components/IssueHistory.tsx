import Link from "next/link";
import { dateKo } from "@/lib/format";
import type { AnalysisHistory } from "@/lib/reportTypes";

/**
 * 이 종목이 언제 왜 움직였는지 — stock_analysis 누적 기록을 시간순으로.
 * 같은 이슈가 반복되는지, 테마가 바뀌었는지를 한눈에 본다.
 */
export default function IssueHistory({
  rows,
  name,
}: {
  rows: AnalysisHistory[];
  name: string;
}) {
  if (!rows.length) return null;

  const themes = [...new Set(rows.map((r) => r.theme_kw).filter(Boolean))];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight">이슈 히스토리</h2>
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          {name}이(가) 스크리닝에 잡힌 {rows.length}거래일
        </span>
        {themes.length > 0 && (
          <span className="ml-auto text-[13px]" style={{ color: "var(--fg-subtle)" }}>
            테마 {themes.join(" · ")}
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.base_date}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--line)", background: "var(--card)" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/?date=${r.base_date}`}
                className="text-[14px] font-bold tabular hover:underline"
              >
                {dateKo(r.base_date)}
              </Link>
              {r.industry_kw && (
                <span
                  className="rounded px-2 py-0.5 text-[12px] font-semibold"
                  style={{ background: "var(--card-2)", color: "var(--fg-muted)" }}
                >
                  {r.industry_kw}
                </span>
              )}
              {r.theme_kw && (
                <span
                  className="rounded px-2 py-0.5 text-[12px] font-semibold"
                  style={{ background: "var(--accent-bg)", color: "var(--accent-fg)" }}
                >
                  {r.theme_kw}
                </span>
              )}
              {r.issue_kw && (
                <span
                  className="rounded px-2 py-0.5 text-[12px] font-semibold"
                  style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
                >
                  {r.issue_kw}
                </span>
              )}
            </div>

            {r.issue_note && (
              <p
                className="mt-2 text-[14px] leading-relaxed"
                style={{ color: "var(--fg-muted)" }}
              >
                {r.issue_note}
              </p>
            )}

            {r.related && (
              <p className="mt-1.5 text-[12px]" style={{ color: "var(--fg-subtle)" }}>
                관련 · {r.related}
              </p>
            )}

            {r.refs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.refs.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border px-2 py-0.5 text-[12px] hover:underline"
                    style={{ borderColor: "var(--line)", color: "var(--fg-subtle)" }}
                  >
                    📰 {a.title ?? `기사 ${i + 1}`}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
