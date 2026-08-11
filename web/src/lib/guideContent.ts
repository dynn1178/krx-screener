/**
 * 경기지표 해석 가이드 — 정적 교육 콘텐츠.
 * 여기 적힌 인과관계는 "대체로 그렇다"는 경험칙이지 항상 성립하는 법칙이 아니다.
 * 각 섹션의 liveSeries 는 macro_series.series_id 기준으로, 실제 수집 중인
 * 지표만 카드에 연결한다 — 수집하지 않는 지표(금, 구리 등)는 note 로만 언급.
 */

export type Relation = {
  /** 조건/원인 */
  from: string;
  /** 결과/영향 */
  to: string;
  /** 방향성 아이콘 색 힌트 — 없으면 중립 */
  dir?: "up" | "down";
  /** 보충 설명(예외, 반례, 시차) */
  note?: string;
};

export type GuideSection = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  intro: string;
  relations: Relation[];
  /** 이 섹션과 관련해 실시간으로 보여줄 macro_series.series_id */
  liveSeries: string[];
  /** 수집하지 않아 실시간 연동이 안 되는 지표 — 참고용 안내 */
  notCollected?: string[];
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "rates",
    icon: "💰",
    title: "금리",
    subtitle: "할인율이 바뀌면 자산 가격의 '저울추'가 움직인다",
    intro:
      "금리는 미래 현금흐름을 현재 가치로 환산할 때 쓰는 할인율이자, 돈을 빌리고 굴리는 비용이다. 금리가 오르내리면 주식·채권·환율이 거의 동시에 반응한다.",
    relations: [
      {
        from: "금리 상승 (유동성 감소)",
        to: "성장주 · 고PER 종목 약세",
        dir: "down",
        note:
          "미래 이익을 할인하는 할인율이 오르므로 바이오·2차전지·플랫폼 등 PER 높은 종목이 특히 타격을 받는다.",
      },
      {
        from: "금리 상승",
        to: "은행 · 보험 등 금융주 강세",
        dir: "up",
        note: "순이자마진(NIM)이 개선되는 업종이라 반대로 수혜를 본다.",
      },
      {
        from: "금리 상승",
        to: "채권가격 하락",
        dir: "down",
        note: "금리와 채권가격은 역의 관계이며, 듀레이션(만기)이 길수록 민감도가 커진다.",
      },
      {
        from: "한 · 미 금리차 역전 (한국 금리가 더 낮음)",
        to: "외국인 자금 유출 압력 → 원화 약세",
        dir: "down",
        note: "캐리트레이드 유인이 줄어 원화 자산의 상대 매력이 떨어진다.",
      },
      {
        from: "장단기 금리차(10Y-2Y) 역전",
        to: "경기침체 선행 신호",
        note:
          "미국에서 역사적으로 침체 전에 반복 관측된 패턴이지만, 실제 침체까지는 6개월~2년의 큰 시차가 있었다.",
      },
    ],
    liveSeries: ["T10Y2Y", "DGS10", "DGS2", "DFF", "RATE_BASE_M"],
  },
  {
    id: "fx",
    icon: "💱",
    title: "환율",
    subtitle: "원화 가치가 흔들리면 수출기업과 외국인 수급이 동시에 움직인다",
    intro:
      "환율은 수출기업의 가격경쟁력과 외국인 투자자의 원화자산 수익률을 동시에 결정하는 변수다. 방향뿐 아니라 '왜 움직였는지'(금리차 때문인지, 달러 전체가 강한지)를 함께 봐야 한다.",
    relations: [
      {
        from: "원화 약세 (환율 상승)",
        to: "수출기업 가격경쟁력 ↑ → 수출주 강세",
        dir: "up",
        note:
          "반도체 · 자동차 · 조선 등이 대표적. 다만 원자재 수입 비중이 높은 항공 · 정유는 오히려 비용 부담이 커진다.",
      },
      {
        from: "원화 약세",
        to: "외국인 원화자산 수익률 저하 → 수급 이탈 가능성",
        dir: "down",
        note: "환차손 우려로 코스피 매도 압력이 커질 수 있다.",
      },
      {
        from: "달러인덱스(DXY) 강세",
        to: "신흥국 통화 전반 약세 · 원자재 가격(달러표시) 하락 압력",
        dir: "down",
        note: "달러가 전세계적으로 강하면 원화만의 문제가 아닌 공통 압력으로 봐야 한다.",
      },
    ],
    liveSeries: ["DEXKOUS", "FX_USD_D", "DTWEXBGS", "FX_CNY_D", "FX_JPY_D"],
  },
  {
    id: "inflation",
    icon: "📈",
    title: "물가 · 인플레이션",
    subtitle: "물가는 금리 정책의 명분이자 기업 마진의 변수다",
    intro:
      "물가 지표는 중앙은행 긴축/완화의 근거가 되고, 원자재 → 생산자물가 → 소비자물가로 전가되는 경로를 통해 기업 마진과 소비 여력에 영향을 준다.",
    relations: [
      {
        from: "금리 상승",
        to: "소비 · 투자 위축 → 물가 하락(디스인플레이션)",
        note: "정책 효과에는 통상 6~18개월의 시차가 있다.",
      },
      {
        from: "유가 상승",
        to: "생산자물가(PPI) → 소비자물가(CPI) 순차 상승 → 긴축 우려",
        dir: "up",
        note: "항공유 비용 증가로 항공 · 여행주 마진이 눌리는 경로도 같은 뿌리다.",
      },
      {
        from: "임금 상승",
        to: "서비스물가의 경직적 상승('끈적한 인플레')",
        dir: "up",
        note: "연준이 긴축을 오래 끌고 가는 명분이 된다.",
      },
    ],
    liveSeries: ["CPIAUCSL", "CPI_TOTAL_M"],
  },
  {
    id: "safe-haven",
    icon: "🥇",
    title: "금 · 안전자산",
    subtitle: "위험이 커지면 돈은 변동성이 낮은 자산으로 숨는다",
    intro:
      "금리 · 달러 · 공포지수(VIX)는 안전자산 선호 심리를 읽는 핵심 축이다. 다만 최근 몇 년은 중앙은행 매입, 지정학 리스크 등으로 교과서적 역상관이 깨지는 구간도 잦았다 — '공식이 항상 맞진 않는다'는 것도 하나의 인사이트다.",
    relations: [
      {
        from: "금리 상승",
        to: "금 보유 기회비용 증가 → 금값 하락 압력",
        dir: "down",
        note: "전통적인 역상관이지만, 2023~2025년처럼 중앙은행 매입 · 지정학 리스크로 깨지는 구간이 많았다.",
      },
      {
        from: "달러 약세",
        to: "금값 상승",
        dir: "up",
        note: "금은 달러로 표시되는 자산이라 달러 가치와 반대로 움직이는 경향이 있다.",
      },
      {
        from: "VIX(변동성지수) 급등",
        to: "안전자산(금 · 엔화 · 미국채) 선호 → 위험자산(주식) 회피",
        note: "VIX 30 이상은 통상 시장 스트레스 구간으로 해석된다.",
      },
    ],
    liveSeries: ["VIXCLS"],
    notCollected: ["금(Gold) 현물가격", "USD/JPY 환율", "미국 국채 ETF 가격"],
  },
  {
    id: "leading-lagging",
    icon: "🧭",
    title: "경기 선행 · 후행 지표",
    subtitle: "지금이 경기 사이클의 어느 지점인지 가늠하는 나침반",
    intro:
      "선행지표는 경기보다 먼저 움직이고, 동행지표는 현재 국면을, 후행지표는 경기를 뒤따라 확인해준다. 세 개를 함께 봐야 '지금 국면'과 '앞으로의 방향'을 동시에 판단할 수 있다.",
    relations: [
      {
        from: "PMI(구매관리자지수) 50 하회",
        to: "제조업 경기 위축 신호 → 철강 · 화학 · 조선 등 경기민감주 약세",
        dir: "down",
      },
      {
        from: "실업률 상승",
        to: "소비 위축 우려 → 내수 · 소비재 약세",
        dir: "down",
        note:
          "다만 미국 증시에서는 '나쁜 뉴스가 좋은 뉴스'로 해석되어 연준 피벗 기대에 오히려 상승하는 역설적 패턴도 나타난다.",
      },
      {
        from: "신규 실업수당청구건수(주간) 서프라이즈",
        to: "고용시장 실시간 체크 포인트 — 시장이 민감하게 반응",
      },
      {
        from: "선행종합지수 순환변동치 100 상회/하회",
        to: "경기 확장/수축 국면 판별",
        note: "100을 기준선으로, 위면 확장, 아래면 수축 국면으로 흔히 해석한다.",
      },
    ],
    liveSeries: [
      "USSLIND",
      "CLI_LEADING_M",
      "CLI_LEADING_CYCLE_M",
      "CLI_COINCIDENT_M",
      "CLI_COINCIDENT_CYCLE_M",
      "CLI_LAGGING_M",
      "UNRATE",
      "UMCSENT",
      "BSI_ACTUAL_M",
      "BSI_FORECAST_M",
    ],
    notCollected: ["ISM/S&P 제조업 PMI", "미국 주간 신규 실업수당청구건수"],
  },
  {
    id: "commodities",
    icon: "🛢️",
    title: "원자재 · 공급망",
    subtitle: "원자재 가격은 비용이자 동시에 경기의 체온계다",
    intro:
      "원자재는 기업 비용 구조에 직접 영향을 주는 동시에, 수요를 반영하는 경기 선행 신호로도 쓰인다.",
    relations: [
      {
        from: "유가 상승",
        to: "항공 · 해운 · 화학 비용 증가 → 마진 압박",
        dir: "down",
        note: "반대로 정유 · 에너지주는 유가 상승 자체가 실적 개선 요인이라 강세를 보인다.",
      },
      {
        from: "구리가격('Dr. Copper') 상승",
        to: "산업생산 · 건설경기 개선 기대",
        dir: "up",
        note: "구리는 산업 전반에 쓰여 경기 선행지표로 흔히 활용된다.",
      },
    ],
    liveSeries: ["DCOILWTICO"],
    notCollected: ["구리 선물가격"],
  },
];

export const GUIDE_SECTION_IDS = GUIDE_SECTIONS.map((s) => s.id);
