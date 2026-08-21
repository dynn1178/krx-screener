/**
 * 매크로 카드 값(실시간 수집치)을 경기지표 가이드의 인과관계 규칙에 대입해
 * "오늘의 시그널"을 자동 생성한다. 가이드(/guide)와 홈 화면 매크로보드를
 * 잇는 연결고리 — 정적 설명(guideContent)과 실제 값을 함께 보여준다.
 */
import type { MacroCard } from "./reportTypes";

export type InsightTone = "watch" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  icon: string;
  headline: string;
  detail: string;
  /** 가이드 페이지 섹션 앵커 */
  anchor: string;
  seriesIds: string[];
};

const cardOf = (cards: MacroCard[], id: string) =>
  cards.find((c) => c.seriesId === id) ?? null;

export function buildInsights(cards: MacroCard[]): Insight[] {
  const out: Insight[] = [];
  const get = (id: string) => cardOf(cards, id);
  const v = (id: string) => get(id)?.value ?? null;

  // ── 1. 미 장단기 금리차(10Y-2Y) ──────────────────────────
  const t10y2y = v("T10Y2Y");
  if (t10y2y != null) {
    out.push(
      t10y2y < 0
        ? {
            id: "t10y2y-inverted",
            tone: "watch",
            icon: "⚠️",
            headline: `미 장단기 금리차 역전 중 (${t10y2y.toFixed(2)}%p)`,
            detail:
              "10년물 금리가 2년물보다 낮습니다. 과거 경기침체 전에 반복적으로 나타난 패턴이지만 실제 침체까지는 통상 6개월~2년의 시차가 있었습니다.",
            anchor: "rates",
            seriesIds: ["T10Y2Y", "DGS10", "DGS2"],
          }
        : {
            id: "t10y2y-normal",
            tone: "info",
            icon: "✅",
            headline: `미 장단기 금리차 정상 구간 (+${t10y2y.toFixed(2)}%p)`,
            detail: "10년물이 2년물보다 높은 정상적인 우상향 커브입니다.",
            anchor: "rates",
            seriesIds: ["T10Y2Y"],
          }
    );
  }

  // ── 2. 한 · 미 정책금리차 ───────────────────────────────
  const bokRate = v("RATE_BASE_M");
  const fedRate = v("DFF");
  if (bokRate != null && fedRate != null) {
    const gap = bokRate - fedRate;
    if (gap < 0) {
      out.push({
        id: "kr-us-rate-gap",
        tone: "watch",
        icon: "⚠️",
        headline: `한국 기준금리가 미국보다 ${Math.abs(gap).toFixed(2)}%p 낮음`,
        detail:
          "한국이 더 낮은 금리차 역전 상태입니다. 캐리트레이드 유인이 줄어 외국인 자금 유출 압력 · 원화 약세로 이어질 수 있습니다.",
        anchor: "rates",
        seriesIds: ["RATE_BASE_M", "DFF"],
      });
    }
  }

  // ── 3. VIX ───────────────────────────────────────────────
  const vix = v("VIXCLS");
  if (vix != null) {
    if (vix >= 30) {
      out.push({
        id: "vix-high",
        tone: "watch",
        icon: "🌪️",
        headline: `VIX 공포지수 급등 (${vix.toFixed(1)})`,
        detail:
          "30 이상은 시장 스트레스가 커진 구간입니다. 위험자산(주식) 회피, 금 · 엔화 · 미국채 등 안전자산 선호가 강해지는 경향이 있습니다.",
        anchor: "safe-haven",
        seriesIds: ["VIXCLS"],
      });
    } else if (vix <= 15) {
      out.push({
        id: "vix-low",
        tone: "info",
        icon: "😌",
        headline: `VIX 안정권 (${vix.toFixed(1)})`,
        detail:
          "15 이하는 시장이 안정적이거나, 반대로 방심(complacency) 구간일 수 있어 변동성 재확대 리스크도 함께 참고할 필요가 있습니다.",
        anchor: "safe-haven",
        seriesIds: ["VIXCLS"],
      });
    }
  }

  // ── 4. 원/달러 환율 추세 ──────────────────────────────────
  const fx = get("FX_USD_D") ?? get("DEXKOUS");
  if (fx?.value != null && fx.change != null && fx.change !== 0) {
    const weakening = fx.change > 0;
    out.push({
      id: "fx-trend",
      tone: "info",
      icon: weakening ? "📈" : "📉",
      headline: `원/달러 환율 ${weakening ? "상승(원화 약세)" : "하락(원화 강세)"} — ${fx.value.toFixed(1)}원`,
      detail: weakening
        ? "수출기업 가격경쟁력에는 우호적이지만, 외국인 입장에서는 원화자산 수익률이 낮아져 수급 이탈 압력으로 작용할 수 있습니다. 원자재 수입 비중이 큰 항공 · 정유는 비용 부담이 커집니다."
        : "외국인 원화자산 수익률에는 우호적이지만, 수출기업 가격경쟁력은 상대적으로 약해질 수 있습니다.",
      anchor: "fx",
      seriesIds: ["FX_USD_D", "DEXKOUS"],
    });
  }

  // ── 5. 달러인덱스(DXY) 추세 ───────────────────────────────
  const dxy = get("DTWEXBGS");
  if (dxy?.value != null && dxy.change != null && dxy.change !== 0) {
    const strong = dxy.change > 0;
    out.push({
      id: "dxy-trend",
      tone: "info",
      icon: strong ? "💵" : "💴",
      headline: `달러인덱스 ${strong ? "강세" : "약세"} 전환`,
      detail: strong
        ? "달러가 전반적으로 강해지면 신흥국 통화 전반이 약세 압력을 받고, 달러표시 원자재(유가 · 금 등) 가격에는 하락 압력으로 작용하는 경향이 있습니다."
        : "달러 약세는 통상 신흥국 통화 강세, 금 등 달러표시 자산 가격 상승 압력으로 이어지는 경향이 있습니다.",
      anchor: "fx",
      seriesIds: ["DTWEXBGS"],
    });
  }

  // ── 6. 유가(WTI) 추세 ────────────────────────────────────
  const oil = get("DCOILWTICO");
  if (oil?.value != null && oil.change != null && oil.change !== 0) {
    const rising = oil.change > 0;
    out.push({
      id: "oil-trend",
      tone: rising ? "watch" : "info",
      icon: "🛢️",
      headline: `WTI 유가 ${rising ? "상승" : "하락"} — $${oil.value.toFixed(1)}`,
      detail: rising
        ? "생산자물가 → 소비자물가로 전가되며 인플레 압력을 키울 수 있고, 항공 · 해운 · 화학 등 원가 비중이 큰 업종의 마진을 누릅니다. 반대로 정유 · 에너지주에는 우호적입니다."
        : "원가 부담이 줄어 항공 · 해운 · 화학 업종에는 우호적이지만, 정유 · 에너지주 실적에는 부담 요인입니다.",
      anchor: "commodities",
      seriesIds: ["DCOILWTICO"],
    });
  }

  // ── 7. 경기선행지수 순환변동치 ─────────────────────────────
  const cli = v("CLI_LEADING_CYCLE_M");
  if (cli != null) {
    out.push({
      id: "cli-cycle",
      tone: cli < 100 ? "watch" : "info",
      icon: cli < 100 ? "📉" : "📈",
      headline: `선행지수 순환변동치 ${cli.toFixed(1)} — ${cli >= 100 ? "확장" : "수축"} 국면`,
      detail:
        "100을 기준선으로, 위면 경기 확장, 아래면 수축 국면으로 흔히 해석합니다. 실제 국면 전환에는 시차가 있을 수 있습니다.",
      anchor: "leading-lagging",
      seriesIds: ["CLI_LEADING_CYCLE_M", "CLI_COINCIDENT_CYCLE_M"],
    });
  }

  // ── 8. 미국 실업률 추세 ───────────────────────────────────
  const unrate = get("UNRATE");
  if (unrate?.value != null && unrate.change != null && unrate.change !== 0) {
    const rising = unrate.change > 0;
    out.push({
      id: "unrate-trend",
      tone: rising ? "watch" : "info",
      icon: rising ? "📉" : "📈",
      headline: `미국 실업률 ${rising ? "상승" : "하락"} — ${unrate.value.toFixed(1)}%`,
      detail: rising
        ? "소비 위축 우려가 커지는 신호입니다. 다만 미국 증시에서는 '나쁜 뉴스가 좋은 뉴스'로 해석되어 연준 피벗 기대에 오히려 상승하는 역설적 패턴도 나타납니다."
        : "고용시장이 견조하다는 신호로, 소비 여력 유지에 우호적입니다.",
      anchor: "leading-lagging",
      seriesIds: ["UNRATE"],
    });
  }

  return out;
}
