import type { ThemeDriftAlert } from "@/lib/trendTypes";

/**
 * 테마 변동 알림 영역.
 *
 * status 의미
 *  - ready    : 한달(30일) 이상 마스터와 다른 판단이 이어졌고, 그 기간 등장일의 절반 이상에서 반복됨 → 승인 대기
 *  - watching : 아직 조건 미달. 지켜보는 중
 *  - locked   : 수동 고정된 종목이라 승인으로도 바뀌지 않음
 *
 * 이 화면은 읽기 전용이다. 실제 변경은 사용자가 요청했을 때만
 * select approve_theme_drift('005930','AI반도체','준희','사유') 로 반영한다.
 */
export default function ThemeDriftAlerts({ alerts }: { alerts: ThemeDriftAlert[] }) {
  const ready = alerts.filter((a) => a.status === "ready");
  const watching = alerts.filter((a) => a.status === "watching");

  if (!alerts.length) {
    return (
      <section className="drift-card">
        <header className="drift-head">
          <h3>테마키워드 변동 알림</h3>
        </header>
        <p className="trend-empty">마스터와 다르게 판단된 종목이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="drift-card">
      <header className="drift-head">
        <div>
          <h3>테마키워드 변동 알림</h3>
          <p className="trend-caption">
            일별 분석이 확정 테마와 다르게 판단한 기록입니다. 한달 이상 이어진 건만 승인 대기로 올라오며,
            요청하시기 전까지 마스터는 바뀌지 않습니다.
          </p>
        </div>
        <div className="drift-counts">
          <span className="pill pill-ready">승인 대기 {ready.length}</span>
          <span className="pill pill-watch">관찰 중 {watching.length}</span>
        </div>
      </header>

      <div className="drift-tablescroll">
        <table className="drift-table">
          <thead>
            <tr>
              <th scope="col">종목</th>
              <th scope="col">확정 테마</th>
              <th scope="col">제안 테마</th>
              <th scope="col" className="num">불일치</th>
              <th scope="col" className="num">지속</th>
              <th scope="col">최근 근거</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={`${a.ticker}-${a.proposed_theme}`} className={a.status === "ready" ? "is-ready" : ""}>
                <th scope="row">
                  <span className="dr-name">{a.name ?? a.ticker}</span>
                  <span className="dr-code">{a.ticker}</span>
                </th>
                <td><code>{a.master_theme}</code></td>
                <td><code className="dr-proposed">{a.proposed_theme}</code></td>
                <td className="num">
                  {a.hits}/{a.appearances}
                  <span className="dr-ratio">({Math.round(a.hit_ratio * 100)}%)</span>
                </td>
                <td className="num">{a.span_days}일</td>
                <td className="dr-evidence" title={a.latest_evidence ?? ""}>
                  {a.latest_evidence ?? "–"}
                </td>
                <td>
                  <span className={`pill pill-${a.status}`}>
                    {a.status === "ready" ? "승인 대기" : a.status === "locked" ? "고정됨" : "관찰 중"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ready.length > 0 && (
        <p className="drift-howto">
          반영하려면 <strong>&ldquo;{ready[0].name ?? ready[0].ticker} 테마 변경 승인해줘&rdquo;</strong> 처럼 요청하세요.
          승인 시 <code>theme_master</code> 가 갱신되고 <code>theme_master_history</code> 에 이력이 남습니다.
        </p>
      )}
    </section>
  );
}
