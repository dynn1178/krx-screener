import Sparkline from "./Sparkline";
import { num, pct2, trend, signed } from "@/lib/format";
import type { Commentary, FxRate, GlobalIndex } from "@/lib/reportTypes";

export type IndexSpark = { values: number[]; asOf: string | null };

type Tile = {
  label: string;
  value: number | null;
  change?: number | null;
  changePct?: number | null;
  suffix?: string;
  accent?: boolean;
  digits?: number;
  spark?: IndexSpark;
};

function Card({ t }: { t: Tile }) {
  const dir = t.changePct ?? t.change ?? null;
  const up = (dir ?? 0) > 0;
  const down = (dir ?? 0) < 0;
  const values = t.spark?.values ?? [];

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-[var(--card)] px-3 py-2.5 ${
        t.accent ? "border-neutral-300" : "border-[var(--line)]"
      }`}
    >
      {/* 등락 방향을 왼쪽 띠로 */}
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          up ? "bg-rose-500" : down ? "bg-blue-500" : "bg-neutral-200"
        }`}
      />

      {/* 추이는 카드 하단 배경으로 */}
      {values.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-11 opacity-70">
          <Sparkline
            values={values}
            rising={dir == null || dir === 0 ? null : dir > 0}
            className="h-full w-full"
          />
        </div>
      )}

      <div className="relative pl-1.5">
        <div className="flex items-baseline justify-between gap-1">
          <span
            className={`text-[11px] ${t.accent ? "font-bold text-neutral-700" : "text-neutral-500"}`}
          >
            {t.label}
          </span>
          {values.length > 1 && (
            <span className="rounded bg-white/70 px-1 text-[9px] text-neutral-400">
              {values.length}일
            </span>
          )}
        </div>

        <div
          className={`mt-0.5 leading-none tabular ${t.accent ? "text-[20px] font-bold" : "text-[17px] font-bold"}`}
        >
          {t.value == null ? (
            <span className="text-neutral-300">—</span>
          ) : (
            num(t.value, t.digits ?? 2)
          )}
          {t.value != null && t.suffix && (
            <span className="ml-0.5 text-[10px] font-normal text-neutral-400">
              {t.suffix}
            </span>
          )}
        </div>

        <div className={`mt-1 text-[11px] font-semibold tabular ${trend(dir)}`}>
          {t.change != null && `${signed(t.change, 2)} `}
          {t.changePct != null && `(${pct2(t.changePct)})`}
          {t.change == null && t.changePct == null && (
            <span className="text-neutral-300">—</span>
          )}
          {t.spark?.asOf && (
            <span className="ml-1 font-normal text-neutral-400">
              {t.spark.asOf} 기준
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketHeader({
  c,
  fx,
  global,
  spark,
}: {
  c: Commentary | null;
  fx: FxRate[];
  global: GlobalIndex[];
  spark: Record<string, IndexSpark>;
}) {
  if (!c && !fx.length && !global.some((g) => g.value != null)) return null;

  const domestic: Tile[] = [
    {
      label: "KOSPI",
      value: c?.kospiClose ?? null,
      change: c?.kospiChange ?? null,
      changePct: c?.kospiChangePct ?? null,
      accent: true,
      spark: spark.kospi,
    },
    {
      label: "KOSDAQ",
      value: c?.kosdaqClose ?? null,
      change: c?.kosdaqChange ?? null,
      changePct: c?.kosdaqChangePct ?? null,
      accent: true,
      spark: spark.kosdaq,
    },
  ];

  const gmap = new Map(global.map((g) => [g.key, g]));
  const overseas: Tile[] = [
    {
      label: "나스닥종합",
      value: c?.nasdaq ?? gmap.get("nasdaqcom")?.value ?? null,
      changePct: c?.nasdaqChangePct ?? gmap.get("nasdaqcom")?.changePct ?? null,
      spark: spark.nasdaqcom,
    },
    {
      label: "다우존스",
      value: gmap.get("djia")?.value ?? null,
      changePct: gmap.get("djia")?.changePct ?? null,
      spark: spark.djia,
    },
    {
      label: "S&P 500",
      value: c?.sp500 ?? gmap.get("sp500")?.value ?? null,
      changePct: c?.sp500ChangePct ?? gmap.get("sp500")?.changePct ?? null,
      spark: spark.sp500,
    },
  ];

  const others: Tile[] = [
    {
      label: "원/달러",
      value: c?.usdkrw ?? null,
      changePct: c?.usdkrwChangePct ?? null,
      suffix: "원",
      spark: spark.usdkrw,
    },
    {
      label: "달러인덱스",
      value: c?.dxy ?? null,
      changePct: c?.dxyChangePct ?? null,
      spark: spark.dxy,
    },
    ...fx
      .filter((f) => !/USD\s*\/?\s*KRW|USDKRW/i.test(f.pair))
      .slice(0, 2)
      .map((f) => ({
        label: f.pair,
        value: f.rate,
        changePct: f.change_pct,
      })),
  ].filter((t) => t.value != null || t.changePct != null);

  const noGlobal = overseas.every((t) => t.value == null);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold tracking-tight">시장 개요</h2>
        {c?.circuitBreaker && (
          <span className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
            서킷브레이커 발동
          </span>
        )}
        {c && (
          <span className="ml-auto text-[11px] text-neutral-400">
            출처 {c.source}
          </span>
        )}
      </div>

      {c?.headline && (
        <p className="rounded-lg border-l-4 border-teal-700 bg-teal-50/60 px-3 py-2 text-[13px] font-semibold leading-snug text-teal-900">
          {c.headline}
        </p>
      )}

      <div className="grid gap-2 lg:grid-cols-[2fr_3fr_3fr]">
        <div>
          <h3 className="mb-1 text-[10px] font-bold text-neutral-400">국내</h3>
          <div className="grid grid-cols-2 gap-2">
            {domestic.map((t) => (
              <Card key={t.label} t={t} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-[10px] font-bold text-neutral-400">
            해외지수 <span className="font-normal">· FRED 종가, 1일 지연</span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {overseas.map((t) => (
              <Card key={t.label} t={t} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-[10px] font-bold text-neutral-400">
            환율 · 통화
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {others.length ? (
              others.map((t) => <Card key={t.label} t={t} />)
            ) : (
              <p className="col-span-full rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-center text-[11px] text-neutral-400">
                환율 데이터 없음
              </p>
            )}
          </div>
        </div>
      </div>

      {noGlobal && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          해외지수가 비어 있습니다. <code>collect_macro.py</code> 에 SP500 ·
          NASDAQCOM · DJIA 를 추가해 뒀으니, GitHub Actions 의 매크로 수집
          워크플로를 한 번 실행하면 채워집니다.
        </p>
      )}
    </section>
  );
}
