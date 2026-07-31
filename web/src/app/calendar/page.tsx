import Link from "next/link";
import { getCalendar } from "@/lib/queries";
import { wonShort, pct2, trend } from "@/lib/format";
import type { CalendarRow } from "@/lib/reportTypes";

export const revalidate = 1800;

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** YYYY-MM 단위로 묶고, 각 달을 일요일 시작 7열 그리드에 배치 */
function toMonths(rows: CalendarRow[]) {
  const byMonth = new Map<string, Map<string, CalendarRow>>();
  for (const r of rows) {
    const ym = r.base_date.slice(0, 7);
    const m = byMonth.get(ym) ?? new Map<string, CalendarRow>();
    m.set(r.base_date, r);
    byMonth.set(ym, m);
  }

  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, days]) => {
      const [y, mo] = ym.split("-").map(Number);
      const first = new Date(Date.UTC(y, mo - 1, 1));
      const total = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const lead = first.getUTCDay();

      const cells: (CalendarRow | null | undefined)[] = Array(lead).fill(null);
      for (let d = 1; d <= total; d++) {
        const iso = `${ym}-${String(d).padStart(2, "0")}`;
        cells.push(days.get(iso) ?? undefined);
      }
      while (cells.length % 7 !== 0) cells.push(null);
      return { ym, y, mo, cells, lead };
    });
}

/** 상승 강도 → 배경 농도. 한국 관례로 상승 빨강 / 하락 파랑 */
function heat(r: CalendarRow) {
  const v = r.avg_change_rate;
  if (v == null) return "bg-white";
  const a = Math.min(Math.abs(v) / 5, 1);
  const step = a < 0.15 ? 0 : a < 0.35 ? 1 : a < 0.6 ? 2 : 3;
  if (step === 0) return "bg-white";
  const up = v > 0;
  return up
    ? ["", "bg-rose-50", "bg-rose-100", "bg-rose-200"][step]
    : ["", "bg-blue-50", "bg-blue-100", "bg-blue-200"][step];
}

export default async function Page() {
  const rows = await getCalendar(400);

  if (!rows.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[19px] font-bold tracking-tight">급등 캘린더</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <code>daily_price</code> 에 시세 이력이 없어 캘린더를 만들 수
          없습니다. 수집기를 실행하면 거래일이 쌓이는 대로 자동 채워집니다.
        </div>
      </div>
    );
  }

  const months = toMonths(rows);
  const totals = rows.reduce(
    (a, r) => ({
      surge: a.surge + r.surge_n,
      plunge: a.plunge + r.plunge_n,
      swing: a.swing + r.swing_n,
      big: a.big + r.bigvalue_n,
    }),
    { surge: 0, plunge: 0, swing: 0, big: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[19px] font-bold tracking-tight">급등 캘린더</h1>
        <span className="text-xs text-neutral-500">
          {rows.length}개 거래일 · {rows[rows.length - 1].base_date} ~{" "}
          {rows[0].base_date}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "급등주 (+15% 이상)", v: totals.surge, cls: "text-rose-600" },
          { label: "급락주 (-10% 이하)", v: totals.plunge, cls: "text-blue-600" },
          { label: "장중 6% 이상 변동", v: totals.swing, cls: "text-amber-600" },
          { label: "거래대금 500억 이상", v: totals.big, cls: "text-teal-700" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2"
          >
            <div className="text-[11px] text-neutral-500">{s.label}</div>
            <div className={`mt-0.5 text-[19px] font-bold tabular ${s.cls}`}>
              {s.v.toLocaleString("ko-KR")}
            </div>
            <div className="text-[10px] text-neutral-400">누적 종목수</div>
          </div>
        ))}
      </div>

      {months.map((m) => (
        <section key={m.ym} className="space-y-2">
          <h2 className="text-[14px] font-bold tracking-tight">
            {m.y}년 {m.mo}월
          </h2>
          <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)]">
            <div className="grid grid-cols-7 border-b border-[var(--line)] bg-neutral-50">
              {WEEK.map((w, i) => (
                <div
                  key={w}
                  className={`py-1.5 text-center text-[11px] font-medium ${
                    i === 0
                      ? "text-rose-500"
                      : i === 6
                        ? "text-blue-500"
                        : "text-neutral-500"
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {m.cells.map((c, i) => {
                const dayNo = i >= m.lead ? i - m.lead + 1 : null;
                if (c === null || dayNo === null)
                  return (
                    <div
                      key={i}
                      className="min-h-[86px] border-b border-r border-[var(--line)] bg-neutral-50/40"
                    />
                  );

                if (c === undefined)
                  return (
                    <div
                      key={i}
                      className="min-h-[86px] border-b border-r border-[var(--line)] p-1.5"
                    >
                      <span className="text-[11px] text-neutral-300 tabular">
                        {dayNo}
                      </span>
                    </div>
                  );

                return (
                  <Link
                    key={i}
                    href={`/?date=${c.base_date}`}
                    className={`min-h-[86px] border-b border-r border-[var(--line)] p-1.5 transition hover:ring-2 hover:ring-inset hover:ring-teal-600 ${heat(c)}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-semibold tabular text-neutral-600">
                        {dayNo}
                      </span>
                      <span
                        className={`text-[11px] font-bold tabular ${trend(c.avg_change_rate)}`}
                      >
                        {pct2(c.avg_change_rate)}
                      </span>
                    </div>

                    <div className="mt-1 space-y-px text-[10px] tabular leading-tight">
                      {c.surge_n > 0 && (
                        <div className="text-rose-600">급등 {c.surge_n}</div>
                      )}
                      {c.plunge_n > 0 && (
                        <div className="text-blue-600">급락 {c.plunge_n}</div>
                      )}
                      {c.swing_n > 0 && (
                        <div className="text-amber-600">변동 {c.swing_n}</div>
                      )}
                    </div>

                    <div className="mt-1 text-[9px] text-neutral-400">
                      {wonShort(c.total_trade_value)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      <p className="text-[11px] leading-relaxed text-neutral-400">
        각 날짜는 <code>daily_price</code> 이력에서 전일 종가 대비로 계산합니다.
        전일 데이터가 없는 첫 거래일은 등락률이 비어 있을 수 있습니다. 날짜를
        누르면 해당일 리포트로 이동합니다.
      </p>
    </div>
  );
}
