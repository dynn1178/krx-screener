import { GUIDE_SECTIONS, type Relation } from "@/lib/guideContent";
import { macroValue, unitSuffix, signed, pct2, trend } from "@/lib/format";
import type { MacroCard } from "@/lib/reportTypes";

function LiveChip({ card }: { card: MacroCard }) {
  return (
    <span
      title={card.desc ?? card.name}
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] tabular"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
    >
      <span className="font-semibold" style={{ color: "var(--fg-muted)" }}>
        {card.name}
      </span>
      <span className="font-bold">
        {macroValue(card.value, card.unit)}
        {unitSuffix(card.unit) || card.unit}
      </span>
      {card.change != null && (
        <span className={`font-semibold ${trend(card.change)}`}>
          {signed(card.change, card.unit === "십억원" ? 0 : 2)}
          {card.changePct != null ? ` (${pct2(card.changePct)})` : ""}
        </span>
      )}
    </span>
  );
}

function RelationRow({ r }: { r: Relation }) {
  const arrowClass =
    r.dir === "up" ? "t-up" : r.dir === "down" ? "t-down" : "t-flat";
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold leading-snug">
        <span>{r.from}</span>
        <span className={`text-[15px] ${arrowClass}`} aria-hidden="true">
          →
        </span>
        <span>{r.to}</span>
      </div>
      {r.note && (
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
          {r.note}
        </p>
      )}
    </div>
  );
}

export default function IndicatorGuide({ cards }: { cards: MacroCard[] }) {
  const cardBySeries = new Map(cards.map((c) => [c.seriesId, c]));

  return (
    <div className="space-y-8">
      {GUIDE_SECTIONS.map((s) => {
        const liveCards = s.liveSeries
          .map((id) => cardBySeries.get(id))
          .filter((c): c is MacroCard => !!c && c.value != null);

        return (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-20 rounded-xl border p-4"
            style={{ borderColor: "var(--line)", background: "var(--card-2)" }}
          >
            <div className="flex items-start gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[20px]"
                style={{ background: "var(--card)" }}
                aria-hidden="true"
              >
                {s.icon}
              </span>
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">{s.title}</h2>
                <p className="text-[12.5px]" style={{ color: "var(--fg-subtle)" }}>
                  {s.subtitle}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {s.intro}
            </p>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {s.relations.map((r, i) => (
                <RelationRow key={i} r={r} />
              ))}
            </div>

            {(liveCards.length > 0 || s.notCollected?.length) && (
              <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--fg-subtle)" }}>
                  관련 실시간 지표
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {liveCards.map((c) => (
                    <LiveChip key={c.seriesId} card={c} />
                  ))}
                  {s.notCollected?.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-dashed px-2.5 py-1 text-[12px]"
                      style={{ borderColor: "var(--line-strong)", color: "var(--fg-subtle)" }}
                      title="현재 자동 수집 파이프라인에 없는 지표입니다"
                    >
                      {label} (미수집)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
