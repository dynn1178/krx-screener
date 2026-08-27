# 적용 안내

DB 변경은 **이미 KRX 프로젝트(`foarepewnnvichebxwvl`)에 반영 완료**했습니다.
아래는 웹 코드 쪽에서 하실 일입니다.

## 1. 파일 배치

```
web/src/lib/trendTypes.ts            새 파일
web/src/lib/trendQueries.ts          새 파일  ← import 경로만 확인 필요
web/src/components/TrendLineChart.tsx    새 파일
web/src/components/TrendsClient.tsx      새 파일
web/src/components/ThemeDriftAlerts.tsx  새 파일
web/src/app/trends/page.tsx              새 파일
web/src/app/trends.css                   globals.css 끝에 붙이거나 layout 에서 import
```

`trendQueries.ts` 첫 줄의 `import { supabase } from "./supabaseClient"` 만
기존 `queries.ts` 가 쓰는 클라이언트 경로에 맞춰 고쳐주세요. 나머지는 그대로 동작합니다.

외부 차트 라이브러리를 쓰지 않습니다 — 인라인 SVG라 설치할 의존성이 없습니다.

## 2. 탭 추가

기존 네비게이션에 한 줄 추가:

```tsx
<Link href="/trends">키워드 추이</Link>
```

승인 대기 배지를 달고 싶으면:

```tsx
import { getDriftReadyCount } from "@/lib/trendQueries";
const ready = await getDriftReadyCount();
// {ready > 0 && <span className="badge">{ready}</span>}
```

## 3. 확인

```
/trends            → 기본 1개월
/trends?days=7     → 1주
/trends?days=180   → 6개월
/trends?days=365   → 1년
```

## 문서

- `docs/theme-keyword-system.md` — 테마 고정·정규화·변동감지 체계 전체 설명
- `docs/daily-guideline-patch.md` — 일별 분석 프롬프트에 반영할 변경분

## 미리보기

실데이터가 들어간 동작 화면: https://claude.ai/code/artifact/90f5e6e1-c20f-4562-9331-5ead9b255de4
