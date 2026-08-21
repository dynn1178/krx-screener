---
name: macro-guide-feature
description: 경기지표 해석 가이드(/guide) 기능 관련 코드를 수정·확장할 때 사용. "지표 추가해줘", "시그널 규칙 바꿔줘", "가이드 페이지에 ○○ 섹션 추가해줘", "인사이트가 왜 안 뜨지" 같은 요청에 적용.
---

# 경기지표 해석 가이드 (`/guide`) 아키텍처

`/guide` 페이지는 두 개의 서로 다른 성격의 콘텐츠를 한 화면에서 같이 보여준다.

1. **정적 교육 콘텐츠** — 금리 오르면 성장주 약세 같은 일반 인과관계 설명. 사람이 직접 쓴 텍스트.
2. **실시간 시그널** — `macro_daily`에 실제로 쌓인 오늘 값을 규칙에 대입해 자동 생성한 텍스트.

이 둘을 헷갈리지 않는 게 핵심이다. 정적 콘텐츠를 바꾼다고 시그널이 바뀌지 않고,
시그널 규칙을 바꾼다고 교육 콘텐츠가 바뀌지 않는다 — 완전히 별개 파일이다.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `web/src/lib/guideContent.ts` | 정적 콘텐츠. `GUIDE_SECTIONS` 배열 — 금리/환율/물가/안전자산/경기선행후행/원자재/통화량·유동성/무역·수급/부동산·신용/심리·서베이/재정·정책/산업별 특화, 총 12개 섹션. 섹션 하나당 `relations`(조건→결과 카드), `liveSeries`(연동할 series_id, 없으면 `[]`), `notCollected`(수집 안 하는 지표 안내용 라벨). |
| `web/src/lib/insights.ts` | 실시간 규칙 엔진. `buildInsights(cards: MacroCard[])` 가 `macro_daily` 최신값을 규칙에 대입해 `Insight[]`를 만든다. 각 규칙은 `if (value != null) out.push({...})` 패턴 — 값이 없으면 그냥 스킵. |
| `web/src/components/IndicatorGuide.tsx` | `guideContent.ts`를 렌더링. 섹션마다 `liveSeries`에 해당하는 카드를 실제 `MacroCard[]`에서 찾아 `LiveChip`으로 붙인다. |
| `web/src/components/MacroInsights.tsx` | `insights.ts` 결과를 렌더링. `variant="compact"`(홈 화면, watch 톤만 최대 3개 + 가이드 링크) / `variant="full"`(가이드 페이지, 전체 카드). |
| `web/src/app/guide/page.tsx` | 위 조각들을 조립. `getMacroBoard(baseDate)` 로 카드를 가져와 `IndicatorGuide`와 `buildInsights` 양쪽에 그대로 넘긴다. |
| `web/src/app/page.tsx` | 홈 화면에도 `MacroInsights variant="compact"` 를 얹어 스크리너 지표와 가이드를 연결. |

## 새 인과관계(교육 콘텐츠) 추가하기

`guideContent.ts`의 해당 섹션 `relations` 배열에 항목 추가:

```ts
{ from: "조건", to: "결과", dir: "up" | "down" | undefined, note: "예외/시차 설명" }
```

`dir`은 화살표 색만 바꾼다(`t-up`=빨강/`t-down`=파랑, 방향성 없으면 생략). 새 섹션을 통째로
추가할 때는 `id`가 페이지 앵커(`#id`)로 그대로 쓰이므로 `insights.ts`의 `anchor`와 이름을 맞출 것.

## 새 실시간 시그널(규칙) 추가하기

1. **그 지표가 실제로 수집되는지 먼저 확인** — `macro_series` 테이블 / `web/src/lib/macroMeta.ts`의
   `MACRO_DESC` 키 목록에 series_id가 있는지 본다. 없으면 규칙을 만들어도 항상 빈 카드가 된다.
   (현재 미수집: 금 현물가, 구리, PMI, 미국 주간 실업수당청구건수 — `guideContent.ts`의
   `notCollected`에 이미 안내 문구로 반영돼 있다.)
2. `insights.ts`의 `buildInsights` 안에 새 블록 추가. 패턴:
   ```ts
   const x = get("SERIES_ID"); // 또는 v("SERIES_ID")로 값만
   if (x?.value != null /* && 필요하면 x.change != null */) {
     out.push({
       id: "고유-id",
       tone: "watch" | "info",   // watch = 홈 화면 compact 요약에 노출됨
       icon: "이모지",
       headline: `...${x.value.toFixed(n)}...`,
       detail: "왜 이 시그널이 의미 있는지 + 예외/캐비어트 한 문장",
       anchor: "가이드 섹션 id",  // guideContent.ts 의 section.id 와 반드시 일치
       seriesIds: ["SERIES_ID"],
     });
   }
   ```
3. `tone: "watch"`만 홈 화면 compact 요약(`MacroInsights variant="compact"`)에 노출된다.
   너무 자주 뜨는 규칙을 watch로 넣으면 홈 화면이 항상 경고 배너로 뒤덮인다 — 정말 주의가
   필요한 상태(역전, 급등, 임계값 돌파)에만 watch를 쓰고 평범한 관찰은 info로 둔다.

## 값이 규칙에 잡히는 방식 참고

`MacroCard`(`web/src/lib/reportTypes.ts`)는 `getMacroBoard()`(`web/src/lib/queries.ts`)가
`macro_daily`에서 만들어낸다. `value`는 최신값, `change`/`changePct`는 "값이 마지막으로
실제로 바뀐 시점" 기준 직전 발표값과의 차이(주말·공휴일 forward-fill 구간은 건너뛴다).
즉 `change`가 `null`이면 최근 데이터가 갱신되지 않았다는 뜻이지 값이 없다는 뜻이 아니다 —
`value`와 `change`를 따로 null 체크해야 한다.

## 주의할 점

- `guideContent.ts`의 인과관계는 경험칙이지 항상 성립하는 법칙이 아니다. `note`에 예외/시차를
  꼭 같이 적는다 — 이게 이 가이드의 톤이다("공식이 항상 맞진 않는다"도 인사이트).
  투자 조언처럼 단정적으로 쓰지 않는다.
- 이 skill은 **코드 구조** 문서다. 도메인 지식(금리-환율-물가 인과관계 자체)을 채팅에서
  설명해야 하면 `web/src/lib/guideContent.ts`를 직접 읽어서 답한다 — 이 파일에 내용을
  중복 기재하지 않는다.
