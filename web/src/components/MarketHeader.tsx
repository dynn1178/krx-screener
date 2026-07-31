import Sparkline from "./Sparkline";
import { num, pct2, trend, trendVar, signed } from "@/lib/format";
import type { Commentary, GlobalIndex } from "@/lib/reportTypes";

export type IndexSpark = { values: number[]; asOf: string | null };

type Tile = {
  label: string;
  region: "KR" | "US";
  value: number | null;
  change?: number | null;
  changePct?: number | null;
  spark?: IndexSpark;
};

const FLAG: Record<string, string> = { KR: "🇰🇷", US: "🇺🇸" };

function Card({ t }: { t: Tile }) {
  const dir = t.changePct ?? t.change ?? null;
  const values = t.spark?.values ?? [];

  return (
    <div
      className="relative overflow-hidden rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
    >
      {/* 등락 방향 띠 */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: trendVar(dir) }}
      />

      {/* 추이는 카드 하단 배경으로 */}
      {values.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-70">
          <Sparkline
            values={values}
            rising={dir == null || dir === 0 ? null : dir > 0}
            className="h-full w-full"
          />
        </div>
      )}

      <div className="relative pl-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-bold">
            <span aria-hidden="true">{FLAG[t.region]}</span>{" "}
            <span style={{ color: "var(--fg-muted)" }}>{t.label}</span>
          </span>
          {values.length > 1 && (
            <span
              className="rounded px-1 text-[11px]"
              style={{
                color: "var(--fg-subtle)",
                background: "color-mix(in srgb, var(--card) 70%, transparent)",
              }}
            >
              {values.length}일
            </span>
          )}
        </div>

        <div className="mt-1 text-[24px] font-bold leading-none tabular">
          {t.value == null ? (
            <span style={{ color: "var(--fg-subtle)" }}>—</span>
          ) : (
            num(t.value, 2)
          )}
        </div>

        <div className={`mt-1.5 text-[13px] font-bold tabular ${trend(dir)}`}>
          {t.change != null && `${signed(t.change, 2)} `}
          {t.changePct != null && `(${pct2(t.changePct)})`}
          {t.change == null && t.changePct == null && (
            <span style={{ color: "var(--fg-subtle)" }}>—</span>
          )}
          {t.spark?.asOf && (
            <span
              className="ml-1.5 font-normal"
              style={{ color: "var(--fg-subtle)" }}
            >
              {t.spark.asOf}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketHeader({
  c,
  global,
  spark,
}: {
  c: Commentary | null;
  global: GlobalIndex[];
  spark: Record<string, IndexSpark>;
}) {
  const gmap = new Map(global.map((g) => [g.key, g]));

  // 국내 → 해외 순서로 한 줄. 환율·통화는 아래 매크로 보드의 환율 섹션과 겹치므로 뺀다.
  const tiles: Tile[] = [
    {
      label: "KOSPI",
      region: "KR",
      value: c?.kospiClose ?? null,
      change: c?.kospiChange ?? null,
      changePct: c?.kospiChangePct ?? null,
      spark: spark.kospi,
    },
    {
      label: "KOSDAQ",
      region: "KR",
      value: c?.kosdaqClose ?? null,
      change: c?.kosdaqChange ?? null,
      changePct: c?.kosdaqChangePct ?? null,
      spark: spark.kosdaq,
    },
    {
      label: "S&P 500",
      region: "US",
      value: c?.sp500 ?? gmap.get("sp500")?.value ?? null,
      changePct: c?.sp500ChangePct ?? gmap.get("sp500")?.changePct ?? null,
      spark: spark.sp500,
    },
    {
      label: "나스닥종합",
      region: "US",
      value: c?.nasdaq ?? gmap.get("nasdaqcom")?.value ?? null,
      changePct: c?.nasdaqChangePct ?? gmap.get("nasdaqcom")?.changePct ?? null,
      spark: spark.nasdaqcom,
    },
    {
      label: "다우존스",
      region: "US",
      value: gmap.get("djia")?.value ?? null,
      changePct: gmap.get("djia")?.changePct ?? null,
      spark: spark.djia,
    },
  ];

  if (tiles.every((t) => t.value == null) && !c) return null;

  const noGlobal = tiles
    .filter((t) => t.region === "US")
    .every((t) => t.value == null);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[17px] font-bold tracking-tight">시장 개요</h2>
        {c?.circuitBreaker && (
          <span
            className="rounded px-2 py-0.5 text-[13px] font-bold text-white"
            style={{ background: "var(--up)" }}
          >
            서킷브레이커 발동
          </span>
        )}
        <span
          className="ml-auto text-[12px]"
          style={{ color: "var(--fg-subtle)" }}
        >
          해외지수는 FRED 종가 기준으로 1일 지연됩니다
        </span>
      </div>

      {c?.headline && (
        <p
          className="rounded-lg border-l-4 px-4 py-2.5 text-[15px] font-bold leading-snug"
          style={{
            borderColor: "var(--accent)",
            background: "var(--accent-bg)",
            color: "var(--accent-fg)",
          }}
        >
          {c.headline}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} t={t} />
        ))}
      </div>

      {noGlobal && (
        <p
          className="rounded-md border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--warn-line)",
            background: "var(--warn-bg)",
            color: "var(--warn-fg)",
          }}
        >
          해외지수가 비어 있습니다. GitHub Actions 의 매크로 수집 워크플로를 한
          번 실행하면 채워집니다.
        </p>
      )}
    </section>
  );
}
