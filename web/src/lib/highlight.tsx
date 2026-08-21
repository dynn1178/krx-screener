import type { CSSProperties, ReactNode } from "react";

type Tag = "up" | "down" | "mark";

/** 매수·상승 뉘앙스 — 굵게 + 빨강(한국 관례) */
const UP_WORDS: string[] = [
  "매수세",
  "순매수전환",
  "매수전환",
  "저가매수",
  "매수우위",
  "순매수",
  "매수",
  "사들이며",
  "사들였다",
  "사들이는",
  "사자",
  "급등",
  "폭등",
  "반등",
  "강세",
  "랠리",
  "유입",
  "호재",
];

/** 매도·하락 뉘앙스 — 굵게 + 파랑(한국 관례) */
const DOWN_WORDS: string[] = [
  "매도세",
  "순매도전환",
  "매도전환",
  "매도우위",
  "순매도",
  "손절매",
  "손절",
  "투매",
  "매도",
  "내다팔며",
  "팔아치우며",
  "팔자",
  "차익실현",
  "급락",
  "폭락",
  "속락",
  "약세",
  "유출",
  "악재",
];

/** 방향성은 없지만 눈에 띄어야 하는 표현 — 굵게 + 하이라이트 배경 */
const MARK_WORDS: string[] = [
  "사상 최고",
  "사상최고",
  "역대 최대",
  "어닝서프라이즈",
  "서프라이즈",
  "어닝쇼크",
  "쇼크",
  "패닉",
  "경계감",
  "우려",
  "기대감",
  "주목",
  "변수",
  "리스크",
];

const WORD_TAG = new Map<string, Tag>([
  ...UP_WORDS.map((w): [string, Tag] => [w, "up"]),
  ...DOWN_WORDS.map((w): [string, Tag] => [w, "down"]),
  ...MARK_WORDS.map((w): [string, Tag] => [w, "mark"]),
]);

// 긴 단어부터 매칭해야 "매수세"가 "매수"로 잘려 매칭되지 않는다
const ALL_WORDS = [...WORD_TAG.keys()].sort((a, b) => b.length - a.length);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERN = new RegExp(
  `(${ALL_WORDS.map(escapeRe).join("|")}|[+-]?\\d+(?:\\.\\d+)?%)`,
  "g"
);

const styleOf = (tag: Tag): CSSProperties =>
  tag === "up"
    ? { color: "var(--up)", fontWeight: 700 }
    : tag === "down"
      ? { color: "var(--down)", fontWeight: 700 }
      : {
          color: "var(--warn-fg)",
          background: "var(--warn-bg)",
          fontWeight: 700,
          borderRadius: 3,
          padding: "0 3px",
        };

/**
 * 시황·브리핑·이슈 서술 문장에서 매수/매도/등락률/주목 표현을 굵게 강조한다.
 * whitespace-pre-line 부모 안에서 써야 원래 줄바꿈이 유지된다.
 */
export function highlightText(text: string | null | undefined): ReactNode {
  if (!text) return text;

  const parts = text.split(PATTERN);
  return parts.map((part, i) => {
    // split 은 캡처 그룹이 하나면 [평문, 매치, 평문, 매치, ...] 순서로 돌려준다
    if (i % 2 === 0) return part;

    const isPct = /%$/.test(part);
    const tag: Tag = isPct
      ? part.trim().startsWith("-")
        ? "down"
        : "up"
      : (WORD_TAG.get(part) ?? "mark");

    return (
      <strong key={i} style={styleOf(tag)}>
        {part}
      </strong>
    );
  });
}
