import Sparkline from "./Sparkline";
import { FREQ_LABEL, SOURCE_LABEL } from "@/lib/macroMeta";
import {
  macroValue,
  unitSuffix,
  signed,
  pct2,
  trend,
  dateKo,
  monthKo,
  stampKo,
} from "@/lib/format";
import type { MacroCard } from "@/lib/reportTypes";

function Card({ c }: { c: MacroCard }) {
  const daily = c.frequency === "D";
  const rising = c.change == null || c.change === 0 ? null : c.change > 0;
  const tip = [
    c.name,
    c.desc,
    c.unitDesc ? `단위 ${c.unit} — ${c.unitDesc}` : `단위 ${c.unit}`,
    `출처 ${SOURCE_LABEL[c.source] ?? c.source} · ${FREQ_LABEL[c.frequency] ?? c.frequency} 갱신`,
    c.prev != null ? `직전값 ${macroValue(c.prev, c.unit)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      title={tip}
      className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)] p-3"
    >
      {/* 일간 지표는 6개월 추이를 배경에 깐다 */}
      {c.spark.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 opacity-70">
          <Sparkline
            values={c.spark}
            rising={rising}
            step={!daily}
            className="h-full w-full"
          />
        </div>
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-1">
          <span className="text-[11px] font-semibold leading-tight text-neutral-600">
            {c.name}
          </span>
          <span
            className={`shrink-0 rounded px-1 py-px text-[9px] font-medium ${
              daily
                ? "bg-teal-50 text-teal-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {FREQ_LABEL[c.frequency] ?? c.frequency}
          </span>
        </div>

        <div className="mt-1 flex items-baseline gap-1 tabular">
          <span className="text-[20px] font-bold leading-none tracking-tight">
            {macroValue(c.value, c.unit)}
          </span>
          <span className="text-[10px] text-neutral-400">
            {unitSuffix(c.unit) || c.unit}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[10px] tabular">
          <span className={`font-semibold ${trend(c.change)}`}>
            {c.change == null
              ? "—"
              : `${signed(c.change, c.unit === "십억원" ? 0 : 2)}`}
          </span>
          {c.changePct != null && (
            <span className={trend(c.changePct)}>({pct2(c.changePct)})</span>
          )}
          <span className="text-neutral-400">{c.compareLabel}</span>
        </div>

        {/* 월·분기·연 지표는 어느 시점 값인지 텍스트로 병기 */}
        <div className="mt-1 text-[9px] text-neutral-400">
          {daily
            ? `${c.effectiveDate ?? "-"} 기준`
            : `${monthKo(c.effectiveDate)} 발표값`}
        </div>
      </div>
    </div>
  );
}

export default function MacroBoard({
  cards,
  updatedAt,
  dataDate,
  baseDate,
}: {
  cards: MacroCard[];
  updatedAt: string | null;
  dataDate: string | null;
  baseDate: string;
}) {
  if (!cards.length) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {baseDate} 이전의 macro_daily 데이터가 없습니다.
      </section>
    );
  }

  const groups = new Map<string, MacroCard[]>();
  for (const c of cards) {
    const g = groups.get(c.category) ?? [];
    g.push(c);
    groups.set(c.category, g);
  }

  const stale = dataDate && dataDate !== baseDate;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-bold tracking-tight">매크로 경제지표</h2>
        <span className="text-xs text-neutral-500">
          FRED · 한국은행 ECOS · {cards.length}개 지표
        </span>
        <span className="ml-auto text-[11px] text-neutral-400">
          데이터 기준일 {dateKo(dataDate)} · 최종 갱신 {stampKo(updatedAt)}
        </span>
      </div>

      {stale && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          기준일 {baseDate} 의 매크로 데이터가 없어{" "}
          <strong>{dataDate}</strong> 값(직전 유효값)을 표시합니다.
        </p>
      )}

      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat}>
          <h3 className="mb-1.5 text-[11px] font-bold text-neutral-500">
            {cat}
            <span className="ml-1 font-normal text-neutral-400">
              {list.length}
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
            {list.map((c) => (
              <Card key={c.seriesId} c={c} />
            ))}
          </div>
        </div>
      ))}

      <p className="text-[11px] leading-relaxed text-neutral-400">
        휴일·미발표 구간은 직전 유효값으로 채워져 있습니다(forward-fill). 이
        때문에 증감률은 단순히 하루/한 달 전 행과 비교하지 않고, 값이 실제로
        바뀐 <strong>직전 발표값</strong>과 비교합니다. 일간 지표는 최근 5일
        안에 변동이 없으면 보합(—)으로 둡니다. 카드에 마우스를 올리면 지표
        설명과 직전값이 나옵니다.
      </p>
    </section>
  );
}
