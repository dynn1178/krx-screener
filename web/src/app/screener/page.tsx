import Screener from "@/components/Screener";
import { supabase } from "@/lib/supabase";
import type { Snapshot } from "@/lib/types";

// 수집이 하루 1회이므로 1시간 캐시
export const revalidate = 3600;

async function getSnapshot(): Promise<Snapshot[]> {
  const rows: Snapshot[] = [];
  const PAGE = 1000;

  // Supabase는 1회 최대 1000행 → 페이지네이션
  for (let from = 0; from < 5000; from += PAGE) {
    const { data, error } = await supabase
      .from("snapshot")
      .select("*")
      .order("market_cap", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    rows.push(...(data as Snapshot[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

export default async function Page() {
  let rows: Snapshot[] = [];
  let error: string | null = null;

  try {
    rows = await getSnapshot();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !rows.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-base font-semibold text-amber-900">
          데이터가 없습니다
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-800">
          {error ?? "snapshot 테이블이 비어 있습니다."}
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-amber-800">
          <li>Supabase SQL Editor에서 <code>schema.sql</code> 실행</li>
          <li>
            GitHub → Actions → <strong>KRX 데이터 수집</strong> →{" "}
            <strong>Run workflow</strong> → mode: <code>backfill</code>
          </li>
          <li>Vercel 환경변수(NEXT_PUBLIC_SUPABASE_URL / ANON_KEY) 확인</li>
        </ol>
      </div>
    );
  }

  const sectors = Array.from(
    new Set(rows.map((r) => r.sector).filter((s): s is string => !!s))
  ).sort();

  return <Screener rows={rows} sectors={sectors} baseDate={rows[0].date} />;
}
