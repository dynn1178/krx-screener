import Link from "next/link";
import { notFound } from "next/navigation";
import StockDetail from "@/components/StockDetail";
import { supabase } from "@/lib/supabase";
import type { FundPoint, PricePoint, Snapshot } from "@/lib/types";

export const revalidate = 3600;

async function getData(ticker: string) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 3);
  const sinceIso = since.toISOString().slice(0, 10);

  const [snap, price, fund] = await Promise.all([
    supabase.from("snapshot").select("*").eq("ticker", ticker).maybeSingle(),
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
  ]);

  return {
    snap: snap.data as Snapshot | null,
    price: (price.data ?? []) as PricePoint[],
    fund: (fund.data ?? []) as FundPoint[],
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const { snap, price, fund } = await getData(ticker);

  if (!snap) notFound();

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-teal-700"
      >
        ← 목록으로
      </Link>
      <StockDetail snap={snap} price={price} fund={fund} />
    </div>
  );
}
