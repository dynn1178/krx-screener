import SurgeCalendar from "@/components/SurgeCalendar";
import { getKeywords, getCalendar, getDailyIndexMap } from "@/lib/queries";
import { wonShort } from "@/lib/format";

export const revalidate = 1800;

export default async function Page() {
  const [keywords, agg, indexMap] = await Promise.all([
    getKeywords(),
    getCalendar(400),
    getDailyIndexMap(),
  ]);

  if (!keywords.length && !agg.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[19px] font-bold tracking-tight">급등 캘린더</h1>
        <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn-fg)]">
          시세 이력(<code>daily_price</code>)과 키워드 분석(
          <code>screening</code>) 둘 다 비어 있어 캘린더를 만들 수 없습니다.
        </div>
      </div>
    );
  }

  // 키워드가 있는 달 + 시세가 있는 달을 합쳐 최신순으로
  const months = [
    ...new Set([
      ...keywords.map((k) => k.base_date.slice(0, 7)),
      ...agg.map((a) => a.base_date.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();

  const totals = agg.reduce(
    (a, r) => ({
      surge: a.surge + r.surge_n,
      plunge: a.plunge + r.plunge_n,
      swing: a.swing + r.swing_n,
      big: a.big + r.bigvalue_n,
      value: a.value + (r.total_trade_value ?? 0),
    }),
    { surge: 0, plunge: 0, swing: 0, big: 0, value: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[19px] font-bold tracking-tight">급등 캘린더</h1>
        {agg.length > 0 && (
          <span className="text-xs text-[var(--fg-subtle)]">
            {agg.length}개 거래일 · {agg[agg.length - 1].base_date} ~{" "}
            {agg[0].base_date}
          </span>
        )}
      </div>

      {agg.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "급등주 (+15% 이상)", v: totals.surge, cls: "t-up" },
            { label: "급락주 (-10% 이하)", v: totals.plunge, cls: "t-down" },
            { label: "장중 6% 이상 변동", v: totals.swing, cls: "text-[var(--warn-fg)]" },
            { label: "거래대금 500억 이상", v: totals.big, cls: "text-[var(--accent-fg)]" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2"
            >
              <div className="text-[12px] text-[var(--fg-subtle)]">{s.label}</div>
              <div className={`mt-0.5 text-[19px] font-bold tabular ${s.cls}`}>
                {s.v.toLocaleString("ko-KR")}
              </div>
              <div className="text-[12px] text-[var(--fg-subtle)]">누적 종목수</div>
            </div>
          ))}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2">
            <div className="text-[12px] text-[var(--fg-subtle)]">누적 거래대금</div>
            <div className="mt-0.5 text-[19px] font-bold tabular text-[var(--fg)]">
              {wonShort(totals.value)}
            </div>
            <div className="text-[12px] text-[var(--fg-subtle)]">기간 합계</div>
          </div>
        </div>
      )}

      <SurgeCalendar
        rows={keywords}
        months={months}
        indexMap={Object.fromEntries(indexMap)}
      />
    </div>
  );
}
