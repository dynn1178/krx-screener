"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * 월 그리드 팝오버 날짜 선택기. 모든 페이지 상단에서 공유한다.
 * 데이터가 있는 날짜만 선택 가능하고, 없는 날은 흐리게 표시한다.
 */
export default function DatePicker({
  dates,
  current,
}: {
  /** 선택 가능한 날짜(YYYY-MM-DD) 목록 */
  dates: string[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const available = useMemo(() => new Set(dates), [dates]);
  const sorted = useMemo(() => [...dates].sort(), [dates]);
  const idx = sorted.indexOf(current);

  const [view, setView] = useState(() => ({
    y: Number(current.slice(0, 4)),
    m: Number(current.slice(5, 7)),
  }));

  // 기준일이 바뀌면 보고 있는 달도 따라간다
  useEffect(() => {
    setView({ y: Number(current.slice(0, 4)), m: Number(current.slice(5, 7)) });
  }, [current]);

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (date: string) => {
    if (date === current) return setOpen(false);
    const next = new URLSearchParams(params.toString());
    next.set("date", date);
    setOpen(false);
    start(() => router.push(`${pathname}?${next.toString()}`));
  };

  const cells = useMemo(() => {
    const { y, m } = view;
    const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const shiftMonth = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });

  const label = (() => {
    const d = new Date(`${current}T00:00:00Z`);
    return `${current.slice(0, 4)}년 ${Number(current.slice(5, 7))}월 ${Number(
      current.slice(8, 10)
    )}일 (${WEEK[d.getUTCDay()]})`;
  })();

  return (
    <div className="relative flex items-center gap-1" ref={boxRef}>
      <button
        type="button"
        disabled={idx <= 0 || pending}
        onClick={() => go(sorted[idx - 1])}
        className="grid h-8 w-7 place-items-center rounded border border-[var(--line)] bg-white text-neutral-600 disabled:opacity-30"
        aria-label="이전 거래일"
      >
        ‹
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        className="flex h-8 items-center gap-2 rounded border border-[var(--line)] bg-white px-3 text-[13px] font-semibold tabular hover:bg-neutral-50"
      >
        <span aria-hidden="true">🗓</span>
        {label}
        <span className="text-[10px] text-neutral-400">▾</span>
      </button>

      <button
        type="button"
        disabled={idx < 0 || idx >= sorted.length - 1 || pending}
        onClick={() => go(sorted[idx + 1])}
        className="grid h-8 w-7 place-items-center rounded border border-[var(--line)] bg-white text-neutral-600 disabled:opacity-30"
        aria-label="다음 거래일"
      >
        ›
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-[268px] rounded-lg border border-[var(--line)] bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-6 w-6 place-items-center rounded text-neutral-500 hover:bg-neutral-100"
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className="text-[13px] font-bold tabular">
              {view.y}년 {view.m}월
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-6 w-6 place-items-center rounded text-neutral-500 hover:bg-neutral-100"
              aria-label="다음 달"
            >
              ›
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-y-1">
            {WEEK.map((w, i) => (
              <div
                key={w}
                className={`py-1 text-center text-[11px] font-medium ${
                  i === 0
                    ? "text-rose-500"
                    : i === 6
                      ? "text-blue-500"
                      : "text-neutral-400"
                }`}
              >
                {w}
              </div>
            ))}

            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const iso = ymd(view.y, view.m, d);
              const has = available.has(iso);
              const isCur = iso === current;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!has}
                  onClick={() => go(iso)}
                  className={`mx-auto grid h-7 w-7 place-items-center rounded text-[12px] tabular transition ${
                    isCur
                      ? "bg-teal-700 font-bold text-white"
                      : has
                        ? "font-semibold text-neutral-800 hover:bg-teal-50"
                        : "text-neutral-300"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-3 border-t border-[var(--line)] pt-2 text-[10px] text-neutral-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-teal-700" />
              데이터 있음
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-neutral-200" />
              없음
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
