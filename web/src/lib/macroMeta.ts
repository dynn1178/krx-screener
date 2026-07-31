/**
 * 매크로 지표 설명 — 수집 스펙 문서에서 1회 전사한 정적 사전.
 * macro_series 테이블은 name_kr/category/frequency/unit 만 갖고 있어
 * 사람이 읽을 설명은 여기서 보강한다. series_id 는 대문자 기준.
 */
export const MACRO_DESC: Record<string, string> = {
  // ── FRED (미국)
  DGS10: "미국 10년물 국채금리. 장기 시장금리의 기준.",
  DGS2: "미국 2년물 국채금리. 통화정책 기대를 가장 민감하게 반영.",
  DFF: "연방기금금리(Effective Federal Funds Rate). 미국 정책금리의 실효값.",
  T10Y2Y: "장단기 금리차(10Y − 2Y). 마이너스면 장단기 금리 역전.",
  DEXKOUS: "원/달러 환율(FRED 제공). ECOS 종가와 산출 시점이 달라 값이 다를 수 있음.",
  DTWEXBGS: "달러인덱스(Broad). 주요 교역상대국 통화 대비 달러 강세도.",
  DCOILWTICO: "WTI 유가(배럴당 달러).",
  VIXCLS: "VIX 변동성 지수. 스탠더드앤드푸어스500 옵션 내재변동성 — 공포지수.",
  USSLIND: "미국 선행지수(Leading Index).",
  UMCSENT: "미시간대 소비자심리지수.",
  CPIAUCSL: "미국 CPI(도시 소비자물가지수).",
  UNRATE: "미국 실업률.",

  // ── ECOS (한국은행)
  RATE_BASE_M: "한국은행 기준금리(연%).",
  FX_USD_D: "원/달러 환율 종가.",
  FX_CNY_D: "원/위안 환율 종가.",
  FX_JPY_D: "원/100엔 환율.",
  M2_TOTAL_M:
    "M2 통화량(평잔, 계절조정). 구성요소 합산이 아니라 ECOS M2 총계 단일 항목(BBHS00) 원값.",
  CLI_LEADING_M: "선행종합지수. 경기에 앞서 움직이는 지표들의 합성.",
  CLI_COINCIDENT_M: "동행종합지수. 현재 경기 국면을 나타냄.",
  CLI_LAGGING_M: "후행종합지수. 경기를 뒤따라 움직임.",
  CLI_LEADING_CYCLE_M: "선행지수 순환변동치. 추세를 제거해 순환 국면만 남긴 값.",
  CLI_COINCIDENT_CYCLE_M: "동행지수 순환변동치. 100을 넘으면 경기 확장 국면.",
  CPI_TOTAL_M: "소비자물가지수(총지수).",
  CCSI_M: "소비자심리지수(CCSI, 종합). 100을 넘으면 낙관 우위.",
  CCSI_TRAVEL_M: "여행비 지출전망CSI.",
  BSI_ACTUAL_M: "기업경기실사지수(BSI) — 실적, 전산업. 100을 넘으면 개선 응답 우위.",
  BSI_FORECAST_M: "기업경기실사지수(BSI) — 전망, 전산업.",

  // ── 파생
  M2_TOTAL_YOY_M:
    "M2 전년동월대비 증가율. (당월값 − 12개월전값) ÷ 12개월전값 × 100.",
};

/** 단위 자체에 설명이 필요한 경우 */
export const UNIT_DESC: Record<string, string> = {
  "2020=100":
    "2020년 평균을 100으로 놓은 상대지수. 105.2면 2020년 평균 대비 5.2% 높은 수준.",
  "%p": "퍼센트포인트. 두 금리의 차이라 % 가 아닌 %p 로 읽는다.",
  십억원: "10억 원 단위. 1,000이면 1조 원.",
};

/** 갱신 주기 코드 → 사람이 읽는 표기 */
export const FREQ_LABEL: Record<string, string> = {
  D: "일간",
  W: "주간",
  M: "월간",
  Q: "분기",
  A: "연간",
  Y: "연간",
};

/** 갱신 주기별 증감 비교 기준 표기 */
export const FREQ_COMPARE_LABEL: Record<string, string> = {
  D: "전일 대비",
  W: "전주 대비",
  M: "전월 대비",
  Q: "전분기 대비",
  A: "전년 대비",
  Y: "전년 대비",
};

/** 카테고리 표시 순서 — macro_series.category 값 기준 */
export const CATEGORY_ORDER = [
  "금리",
  "환율",
  "물가",
  "통화",
  "경기",
  "심리",
  "고용",
  "원자재",
];

export const SOURCE_LABEL: Record<string, string> = {
  FRED: "FRED",
  ECOS: "한국은행",
  DERIVED: "파생계산",
};
