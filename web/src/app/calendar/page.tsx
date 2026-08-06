import DatePicker from "@/components/DatePicker";
import SurgeCalendar from "@/components/SurgeCalendar";
import {
  getKeywords,
  getCalendar,
  getDailyIndexMap,
  getReportDates,
  resolveBaseDate,
  shiftMonths,
} from "@/lib/queries";
import { wonShort } from "@/lib/format";

export const revalidate = 1800;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requested } = await searchParams;
  const [keywords, agg, indexMap, reportDates] = await Promise.all([
    getKeywords(),
    getCalendar(400),
    getDailyIndexMap(),
    getReportDates(),
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

  // 달력에서 고를 수 있는 날짜 = 리포트가 있는 모든 거래일
  const dateList = reportDates.map((d) => d.base_date);
  // 지정이 없으면 오늘(=가장 최근 적재일) 우선, 지정한 날짜가 없으면 그 사실만 알린다
  const { baseDate, requestedMissing } = resolveBaseDate(reportDates, requested);

  if (requestedMissing || !baseDate) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-[19px] font-bold tracking-tight">급등 캘린더</h1>
          {dateList.length > 0 && <DatePicker dates={dateList} current={dateList[0]} />}
        </div>
        <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn-fg)]">
          {requested} 데이터가 없습니다. 휴장일이거나 아직 수집되지 않은 날짜입니다.
          임의로 다른 날짜로 이동하지 않습니다. 가장 최근 거래일은{" "}
          <strong>{dateList[0]}</strong> 입니다.
        </div>
      </div>
    );
  }

  // 선택한 날짜가 속한 달 + 직전 달, 딱 2개월만 보여준다. 그 이전은 날짜 선택으로.
  const ym = baseDate.slice(0, 7);
  const prevYm = shiftMonths(baseDate, 1).slice(0, 7);
  const months = [ym, prevYm];

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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[19px] font-bold tracking-tight">급등 캘린더</h1>
          {agg.length > 0 && (
            <span className="text-xs text-[var(--fg-subtle)]">
              {agg.length}개 거래일 · {agg[agg.length - 1].base_date} ~{" "}
              {agg[0].base_date}
            </span>
          )}
        </div>
        <DatePicker dates={dateList} current={baseDate} />
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

      <p className="text-xs text-[var(--fg-subtle)]">
        선택한 날짜가 속한 달과 직전 달, 2개월만 표시합니다. 더 이전 날짜는 위
        날짜 선택에서 골라보세요.
      </p>

      <SurgeCalendar
        rows={keywords}
        months={months}
        indexMap={Object.fromEntries(indexMap)}
      />
    </div>
  );
}
