/** 라벨:값을 한 줄로 나열 — 데스크톱 테이블 칸, 모바일 카드 양쪽에서 공유 */
export default function StatRow({
  label,
  value,
  valueClassName = "",
  title,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" title={title}>
      <span
        className="shrink-0 whitespace-nowrap text-[11px]"
        style={{ color: "var(--fg-subtle)" }}
      >
        {label}
      </span>
      <span className={`tabular whitespace-nowrap text-[13px] ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}
