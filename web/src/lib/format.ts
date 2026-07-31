export const eok = (v: number | null | undefined) =>
  v == null ? "-" : Math.round(v / 1e8).toLocaleString("ko-KR");

export const pct = (v: number | null | undefined, sign = false) =>
  v == null ? "-" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  v == null ? "-" : v.toFixed(digits);

export const int = (v: number | null | undefined) =>
  v == null ? "-" : Math.round(v).toLocaleString("ko-KR");

/**
 * 한국 관례: 상승 빨강 / 하락 파랑.
 * 다크모드까지 한 번에 대응하려고 globals.css 의 토큰 유틸을 돌려준다.
 */
export const trend = (v: number | null | undefined) =>
  v == null ? "t-flat" : v > 0 ? "t-up" : v < 0 ? "t-down" : "t-flat";

/** 등락 방향 → 배경/테두리에 쓸 CSS 변수 */
export const trendVar = (v: number | null | undefined) =>
  v == null || v === 0 ? "var(--flat)" : v > 0 ? "var(--up)" : "var(--down)";

// ── 일별 리포트용 ────────────────────────────────────────

/** 원 단위 정수를 조/억 으로 축약. 원본은 항상 원 단위로 보존한다. */
export const wonShort = (v: number | null | undefined) => {
  if (v == null) return "-";
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e12) s = `${(a / 1e12).toFixed(a >= 1e13 ? 1 : 2)}조`;
  else if (a >= 1e8) s = `${Math.round(a / 1e8).toLocaleString("ko-KR")}억`;
  else if (a >= 1e4) s = `${Math.round(a / 1e4).toLocaleString("ko-KR")}만`;
  else s = a.toLocaleString("ko-KR");
  return neg ? `-${s}` : s;
};

/** 원 단위 정수 전체 표기 (툴팁·검증용) */
export const wonFull = (v: number | null | undefined) =>
  v == null ? "-" : `${Math.round(v).toLocaleString("ko-KR")}원`;

export const pct2 = (v: number | null | undefined, sign = true) =>
  v == null ? "-" : `${sign && v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export const signed = (v: number | null | undefined, digits = 2) =>
  v == null ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;

/** 매크로 값 — 단위별로 자릿수를 달리한다 */
export const macroValue = (
  v: number | null | undefined,
  unit: string
): string => {
  if (v == null) return "-";
  switch (unit) {
    case "%":
    case "%p":
    case "연%":
      return v.toFixed(2);
    case "십억원":
      return Math.round(v).toLocaleString("ko-KR");
    case "2020=100":
      return v.toFixed(1);
    case "원":
      return v.toLocaleString("ko-KR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    default:
      return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  }
};

/** 단위 뒤에 붙일 접미사 (값 표기에 이미 포함된 경우는 빈 문자열) */
export const unitSuffix = (unit: string) => {
  switch (unit) {
    case "%":
    case "연%":
      return "%";
    case "%p":
      return "%p";
    case "원":
      return "원";
    case "USD":
      return "$";
    case "십억원":
      return "십억";
    default:
      return "";
  }
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export const dateKo = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(`${iso}T00:00:00Z`);
  return `${iso} (${WEEKDAY[d.getUTCDay()]})`;
};

export const monthKo = (iso: string | null | undefined) =>
  !iso ? "-" : `${iso.slice(0, 4)}년 ${Number(iso.slice(5, 7))}월`;

export const stampKo = (ts: string | null | undefined) => {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
