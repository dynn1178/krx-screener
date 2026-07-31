import { pct2, trend } from "@/lib/format";
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
    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
      <h3 className="text-[12px] font-bold text-teal-800">{title}</h3>
      <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.75] text-neutral-700">
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
    <section className="space-y-2">
      <h2 className="text-[15px] font-bold tracking-tight">서술형 시황</h2>
      <div className="grid gap-2 lg:grid-cols-2">
        <Section title="시장 개요" body={c.overview} />
        <Section title="투자주체 동향" body={c.investorFlow} />
        <Section title="추가 인사이트" body={c.additionalInsight} />
      </div>

      {c.insights.length > 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
          <h3 className="text-[12px] font-bold text-teal-800">
            추가 인사이트
          </h3>
          <ul className="mt-1.5 space-y-1">
            {c.insights.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] leading-relaxed text-neutral-700"
              >
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal-600" />
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
 * 5번 — 테마·섹터 변동폭과 인사이트를 한 패널에서 같이 본다.
 * 업종은 2열 바 차트, 그 아래 서술형 테마 분석을 붙인다.
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
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[15px] font-bold tracking-tight">테마 · 섹터 분석</h2>
        {best && worst && best.sector !== worst.sector && (
          <span className="text-[11px] tabular text-neutral-500">
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

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)]">
        {rows.length > 0 && (
          <div className="grid gap-x-6 gap-y-1 p-4 md:grid-cols-2">
            {rows.map((r) => {
              const w = (Math.abs(r.avg_change_pct) / max) * 100;
              const up = r.avg_change_pct >= 0;
              return (
                <div
                  key={r.sector}
                  className="relative overflow-hidden rounded border border-[var(--line)] px-3 py-2"
                >
                  {/* 변동폭을 배경 막대로 */}
                  <span
                    className={`absolute inset-y-0 left-0 ${up ? "bg-rose-50" : "bg-blue-50"}`}
                    style={{ width: `${w}%` }}
                  />
                  <div className="relative flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-bold text-neutral-800">
                      {r.sector}
                    </span>
                    <span
                      className={`shrink-0 text-[12px] font-bold tabular ${trend(r.avg_change_pct)}`}
                    >
                      {pct2(r.avg_change_pct)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {analysis && (
          <div
            className={`bg-neutral-50/70 px-4 py-3 text-[12px] leading-[1.75] text-neutral-700 ${
              rows.length ? "border-t border-[var(--line)]" : ""
            }`}
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

  const kindClass = (k?: string) =>
    k === "positive"
      ? "border-rose-200 bg-rose-50/60"
      : k === "negative"
        ? "border-blue-200 bg-blue-50/60"
        : "border-[var(--line)] bg-white";

  return (
    <section className="space-y-2">
      <h2 className="text-[15px] font-bold tracking-tight">데일리 브리핑</h2>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        {brief.title && (
          <p className="text-[14px] font-bold leading-snug">{brief.title}</p>
        )}
        {brief.summary && (
          <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.75] text-neutral-700">
            {brief.summary}
          </p>
        )}

        {brief.highlights.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {brief.highlights.map((h, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 ${kindClass(h.kind)}`}
              >
                <div className="text-[12px] font-semibold">{h.label}</div>
                {h.detail && (
                  <div className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">
                    {h.detail}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {brief.watch_next.length > 0 && (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <div className="text-[11px] font-bold text-neutral-500">
              다음 거래일 관전 포인트
            </div>
            <ul className="mt-1 space-y-1">
              {brief.watch_next.map((w, i) => (
                <li key={i} className="text-[12px] text-neutral-700">
                  · {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-3">
            {brief.sources.map((s, i) =>
              s.url ? (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-50"
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
