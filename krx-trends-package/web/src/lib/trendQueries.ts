// /trends 탭 데이터 조회
// 기존 queries.ts 의 Supabase 클라이언트 생성 방식에 맞춰 import 경로만 바꿔 쓰면 된다.
import { supabase } from "./supabaseClient";
import type { TrendBoard, TrendPeriod, ThemeDriftAlert } from "./trendTypes";

const EMPTY_BOARD: TrendBoard = {
  from: null,
  to: null,
  days: 30,
  dates: [],
  topTradeValue: [],
  topGainerIndustry: [],
  steadyRisers: [],
};

/**
 * 3개 선 그래프 데이터를 한 번에 가져온다.
 * DB 쪽에서 상위 10 / 5 / 5 선정과 날짜 채우기까지 끝내므로 클라이언트는 그리기만 하면 된다.
 */
export async function getTrendBoard(days: TrendPeriod = 30): Promise<TrendBoard> {
  const { data, error } = await supabase.rpc("get_trend_board", { p_days: days });

  if (error) {
    console.error("[getTrendBoard]", error.message);
    return { ...EMPTY_BOARD, days };
  }
  if (!data) return { ...EMPTY_BOARD, days };

  return data as TrendBoard;
}

/**
 * 테마 변동 알림.
 * status='ready' 는 한달 이상 마스터와 다른 판단이 이어진 건으로, 사용자가 승인을 요청할 때만 반영한다.
 */
export async function getThemeDriftAlerts(limit = 50): Promise<ThemeDriftAlert[]> {
  const { data, error } = await supabase
    .from("theme_drift_alert")
    .select("*")
    .limit(limit);

  if (error) {
    console.error("[getThemeDriftAlerts]", error.message);
    return [];
  }
  return (data ?? []) as ThemeDriftAlert[];
}

/** 승인 대기(ready) 건수만 — 네비게이션 배지용 */
export async function getDriftReadyCount(): Promise<number> {
  const { count, error } = await supabase
    .from("theme_drift_alert")
    .select("ticker", { count: "exact", head: true })
    .eq("status", "ready");

  if (error) return 0;
  return count ?? 0;
}
