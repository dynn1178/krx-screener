import Link from "next/link";
import { notFound } from "next/navigation";
import StockDetail from "@/components/StockDetail";
import IssueHistory from "@/components/IssueHistory";
import { supabase } from "@/lib/supabase";
import { getAnalysisHistory } from "@/lib/queries";
import type { FundPoint, PricePoint, Snapshot } from "@/lib/types";

export const revalidate = 3600;

async function getData(ticker: string) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 3);
  const sinceIso = since.toISOString().slice(0, 10);

  const [snap, price, fund, history] = await Promise.all([
    // snapshot 은 (date, ticker) 누적이므로 가장 최근 1행만 가져온다
    supabase
      .from("snapshot")
      .select("*")
      .eq("ticker", ticker)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("daily_price")
      .select("date,open,high,low,close,volume")
      .eq("ticker", ticker)
      .gte("date", sinceIso)
      .order("date", { ascending: true }),
    supabase
      .from("daily_fundamental")
      .select("date,per,pbr")
      .eq("ticker", ticker)
      .gte("date", sinceIso)
      .order("date", { ascending: true }),
    getAnalysisHistory(ticker),
  ]);

  return {
    snap: ((snap.data ?? [])[0] ?? null) as Snapshot | null,
    price: (price.data ?? []) as PricePoint[],
    fund: (fund.data ?? []) as FundPoint[],
    history,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const { snap, price, fund, history } = await getData(ticker);

  if (!snap) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[13px]"
        style={{ color: "var(--fg-subtle)" }}
      >
        ← 목록으로
      </Link>
      <StockDetail snap={snap} price={price} fund={fund} />
      <IssueHistory rows={history} name={snap.name ?? ticker} />
    </div>
  );
}
