export const eok = (v: number | null | undefined) =>
  v == null ? "-" : Math.round(v / 1e8).toLocaleString("ko-KR");

export const pct = (v: number | null | undefined, sign = false) =>
  v == null ? "-" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  v == null ? "-" : v.toFixed(digits);

export const int = (v: number | null | undefined) =>
  v == null ? "-" : Math.round(v).toLocaleString("ko-KR");

/** 한국 관례: 상승 빨강 / 하락 파랑 */
export const trend = (v: number | null | undefined) =>
  v == null
    ? "text-neutral-400"
    : v > 0
      ? "text-rose-600"
      : v < 0
        ? "text-blue-600"
        : "text-neutral-500";
