/**
 * 서버에서 렌더되는 인라인 SVG 스파크라인.
 * 카드 배경에 깔리므로 축·눈금 없이 추세선만 그린다.
 * 색은 CSS 변수를 쓰므로 다크모드에서 자동으로 바뀐다.
 */
export default function Sparkline({
  values,
  rising,
  className = "",
}: {
  values: number[];
  rising: boolean | null;
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
    d += ` L ${x(i).toFixed(2)} ${y(values[i]).toFixed(2)}`;
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`;

  const stroke =
    rising == null ? "var(--flat)" : rising ? "var(--up)" : "var(--down)";
  const fill =
    rising == null
      ? "color-mix(in srgb, var(--flat) 14%, transparent)"
      : rising
        ? "color-mix(in srgb, var(--up) 14%, transparent)"
        : "color-mix(in srgb, var(--down) 14%, transparent)";

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
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
