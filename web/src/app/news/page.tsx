import DatePicker from "@/components/DatePicker";
import NewsList from "@/components/NewsList";
import { getNews, getReportDates, resolveBaseDate } from "@/lib/queries";
import { dateKo } from "@/lib/format";

export const revalidate = 1800;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requested } = await searchParams;
  const reportDates = await getReportDates();
  const dates = reportDates.map((d) => d.base_date);

  if (!dates.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[19px] font-bold tracking-tight">뉴스</h1>
        <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn-fg)]">
          리포트 날짜가 없습니다.
        </div>
      </div>
    );
  }

  const { baseDate: resolved } = resolveBaseDate(
    reportDates,
    requested && dates.includes(requested) ? requested : undefined
  );
  const baseDate = resolved ?? dates[0];
  const rows = await getNews(baseDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight">뉴스</h1>
          <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
            {dateKo(baseDate)} · 당일 스크리닝 종목 관련 기사와 시장 뉴스
          </p>
        </div>
        <DatePicker dates={dates} current={baseDate} />
      </div>

      {rows.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn-fg)]">
          <p className="font-semibold">
            {baseDate} 의 뉴스가 아직 적재되지 않았습니다.
          </p>
          <p className="leading-relaxed">
            뉴스는 새로 만든 <code>news</code> 테이블에서 읽습니다. 분석
            파이프라인 STEP 2 에서 <code>get_korean_stock_news</code> ·{" "}
            <code>get_market_news</code> 결과를 이 테이블에 적재하면 여기에 카드로
            표시됩니다.
          </p>
          <p className="leading-relaxed">
            컬럼: <code>base_date</code>, <code>title</code>, <code>url</code>,{" "}
            <code>press</code>, <code>published_at</code>, <code>summary</code>,{" "}
            <code>tickers[]</code>, <code>stock_names[]</code>,{" "}
            <code>theme_kw</code>, <code>issue_kw</code>, <code>sentiment</code>,{" "}
            <code>is_market_wide</code>. URL 은 도구 응답에 실제로 있는 값만
            넣습니다.
          </p>
        </div>
      ) : (
        <NewsList rows={rows} />
      )}
    </div>
  );
}
