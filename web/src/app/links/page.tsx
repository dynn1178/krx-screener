export const metadata = { title: "증시 사이트 · 국내 증시 일별 분석" };

type Site = {
  name: string;
  url: string;
  desc: string;
  note?: string;
  free: "무료" | "일부 유료" | "유료";
};

type Group = { title: string; hint: string; icon: string; sites: Site[] };

const GROUPS: Group[] = [
  {
    title: "시세 · 종목 조회",
    hint: "일상적으로 가장 자주 여는 곳",
    icon: "📈",
    sites: [
      {
        name: "네이버 증권",
        url: "https://finance.naver.com",
        desc: "국내 종목 시세·차트·재무·뉴스·토론방을 한 화면에서 본다. 종목 코드만 알면 바로 접근되고, 컨센서스와 업종 비교도 무료로 제공한다.",
        note: "이 사이트의 종목명을 누르면 여기로 연결된다",
        free: "무료",
      },
      {
        name: "인베스팅닷컴",
        url: "https://kr.investing.com",
        desc: "해외 지수·원자재·환율·채권을 실시간에 가깝게 본다. 경제지표 캘린더가 특히 유용해서 미국 CPI·고용지표·FOMC 일정과 예상치를 미리 확인할 수 있다.",
        free: "일부 유료",
      },
      {
        name: "한국거래소 (KRX)",
        url: "http://data.krx.co.kr",
        desc: "시세의 원천. 투자자별 매매동향, 공매도 잔고, 업종지수, 상장폐지·관리종목 지정 같은 공식 데이터를 CSV로 내려받을 수 있다.",
        note: "이 사이트의 시세 데이터도 여기서 수집한다",
        free: "무료",
      },
    ],
  },
  {
    title: "공시 · 기업 분석",
    hint: "숫자의 근거를 확인할 때",
    icon: "📑",
    sites: [
      {
        name: "전자공시시스템 (DART)",
        url: "https://dart.fss.or.kr",
        desc: "금융감독원이 운영하는 공시 원본 저장소. 사업보고서·분기보고서·주요사항보고서를 직접 읽을 수 있어, 뉴스로 접한 내용의 사실 여부를 확인하는 최종 근거가 된다.",
        note: "액면병합·감자·유상증자 확인은 여기가 가장 정확하다",
        free: "무료",
      },
      {
        name: "에프앤가이드 (FnGuide)",
        url: "https://comp.fnguide.com",
        desc: "국내 기업 재무 데이터와 애널리스트 컨센서스의 사실상 표준. 종목별 요약 재무제표와 실적 추정치를 정리해 제공한다.",
        note: "상세 데이터·API는 유료. 종목 요약 페이지는 열람 가능",
        free: "일부 유료",
      },
      {
        name: "FN투자 (에프엔투자자문)",
        url: "https://www.fninvest.co.kr",
        desc: "투자자문사가 제공하는 리서치·포트폴리오 자료. 기관 시각의 종목 분석을 참고할 때 본다.",
        free: "일부 유료",
      },
    ],
  },
  {
    title: "영상 · 해설",
    hint: "맥락과 배경을 잡을 때",
    icon: "🎥",
    sites: [
      {
        name: "삼프로TV",
        url: "https://www.youtube.com/@3protv",
        desc: "매일 개장 전후 시황과 업종별 심층 인터뷰. 애널리스트·펀드매니저가 직접 출연해 그날 시장이 왜 움직였는지 설명한다.",
        free: "무료",
      },
      {
        name: "슈카월드",
        url: "https://www.youtube.com/@syukaworld",
        desc: "거시경제와 산업 구조를 쉬운 언어로 풀어준다. 개별 종목보다 큰 흐름을 이해하는 데 도움이 된다.",
        free: "무료",
      },
      {
        name: "김작가 TV",
        url: "https://www.youtube.com/@kimzakka",
        desc: "투자 전문가 인터뷰 중심. 시장 국면별로 상반된 견해를 나란히 들어볼 수 있다.",
        free: "무료",
      },
    ],
  },
];

const FREE_STYLE: Record<Site["free"], React.CSSProperties> = {
  무료: { background: "var(--accent-bg)", color: "var(--accent-fg)" },
  "일부 유료": { background: "var(--warn-bg)", color: "var(--warn-fg)" },
  유료: { background: "var(--card-2)", color: "var(--fg-muted)" },
};

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[21px] font-bold tracking-tight">증시 사이트</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--fg-muted)" }}>
          이 대시보드에서 다루지 않는 정보를 찾을 때 함께 보는 곳들
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-[17px] font-bold tracking-tight">
              <span aria-hidden="true" className="mr-1.5">
                {g.icon}
              </span>
              {g.title}
            </h2>
            <span className="text-[13px]" style={{ color: "var(--fg-subtle)" }}>
              {g.hint}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.sites.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl border p-4 transition hover:shadow-sm"
                style={{ borderColor: "var(--line)", background: "var(--card)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[16px] font-bold group-hover:underline">
                    {s.name}
                  </span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={FREE_STYLE[s.free]}
                  >
                    {s.free}
                  </span>
                </div>

                <p
                  className="mt-2 flex-1 text-[13px] leading-relaxed"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {s.desc}
                </p>

                {s.note && (
                  <p
                    className="mt-2 border-t pt-2 text-[12px]"
                    style={{
                      borderColor: "var(--line)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {s.note}
                  </p>
                )}

                <span
                  className="mt-2 text-[12px] tabular"
                  style={{ color: "var(--fg-subtle)" }}
                >
                  {s.url.replace(/^https?:\/\//, "")} ↗
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--fg-subtle)" }}
      >
        외부 사이트로 연결되는 링크입니다. 각 서비스의 데이터·의견은 해당
        운영자의 것이며, 유료 여부와 제공 범위는 바뀔 수 있습니다.
      </p>
    </div>
  );
}
