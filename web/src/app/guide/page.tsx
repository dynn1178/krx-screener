import DatePicker from "@/components/DatePicker";
import MacroInsights from "@/components/MacroInsights";
import IndicatorGuide from "@/components/IndicatorGuide";
import { buildInsights } from "@/lib/insights";
import { getReportDates, resolveBaseDate, getMacroBoard } from "@/lib/queries";
import { dateKo } from "@/lib/format";

export const revalidate = 1800;

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: requested } = await searchParams;

  const dates = await getReportDates();
  const dateList = dates.map((d) => d.base_date);
  const { baseDate } = resolveBaseDate(dates, requested);
  const effectiveDate = baseDate ?? dates[0]?.base_date ?? null;

  const macro = effectiveDate
    ? await getMacroBoard(effectiveDate)
    : { cards: [], updatedAt: null, dataDate: null };

  const insights = buildInsights(macro.cards);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight">
            경기지표 해석 가이드
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fg-subtle)" }}>
            금리 · 환율 · 물가 · 안전자산 · 경기선행지표 · 원자재가 서로
            어떻게 움직이는지, 그리고 지금 실제 값은 어떤지를 함께 봅니다.
          </p>
        </div>
        {dateList.length > 0 && effectiveDate && (
          <DatePicker dates={dateList} current={effectiveDate} />
        )}
      </div>

      {macro.cards.length === 0 ? (
        <p
          className="rounded-md border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--warn-line)",
            background: "var(--warn-bg)",
            color: "var(--warn-fg)",
          }}
        >
          매크로 데이터가 없어 실시간 시그널을 계산할 수 없습니다. 아래 해석
          가이드는 그대로 참고할 수 있습니다.
        </p>
      ) : (
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[15px] font-bold tracking-tight">
              오늘의 시그널
            </h2>
            <span className="text-[12px]" style={{ color: "var(--fg-subtle)" }}>
              {dateKo(macro.dataDate)} 기준 · 아래 지표값에 규칙을 대입해
              자동으로 생성했습니다
            </span>
          </div>
          {insights.length ? (
            <MacroInsights insights={insights} variant="full" />
          ) : (
            <p className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>
              현재 값 기준으로 특별히 강조할 시그널이 없습니다.
            </p>
          )}
        </section>
      )}

      <IndicatorGuide cards={macro.cards} />

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--fg-subtle)" }}
      >
        이 페이지의 인과관계는 일반적인 경험칙을 정리한 것으로, 실제 시장은
        여러 변수가 동시에 작용해 예외가 자주 나타납니다. 투자 판단의 근거가
        아닌 <strong>지표를 읽는 법을 익히는 참고 자료</strong>로 활용하세요.
      </p>
    </div>
  );
}
