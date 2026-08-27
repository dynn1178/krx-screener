"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import TrendLineChart from "./TrendLineChart";
import {
  TREND_PERIODS,
  type TrendBoard,
  type TrendPeriod,
  type TrendMetric,
} from "@/lib/trendTypes";

const fmtEok = (v: number) =>
  Math.abs(v) >= 1e12 ? `${(v / 1e12).toFixed(1)}조` : `${Math.round(v / 1e8).toLocaleString("ko-KR")}억`;

export default function TrendsClient({
  initialBoard,
  initialDays,
}: {
  initialBoard: TrendBoard;
  initialDays: TrendPeriod;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<TrendPeriod>(initialDays);
  const [metric, setMetric] = useState<TrendMetric>("tradeValue");

  const board = initialBoard;

  const pickPeriod = (d: TrendPeriod) => {
    setDays(d);
    startTransition(() => router.push(`${pathname}?days=${d}`, { scroll: false }));
  };

  return (
    <>
      {/* 필터 — 차트 위 한 줄 */}
      <div className="trend-filters">
        <div className="seg" role="group" aria-label="기간 선택">
          {TREND_PERIODS.map((p) => (
            <button key={p.value} type="button"
              onClick={() => pickPeriod(p.value)}
              aria-pressed={days === p.value}
              className={days === p.value ? "on" : ""}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="seg" role="group" aria-label="지표 선택">
          <button type="button" onClick={() => setMetric("tradeValue")}
            aria-pressed={metric === "tradeValue"} className={metric === "tradeValue" ? "on" : ""}>
            거래대금
          </button>
          <button type="button" onClick={() => setMetric("changePct")}
            aria-pressed={metric === "changePct"} className={metric === "changePct" ? "on" : ""}>
            등락률
          </button>
        </div>

        <span className="trend-range">
          {board.from && board.to ? `${board.from} ~ ${board.to}` : "데이터 없음"}
          {pending && <em className="trend-loading"> 불러오는 중…</em>}
        </span>
      </div>

      <TrendLineChart
        title="거래대금 상위 테마 10"
        caption="선택한 기간 동안 거래대금 합계가 가장 컸던 테마입니다. 자금이 어디에 머물렀는지를 봅니다."
        series={board.topTradeValue}
        dates={board.dates}
        metric={metric}
        badge={(s) => fmtEok(s.totalTradeValue)}
      />

      <TrendLineChart
        title="상승폭이 큰 산업키워드 5"
        caption="기간 평균 등락률이 가장 높았던 산업키워드입니다. 테마보다 좁은 단위라 어떤 아이템이 실제로 올랐는지 드러납니다."
        series={board.topGainerIndustry}
        dates={board.dates}
        metric={metric}
        badge={(s) => (s.avgChangePct != null ? `평균 ${s.avgChangePct > 0 ? "+" : ""}${s.avgChangePct}%` : "")}
      />

      <TrendLineChart
        title="꾸준히 상승중인 테마 5"
        caption="한 번 크게 오른 테마가 아니라, 등장한 날 중 오른 날의 비율이 높았던 테마입니다. 지속성을 봅니다."
        series={board.steadyRisers}
        dates={board.dates}
        metric={metric}
        badge={(s) =>
          s.upRatio != null ? `${s.upDays}/${s.appearances}일 상승` : ""
        }
      />
    </>
  );
}
