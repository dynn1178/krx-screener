import { pct2, trend, trendVar } from "@/lib/format";
import type { Commentary as C, SectorPerf, DailyBrief } from "@/lib/reportTypes";

function Section({
  title,
  body,
}: {
  title: string;
  body: string | null | undefined;
}) {
  if (!body) return null;
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
    >
      <h3
        className="text-[14px] font-bold"
        style={{ color: "var(--accent-fg)" }}
      >
        {title}
      </h3>
      <p
        className="mt-2 whitespace-pre-line text-[14px] leading-[1.8]"
        style={{ color: "var(--fg-muted)" }}
      >
        {body}
      </p>
    </div>
  );
}

export function CommentarySections({ c }: { c: C | null }) {
  if (!c) return null;
  // 테마·섹터 분석은 SectorPanel 에서 업종 등락과 함께 보여주므로 여기선 뺀다
  const any = c.overview || c.investorFlow || c.additionalInsight;
  if (!any && !c.insights.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-bold tracking-tight">서술형 시황</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="시장 개요" body={c.overview} />
        <Section title="투자주체 동향" body={c.investorFlow} />
        <Section title="추가 인사이트" body={c.additionalInsight} />
      </div>

      {c.insights.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--line)", background: "var(--card)" }}
        >
          <h3
            className="text-[14px] font-bold"
            style={{ color: "var(--accent-fg)" }}
          >
            추가 인사이트
          </h3>
          <ul className="mt-2 space-y-1.5">
            {c.insights.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-[14px] leading-relaxed"
                style={{ color: "var(--fg-muted)" }}
              >
                <span
                  className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * 7번 — 섹터별 등락을 막대그래프로.
 * 0을 중앙에 둔 양방향 막대라 상승/하락 폭을 한눈에 비교할 수 있다.
 */
export function SectorPanel({
  rows,
  analysis,
}: {
  rows: SectorPerf[];
  analysis?: string | null;
}) {
  if (!rows.length && !analysis) return null;

  const max = Math.max(...rows.map((r) => Math.abs(r.avg_change_pct)), 1);
  const best = rows.length ? rows[0] : null;
  const worst = rows.length ? rows[rows.length - 1] : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight">테마 · 섹터 분석</h2>
        {best && worst && best.sector !== worst.sector && (
          <span className="text-[13px] tabular" style={{ color: "var(--fg-muted)" }}>
            최강{" "}
            <strong className={trend(best.avg_change_pct)}>
              {best.sector} {pct2(best.avg_change_pct)}
            </strong>{" "}
            · 최약{" "}
            <strong className={trend(worst.avg_change_pct)}>
              {worst.sector} {pct2(worst.avg_change_pct)}
            </strong>
          </span>
        )}
      </div>

      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        {rows.length > 0 && (
          <div className="p-4">
            <div className="space-y-2.5">
              {rows.map((r) => {
                const w = (Math.abs(r.avg_change_pct) / max) * 50;
                const up = r.avg_change_pct >= 0;
                return (
                  <div key={r.sector} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-right text-[14px] font-semibold">
                      {r.sector}
                    </span>

                    {/* 0 기준 양방향 막대 */}
                    <div className="relative h-6 flex-1">
                      <div
                        className="absolute inset-y-0 left-1/2 w-px"
                        style={{ background: "var(--line-strong)" }}
                      />
                      <div
                        className="absolute inset-y-1 rounded"
                        style={{
                          background: trendVar(r.avg_change_pct),
                          ...(up
                            ? { left: "50%", width: `${w}%` }
                            : { right: "50%", width: `${w}%` }),
                        }}
                      />
                    </div>

                    <span
                      className={`w-20 shrink-0 text-right text-[14px] font-bold tabular ${trend(r.avg_change_pct)}`}
                    >
                      {pct2(r.avg_change_pct)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className="mt-3 flex justify-between border-t pt-2 text-[11px]"
              style={{ borderColor: "var(--line)", color: "var(--fg-subtle)" }}
            >
              <span>← 하락</span>
              <span>0%</span>
              <span>상승 →</span>
            </div>
          </div>
        )}

        {analysis && (
          <div
            className="px-4 py-3 text-[14px] leading-[1.8]"
            style={{
              background: "var(--card-2)",
              color: "var(--fg-muted)",
              borderTop: rows.length ? "1px solid var(--line)" : undefined,
            }}
          >
            {analysis}
          </div>
        )}
      </div>
    </section>
  );
}

export function BriefPanel({ brief }: { brief: DailyBrief | null }) {
  if (!brief) return null;
  const has =
    brief.title ||
    brief.summary ||
    brief.highlights.length ||
    brief.watch_next.length;
  if (!has) return null;

  const kindStyle = (k?: string): React.CSSProperties =>
    k === "positive"
      ? { borderColor: "var(--up)", background: "var(--up-bg)" }
      : k === "negative"
        ? { borderColor: "var(--down)", background: "var(--down-bg)" }
        : { borderColor: "var(--line)", background: "var(--card-2)" };

  return (
    <section className="space-y-3">
      <h2 className="text-[17px] font-bold tracking-tight">데일리 브리핑</h2>
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        {brief.title && (
          <p className="text-[16px] font-bold leading-snug">{brief.title}</p>
        )}
        {brief.summary && (
          <p
            className="mt-2 whitespace-pre-line text-[14px] leading-[1.8]"
            style={{ color: "var(--fg-muted)" }}
          >
            {brief.summary}
          </p>
        )}

        {brief.highlights.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {brief.highlights.map((h, i) => (
              <div
                key={i}
                className="rounded-lg border px-3 py-2"
                style={kindStyle(h.kind)}
              >
                <div className="text-[14px] font-bold">{h.label}</div>
                {h.detail && (
                  <div
                    className="mt-0.5 text-[13px] leading-relaxed"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {h.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {brief.watch_next.length > 0 && (
          <div
            className="mt-3 border-t pt-3"
            style={{ borderColor: "var(--line)" }}
          >
            <div
              className="text-[13px] font-bold"
              style={{ color: "var(--fg-subtle)" }}
            >
              다음 거래일 관전 포인트
            </div>
            <ul className="mt-1 space-y-1">
              {brief.watch_next.map((w, i) => (
                <li
                  key={i}
                  className="text-[14px]"
                  style={{ color: "var(--fg-muted)" }}
                >
                  · {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.sources.length > 0 && (
          <div
            className="mt-3 flex flex-wrap gap-1.5 border-t pt-3"
            style={{ borderColor: "var(--line)" }}
          >
            {brief.sources.map((s, i) =>
              s.url ? (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border px-2 py-0.5 text-[12px] hover:underline"
                  style={{
                    borderColor: "var(--line)",
                    color: "var(--fg-muted)",
                  }}
                >
                  {s.title ?? "기사"}
                  {s.date ? ` (${s.date})` : ""}
                </a>
              ) : null
            )}
          </div>
        )}
      </div>
    </section>
  );
}
