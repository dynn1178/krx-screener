import DatePicker from "@/components/DatePicker";
import KeywordBoard from "@/components/KeywordBoard";
import { getKeywords, getReportDates, resolveBaseDate } from "@/lib/queries";
import { dateKo } from "@/lib/format";

export const revalidate = 1800;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requested } = await searchParams;
  const all = await getKeywords();

  // 키워드가 실제로 있는 날짜만 선택지로
  const dates = [...new Set(all.map((r) => r.base_date))].sort().reverse();

  if (!dates.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[19px] font-bold tracking-tight">키워드 보드</h1>
        <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn-fg)]">
          아직 뉴스·키워드 분석이 적재된 날짜가 없습니다. 키워드는{" "}
          <code>screening</code> 테이블의 테마·산업·이슈 키워드에서 집계합니다.
        </div>
      </div>
    );
  }

  const reportDates = await getReportDates();
  const { baseDate: resolved } = resolveBaseDate(
    reportDates.filter((d) => dates.includes(d.base_date)),
    requested && dates.includes(requested) ? requested : undefined
  );
  const baseDate = resolved ?? dates[0];
  const rows = all.filter((r) => r.base_date === baseDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight">키워드 보드</h1>
          <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
            {dateKo(baseDate)} · 키워드별 평균 상승률과 누적 거래대금, 소속 종목
          </p>
        </div>
        <DatePicker dates={dates} current={baseDate} />
      </div>

      {requested && !dates.includes(requested) && (
        <p className="rounded-md border border-[var(--warn-line)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-fg)]">
          {requested} 은 키워드 분석이 없는 날짜라 가장 최근 분석일(
          {baseDate})을 표시합니다.
        </p>
      )}

      <KeywordBoard rows={rows} baseDate={baseDate} />
    </div>
  );
}
