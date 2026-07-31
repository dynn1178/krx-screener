"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { ReportDate } from "@/lib/reportTypes";

export default function DateSwitcher({
  dates,
  current,
}: {
  dates: ReportDate[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const idx = dates.findIndex((d) => d.base_date === current);
  const go = (date: string) =>
    start(() => router.push(`${pathname}?date=${date}`));

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={idx < 0 || idx >= dates.length - 1 || pending}
        onClick={() => go(dates[idx + 1].base_date)}
        className="grid h-7 w-7 place-items-center rounded border border-[var(--line)] bg-white text-neutral-600 disabled:opacity-30"
        aria-label="이전 거래일"
      >
        ‹
      </button>

      <select
        value={current}
        disabled={pending}
        onChange={(e) => go(e.target.value)}
        className="h-7 rounded border border-[var(--line)] bg-white px-2 text-xs font-semibold tabular"
        aria-label="기준일자 선택"
      >
        {dates.map((d) => (
          <option key={d.base_date} value={d.base_date}>
            {d.base_date}
            {d.has_screening || d.has_commentary || d.has_summary ? "" : " (시세만)"}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={idx <= 0 || pending}
        onClick={() => go(dates[idx - 1].base_date)}
        className="grid h-7 w-7 place-items-center rounded border border-[var(--line)] bg-white text-neutral-600 disabled:opacity-30"
        aria-label="다음 거래일"
      >
        ›
      </button>
    </div>
  );
}
