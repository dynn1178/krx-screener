import Link from "next/link";
import type { Insight } from "@/lib/insights";

const TONE_STYLE: Record<Insight["tone"], React.CSSProperties> = {
  watch: {
    borderColor: "var(--warn-line)",
    background: "var(--warn-bg)",
    color: "var(--warn-fg)",
  },
  info: {
    borderColor: "var(--line)",
    background: "var(--accent-bg)",
    color: "var(--accent-fg)",
  },
};

/**
 * 매크로 카드 값으로 자동 생성한 "오늘의 시그널".
 * compact = 홈 화면에 얹는 요약 줄 (가이드 페이지로 링크),
 * full = /guide 페이지 상단 전체 카드.
 */
export default function MacroInsights({
  insights,
  variant = "full",
}: {
  insights: Insight[];
  variant?: "compact" | "full";
}) {
  if (!insights.length) return null;

  if (variant === "compact") {
    const shown = insights.filter((i) => i.tone === "watch").slice(0, 3);
    if (!shown.length) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] px-3 py-2">
        <span className="text-[12px] font-bold text-[var(--warn-fg)]">
          오늘의 시그널
        </span>
        {shown.map((i) => (
          <Link
            key={i.id}
            href={`/guide#${i.anchor}`}
            className="rounded px-2 py-0.5 text-[12px] font-semibold text-[var(--warn-fg)] underline decoration-dotted underline-offset-2 hover:opacity-80"
            title={i.detail}
          >
            {i.icon} {i.headline}
          </Link>
        ))}
        <Link
          href="/guide"
          className="ml-auto text-[12px] font-semibold text-[var(--accent-fg)] hover:underline"
        >
          해석 가이드 전체보기 →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {insights.map((i) => (
        <a
          key={i.id}
          href={`#${i.anchor}`}
          className="flex flex-col gap-1 rounded-lg border p-3 transition hover:brightness-95"
          style={TONE_STYLE[i.tone]}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-bold leading-snug">
            <span aria-hidden="true">{i.icon}</span>
            {i.headline}
          </span>
          <span className="text-[12px] leading-relaxed opacity-90">
            {i.detail}
          </span>
        </a>
      ))}
    </div>
  );
}
