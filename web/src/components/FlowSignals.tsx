import { wonShort, wonFull, pct2, trend } from "@/lib/format";
import { naverLink, type FlowSignal } from "@/lib/reportTypes";

const TURN_LABEL: Record<"buy" | "sell", string> = {
  buy: "순매수 전환",
  sell: "순매도 전환",
};

function Turn({ v, who }: { v: "buy" | "sell" | null; who: string }) {
  if (!v) return null;
  const buy = v === "buy";
  return (
    <span
      className="whitespace-nowrap rounded px-2 py-0.5 text-[12px] font-semibold"
      style={{
        background: buy ? "var(--up-bg)" : "var(--down-bg)",
        color: buy ? "var(--up)" : "var(--down)",
      }}
    >
      {who} {TURN_LABEL[v]}
    </span>
  );
}

/**
 * 전일 대비 수급 방향이 뒤집힌 종목.
 * snapshot 이 (date, ticker) 누적으로 쌓이기 시작한 뒤부터 값이 나온다.
 */
export default function FlowSignals({
  rows,
  baseDate,
}: {
  rows: FlowSignal[];
  baseDate: string;
}) {
  if (!rows.length) return null;

  const fBuy = rows.filter((r) => r.foreignTurn === "buy").length;
  const fSell = rows.filter((r) => r.foreignTurn === "sell").length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[17px] font-bold tracking-tight">수급 방향 전환</h2>
        <span className="text-[13px]" style={{ color: "var(--fg-muted)" }}>
          {baseDate} · 전일 대비 외국인·기관 순매수 부호가 바뀐 종목
        </span>
        <span className="ml-auto text-[13px] tabular" style={{ color: "var(--fg-subtle)" }}>
          외국인 <span className="t-up font-bold">매수전환 {fBuy}</span> ·{" "}
          <span className="t-down font-bold">매도전환 {fSell}</span>
        </span>
      </div>

      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--line)", background: "var(--card)" }}
      >
        <table className="w-full min-w-[860px] border-collapse text-[14px]">
          <thead>
            <tr
              className="border-b text-left"
              style={{
                borderColor: "var(--line)",
                background: "var(--card-2)",
                color: "var(--fg-muted)",
              }}
            >
              <th className="px-3 py-2.5 text-[13px] font-semibold">종목</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">등락률</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">거래대금</th>
              <th className="px-3 py-2.5 text-left text-[13px] font-semibold">전환</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">외국인</th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold">기관</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.ticker}
                className="border-b"
                style={{ borderColor: "var(--line)" }}
              >
                <td className="px-3 py-2.5">
                  <a
                    href={naverLink(r.ticker)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold hover:underline"
                  >
                    {r.name ?? r.ticker}
                  </a>
                  <div className="text-[12px] tabular" style={{ color: "var(--fg-subtle)" }}>
                    {r.ticker}
                  </div>
                </td>
                <td className={`px-3 py-2.5 text-right font-bold tabular ${trend(r.changeRate)}`}>
                  {pct2(r.changeRate)}
                </td>
                <td className="px-3 py-2.5 text-right tabular" title={wonFull(r.tradeValue)}>
                  {wonShort(r.tradeValue)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <Turn v={r.foreignTurn} who="외국인" />
                    <Turn v={r.instTurn} who="기관" />
                  </div>
                </td>
                <td className={`px-3 py-2.5 text-right tabular ${trend(r.foreignNetBuy)}`}>
                  {r.foreignNetBuy == null ? "—" : wonShort(r.foreignNetBuy)}
                </td>
                <td className={`px-3 py-2.5 text-right tabular ${trend(r.instNetBuy)}`}>
                  {r.instNetBuy == null ? "—" : wonShort(r.instNetBuy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
        개별 종목 판단보다 시장 국면을 읽는 데 쓰는 지표입니다. 외국인 매수전환
        종목이 매도전환보다 뚜렷하게 많으면 수급이 돌아서는 신호로 볼 수 있습니다.
      </p>
    </section>
  );
}
