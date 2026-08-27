import TrendsClient from "@/components/TrendsClient";
import ThemeDriftAlerts from "@/components/ThemeDriftAlerts";
import { getTrendBoard, getThemeDriftAlerts } from "@/lib/trendQueries";
import { DEFAULT_TREND_PERIOD, type TrendPeriod } from "@/lib/trendTypes";

export const revalidate = 1800; // 30분 — 기존 페이지들과 동일

export const metadata = {
  title: "키워드 추이 | KRX",
  description: "테마·산업키워드별 거래대금과 등락률 추이",
};

const ALLOWED: TrendPeriod[] = [7, 30, 180, 365];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const parsed = Number(sp?.days);
  const days: TrendPeriod = ALLOWED.includes(parsed as TrendPeriod)
    ? (parsed as TrendPeriod)
    : DEFAULT_TREND_PERIOD;

  const [board, alerts] = await Promise.all([
    getTrendBoard(days),
    getThemeDriftAlerts(),
  ]);

  return (
    <main className="trends-page">
      <header className="trends-header">
        <h1>키워드 추이</h1>
        <p>
          종목별로 확정된 테마키워드를 기준으로 집계합니다. 같은 종목은 매일 같은 테마로 묶이므로
          날짜 간 비교가 가능합니다.
        </p>
      </header>

      <TrendsClient initialBoard={board} initialDays={days} />

      <ThemeDriftAlerts alerts={alerts} />
    </main>
  );
}
