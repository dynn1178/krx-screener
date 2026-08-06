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

/** 지표가 어느 나라 것인지 — 출처와 series_id 로 판정 */
function regionOf(c: MacroCard): "KR" | "US" {
  if (c.source === "ECOS" || c.source === "KRX") return "KR";
  if (c.source === "DERIVED") return "KR"; // M2 파생 = 한국은행 기반
  return "US";
}

const REGIONS = [
  { key: "KR" as const, flag: "🇰🇷", label: "한국" },
  { key: "US" as const, flag: "🇺🇸", label: "미국" },
];

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
      /* 카드 높이를 고정해 카테고리 안에서 줄이 어긋나지 않게 한다 */
      className="relative flex h-[136px] flex-col overflow-hidden rounded-lg border p-3"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
    >
      {c.spark.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-70">
          <Sparkline
            values={c.spark}
            rising={rising}
            className="h-full w-full"
          />
        </div>
      )}

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-1">
          <span
            className="line-clamp-2 text-[13px] font-bold leading-tight"
            style={{ color: "var(--fg-muted)" }}
          >
            {c.name}
          </span>
          <span
            className="shrink-0 rounded px-1.5 py-px text-[11px] font-semibold"
            style={
              daily
                ? { background: "var(--accent-bg)", color: "var(--accent-fg)" }
                : { background: "var(--warn-bg)", color: "var(--warn-fg)" }
            }
          >
            {FREQ_LABEL[c.frequency] ?? c.frequency}
          </span>
        </div>

        <div className="mt-1.5 flex items-baseline gap-1 tabular">
          <span className="text-[22px] font-bold leading-none tracking-tight">
            {macroValue(c.value, c.unit)}
          </span>
          <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>
            {unitSuffix(c.unit) || c.unit}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] tabular">
          <span className={`font-bold ${trend(c.change)}`}>
            {c.change == null
              ? "—"
              : signed(c.change, c.unit === "십억원" ? 0 : 2)}
          </span>
          {c.changePct != null && (
            <span className={trend(c.changePct)}>({pct2(c.changePct)})</span>
          )}
          <span style={{ color: "var(--fg-subtle)" }}>{c.compareLabel}</span>
        </div>

        <div className="mt-1 text-[11px]" style={{ color: "var(--fg-subtle)" }}>
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
      <section
        className="rounded-lg border p-4 text-[14px]"
        style={{
          borderColor: "var(--warn-line)",
          background: "var(--warn-bg)",
          color: "var(--warn-fg)",
        }}
      >
        {baseDate} 이전의 macro_daily 데이터가 없습니다.
      </section>
    );
  }

  // 국내·해외지수는 상단 시장 개요에서 스파크라인과 함께 보여주므로 제외
  const shown = cards.filter(
    (c) => c.category !== "해외지수" && c.category !== "국내지수"
  );

  const stale = dataDate && dataDate !== baseDate;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[17px] font-bold tracking-tight">매크로 경제지표</h2>
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          한국은행 ECOS · FRED · {shown.length}개 지표
        </span>
        <span
          className="ml-auto text-[12px]"
          style={{ color: "var(--fg-subtle)" }}
        >
          데이터 기준일 {dateKo(dataDate)} · 최종 갱신 {stampKo(updatedAt)}
        </span>
      </div>

      {stale && (
        <p
          className="rounded-md border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--warn-line)",
            background: "var(--warn-bg)",
            color: "var(--warn-fg)",
          }}
        >
          기준일 {baseDate} 의 매크로 데이터가 없어 <strong>{dataDate}</strong>{" "}
          값(직전 유효값)을 표시합니다.
        </p>
      )}

      {REGIONS.map(({ key, flag, label }) => {
        const list = shown.filter((c) => regionOf(c) === key);
        if (!list.length) return null;

        // 국가 안에서 카테고리별로 다시 묶는다
        const groups = new Map<string, MacroCard[]>();
        for (const c of list) {
          const g = groups.get(c.category) ?? [];
          g.push(c);
          groups.set(c.category, g);
        }

        return (
          <div
            key={key}
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--line)", background: "var(--card-2)" }}
          >
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
              <span aria-hidden="true" className="text-[18px]">
                {flag}
              </span>
              {label}
              <span
                className="text-[12px] font-normal"
                style={{ color: "var(--fg-subtle)" }}
              >
                {list.length}개 지표
              </span>
            </h3>

            {/*
              카테고리마다 행을 통째로 잡으면 지표가 1~2개인 카테고리에서 빈 칸이 크게 남는다.
              카테고리 라벨을 카드와 같은 흐름에 넣어 좌우로 이어 붙인다.
            */}
            <div className="flex flex-wrap items-stretch gap-2.5">
              {[...groups.entries()].map(([cat, items]) => (
                <div
                  key={cat}
                  className="flex items-stretch gap-2.5 rounded-lg border border-dashed p-2"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div
                    className="flex w-6 shrink-0 items-center justify-center rounded"
                    style={{ background: "var(--card)" }}
                  >
                    <span
                      className="whitespace-nowrap text-[12px] font-bold"
                      style={{
                        color: "var(--fg-subtle)",
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                      }}
                    >
                      {cat} {items.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {items.map((c) => (
                      <div key={c.seriesId} className="w-[calc(50%-5px)] lg:w-[168px]">
                        <Card c={c} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--fg-subtle)" }}
      >
        휴일·미발표 구간은 직전 유효값으로 채워져 있습니다(forward-fill). 이
        때문에 증감률은 단순히 하루/한 달 전 행과 비교하지 않고, 값이 실제로
        바뀐 <strong>직전 발표값</strong>과 비교합니다. 일간 지표는 최근 5일 안에
        변동이 없으면 보합(—)으로 둡니다. 일간 지표의 추이선은 최근 6개월,
        월간 지표는 최근 13개월을 <strong>월 1포인트씩</strong> 그립니다. 카드에
        마우스를 올리면 지표 설명과 직전값이 나옵니다.
      </p>
    </section>
  );
}
