/**
 * 서버에서 렌더되는 인라인 SVG 스파크라인.
 * 카드 배경에 깔리므로 축·눈금 없이 추세선만 그린다.
 */
export default function Sparkline({
  values,
  rising,
  step = false,
  className = "",
}: {
  values: number[];
  rising: boolean | null;
  /** 월간 지표처럼 계단식으로 변하는 값 */
  step?: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;

  const W = 100;
  const H = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;

  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * (H - 4) - 2;

  let d = `M ${x(0).toFixed(2)} ${y(values[0]).toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    if (step) d += ` H ${x(i).toFixed(2)}`;
    d += ` L ${x(i).toFixed(2)} ${y(values[i]).toFixed(2)}`;
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`;

  // 한국 관례: 상승 빨강 / 하락 파랑 / 보합 회색
  const stroke =
    rising == null ? "#a8a29e" : rising ? "#e11d48" : "#2563eb";
  const fill =
    rising == null
      ? "rgba(168,162,158,.10)"
      : rising
        ? "rgba(225,29,72,.10)"
        : "rgba(37,99,235,.10)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <path d={area} fill={fill} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
