import { num, pct2, trend, signed } from "@/lib/format";
import type { Commentary, FxRate } from "@/lib/reportTypes";

function Stat({
  label,
  value,
  change,
  changePct,
  suffix = "",
}: {
  label: string;
  value: number | null;
  change?: number | null;
  changePct?: number | null;
  suffix?: string;
}) {
  if (value == null && changePct == null) return null;
  const dir = changePct ?? change ?? null;
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-[17px] font-bold leading-none tabular">
        {value == null ? "—" : num(value, 2)}
        {value != null && suffix ? (
          <span className="ml-0.5 text-[10px] font-normal text-neutral-400">
            {suffix}
          </span>
        ) : null}
      </div>
      <div className={`mt-1 text-[11px] font-semibold tabular ${trend(dir)}`}>
        {change != null && `${signed(change, 2)} `}
        {changePct != null && `(${pct2(changePct)})`}
        {change == null && changePct == null && "—"}
      </div>
    </div>
  );
}

export default function MarketHeader({
  c,
  fx,
}: {
  c: Commentary | null;
  fx: FxRate[];
}) {
  if (!c && !fx.length) return null;

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
            출처 테이블 {c.source}
          </span>
        )}
      </div>

      {c?.headline && (
        <p className="rounded-lg border-l-4 border-teal-700 bg-teal-50/60 px-3 py-2 text-[13px] font-semibold leading-snug text-teal-900">
          {c.headline}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="KOSPI"
          value={c?.kospiClose ?? null}
          change={c?.kospiChange ?? null}
          changePct={c?.kospiChangePct ?? null}
        />
        <Stat
          label="KOSDAQ"
          value={c?.kosdaqClose ?? null}
          change={c?.kosdaqChange ?? null}
          changePct={c?.kosdaqChangePct ?? null}
        />
        <Stat
          label="원/달러"
          value={c?.usdkrw ?? null}
          changePct={c?.usdkrwChangePct ?? null}
          suffix="원"
        />
        <Stat
          label="달러인덱스"
          value={c?.dxy ?? null}
          changePct={c?.dxyChangePct ?? null}
        />
        {fx
          .filter((f) => !/USD\s*\/?\s*KRW|USDKRW/i.test(f.pair))
          .slice(0, 2)
          .map((f) => (
            <Stat
              key={f.pair}
              label={f.pair}
              value={f.rate}
              changePct={f.change_pct}
            />
          ))}
      </div>
    </section>
  );
}
