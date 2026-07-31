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
  const any =
    c.overview || c.investorFlow || c.themeAnalysis || c.additionalInsight;
  if (!any && !c.insights.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-[15px] font-bold tracking-tight">서술형 시황</h2>
      <div className="grid gap-2 lg:grid-cols-2">
        <Section title="시장 개요" body={c.overview} />
        <Section title="투자주체 동향" body={c.investorFlow} />
        <Section title="테마 · 섹터 분석" body={c.themeAnalysis} />
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

export function SectorBars({ rows }: { rows: SectorPerf[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.avg_change_pct)), 1);

  return (
    <section className="space-y-2">
      <h2 className="text-[15px] font-bold tracking-tight">업종별 등락</h2>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="space-y-1.5">
          {rows.map((r) => {
            const w = (Math.abs(r.avg_change_pct) / max) * 50;
            const up = r.avg_change_pct >= 0;
            return (
              <div key={r.sector} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 truncate text-neutral-600">
                  {r.sector}
                </span>
                <div className="relative h-3.5 flex-1">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-200" />
                  <div
                    className={`absolute inset-y-0 rounded-sm ${
                      up ? "bg-rose-500/80" : "bg-blue-500/80"
                    }`}
                    style={
                      up
                        ? { left: "50%", width: `${w}%` }
                        : { right: "50%", width: `${w}%` }
                    }
                  />
                </div>
                <span
                  className={`w-14 shrink-0 text-right font-semibold tabular ${trend(
                    r.avg_change_pct
                  )}`}
                >
                  {pct2(r.avg_change_pct)}
                </span>
              </div>
            );
          })}
        </div>
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
