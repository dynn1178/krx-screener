import DatePicker from "@/components/DatePicker";
import MacroBoard from "@/components/MacroBoard";
import MarketHeader from "@/components/MarketHeader";
import MoversTable from "@/components/MoversTable";
import {
  CommentarySections,
  SectorPanel,
  BriefPanel,
} from "@/components/Commentary";
import {
  getReportDates,
  resolveBaseDate,
  getMacroBoard,
  getCommentary,
  getSectorPerf,
  getFxRates,
  getReportRows,
  getDailyBrief,
  getGlobalIndices,
  getIndexSparklines,
} from "@/lib/queries";

// 데이터는 하루 1회 갱신 → 30분 캐시
export const revalidate = 1800;

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h2 className="text-base font-semibold text-amber-900">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-amber-800">
        {children}
      </div>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requested } = await searchParams;

  let dates;
  try {
    dates = await getReportDates();
  } catch (e) {
    return (
      <Notice title="Supabase 연결 실패">
        {e instanceof Error ? e.message : String(e)}
        <p className="mt-2">
          Vercel 환경변수 <code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를 확인하세요.
        </p>
      </Notice>
    );
  }

  if (!dates.length) {
    return (
      <Notice title="리포트 데이터가 없습니다">
        daily_price · screening · market_daily_commentary 중 어느 테이블에도
        데이터가 없습니다. 수집 파이프라인을 먼저 실행하세요.
      </Notice>
    );
  }

  const dateList = dates.map((d) => d.base_date);
  const { baseDate, requestedMissing } = resolveBaseDate(dates, requested);

  // STEP 0 — 지정한 날짜에 데이터가 없으면 임의로 옮기지 않고 그 사실만 알린다
  if (requestedMissing || !baseDate) {
    return (
      <div className="space-y-4">
        <DatePicker dates={dateList} current={dates[0].base_date} />
        <Notice title={`${requested} 데이터가 없습니다`}>
          휴장일이거나 아직 수집되지 않은 날짜입니다. 임의로 다른 날짜로
          이동하지 않습니다. 가장 최근 거래일은{" "}
          <strong>{dates[0].base_date}</strong> 입니다.
        </Notice>
      </div>
    );
  }

  const [macro, commentary, sectors, fx, rows, brief, global, spark] =
    await Promise.all([
      getMacroBoard(baseDate),
      getCommentary(baseDate),
      getSectorPerf(baseDate),
      getFxRates(baseDate),
      getReportRows(baseDate),
      getDailyBrief(baseDate),
      getGlobalIndices(baseDate),
      getIndexSparklines(baseDate),
    ]);

  const meta = dates.find((d) => d.base_date === baseDate);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[19px] font-bold tracking-tight">
          일별 시장 리포트
        </h1>
        <DatePicker dates={dateList} current={baseDate} />
      </div>

      {meta && !meta.has_commentary && !meta.has_summary && (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          이 날짜는 시세 데이터만 적재되어 있고 서술형 시황·뉴스 분석은 아직
          없습니다. 아래 스크리닝 표는 시세 기준으로 자동 산출한 결과입니다.
        </p>
      )}

      <MarketHeader c={commentary} fx={fx} global={global} spark={spark} />

      <MacroBoard
        cards={macro.cards}
        updatedAt={macro.updatedAt}
        dataDate={macro.dataDate}
        baseDate={baseDate}
      />

      <BriefPanel brief={brief} />
      <SectorPanel rows={sectors} analysis={commentary?.themeAnalysis} />
      <CommentarySections c={commentary} />
      <MoversTable rows={rows} baseDate={baseDate} />
    </div>
  );
}
