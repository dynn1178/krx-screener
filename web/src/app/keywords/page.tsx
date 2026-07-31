import Link from "next/link";
import { getKeywords, getReportDates } from "@/lib/queries";
import { naverLink, type KeywordRow } from "@/lib/reportTypes";

export const revalidate = 1800;

const KINDS = [
  { key: "theme", label: "테마 키워드", hint: "시장이 묶어 부르는 집합적 흐름", cls: "violet" },
  { key: "issue", label: "이슈 키워드", hint: "그날의 구체적 트리거", cls: "orange" },
  { key: "industry", label: "산업 키워드", hint: "종목의 핵심 사업 아이템", cls: "teal" },
] as const;

const TONE: Record<string, { chip: string; bar: string }> = {
  violet: { chip: "bg-violet-50 text-violet-800 border-violet-200", bar: "bg-violet-500" },
  orange: { chip: "bg-orange-50 text-orange-800 border-orange-200", bar: "bg-orange-500" },
  teal: { chip: "bg-teal-50 text-teal-800 border-teal-200", bar: "bg-teal-600" },
};

type Agg = {
  keyword: string;
  mentions: number;
  days: Set<string>;
  stocks: Map<string, string>; // name -> code
};

function aggregate(rows: KeywordRow[], kind: string): Agg[] {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    if (r.kind !== kind) continue;
    const a =
      m.get(r.keyword) ??
      { keyword: r.keyword, mentions: 0, days: new Set<string>(), stocks: new Map() };
    a.mentions += r.mentions;
    a.days.add(r.base_date);
    (r.stocks ?? []).forEach((name, i) => a.stocks.set(name, (r.codes ?? [])[i]));
    m.set(r.keyword, a);
  }
  return [...m.values()].sort(
    (x, y) => y.mentions - x.mentions || y.days.size - x.days.size
  );
}

export default async function Page() {
  const [rows, dates] = await Promise.all([getKeywords(), getReportDates()]);

  if (!rows.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-[19px] font-bold tracking-tight">키워드보드</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          키워드는 <code>screening</code> 테이블의 테마·이슈·산업 키워드에서
          집계합니다. 아직 분석이 적재된 날짜가 없습니다.
        </div>
      </div>
    );
  }

  const covered = [...new Set(rows.map((r) => r.base_date))].sort().reverse();

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[19px] font-bold tracking-tight">키워드보드</h1>
        <span className="text-xs text-neutral-500">
          분석 {covered.length}개 거래일 누적 · {covered[covered.length - 1]} ~{" "}
          {covered[0]}
        </span>
        <span className="ml-auto text-[11px] text-neutral-400">
          전체 수집일 {dates.length}일 중 뉴스 분석이 있는 날만 집계
        </span>
      </div>

      {KINDS.map(({ key, label, hint, cls }) => {
        const list = aggregate(rows, key);
        if (!list.length) return null;
        const max = list[0].mentions;
        const tone = TONE[cls];

        return (
          <section key={key} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[15px] font-bold tracking-tight">{label}</h2>
              <span className="text-xs text-neutral-500">{hint}</span>
              <span className="ml-auto text-[11px] text-neutral-400">
                {list.length}개
              </span>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((a) => (
                <div
                  key={a.keyword}
                  className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[12px] font-bold ${tone.chip}`}
                    >
                      {a.keyword}
                    </span>
                    <span className="ml-auto text-[11px] tabular text-neutral-400">
                      {a.mentions}회 · {a.days.size}일
                    </span>
                  </div>

                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${tone.bar}`}
                      style={{ width: `${(a.mentions / max) * 100}%` }}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {[...a.stocks.entries()].slice(0, 12).map(([name, code]) => (
                      <a
                        key={name}
                        href={code ? naverLink(code) : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 hover:text-teal-700"
                      >
                        {name}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-2">
        <h2 className="text-[15px] font-bold tracking-tight">날짜별 보기</h2>
        <div className="flex flex-wrap gap-1.5">
          {covered.map((d) => (
            <Link
              key={d}
              href={`/?date=${d}`}
              className="rounded border border-[var(--line)] bg-white px-2 py-1 text-[11px] tabular text-neutral-600 hover:bg-neutral-50 hover:text-teal-700"
            >
              {d}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
