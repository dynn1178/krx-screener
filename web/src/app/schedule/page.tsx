import { getCalendarEvents } from "@/lib/queries";
import type { CalendarEvent } from "@/lib/reportTypes";

export const revalidate = 1800;

const KIND_META: Record<string, { label: string; cls: string }> = {
  macro: { label: "경제지표", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  earnings: { label: "실적", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  policy: { label: "통화정책", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  dividend: { label: "배당", cls: "bg-[var(--warn-bg)] text-amber-700 border-[var(--warn-line)]" },
  ipo: { label: "공모주", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  expiry: { label: "만기", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  holiday: { label: "휴장", cls: "bg-[var(--card-2)] text-[var(--fg-muted)] border-[var(--line)]" },
};

const REGION: Record<string, string> = { KR: "국내", US: "미국", GLOBAL: "글로벌" };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function groupByDate(events: CalendarEvent[]) {
  const m = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const g = m.get(e.event_date) ?? [];
    g.push(e);
    m.set(e.event_date, g);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default async function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

  const events = await getCalendarEvents(from, to);
  const days = groupByDate(events);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[19px] font-bold tracking-tight">증시 캘린더</h1>
        <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
          경제지표 발표 · 실적발표 · 통화정책 · 만기일 일정
        </p>
      </div>

      {days.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-bg)] p-5 text-sm leading-relaxed text-[var(--warn-fg)]">
            <p className="font-semibold">
              아직 일정 데이터가 없습니다 (market_calendar 테이블이 비어 있음).
            </p>
            <p className="mt-2">
              토스증권 증시 캘린더를 자동으로 긁어오는 방식은 쓰지 않았습니다.
              화면에 보이는 컨센서스·예측치는 토스가 데이터 벤더에서 라이선스로
              받아오는 값이라, 크롤링이 기술적으로 가능한 것과 그 데이터를 다른
              사이트에 재게시해도 되는지는 별개 문제이기 때문입니다.
            </p>
            <p className="mt-2">
              대신 <code>market_calendar</code> 테이블을 만들어 뒀습니다. 아래
              소스로 직접 채우면 같은 화면을 합법적으로 운영할 수 있습니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>FRED releases API</strong> — 미국 CPI·고용·FOMC 등 지표
                발표일. 토스가 보여주는 미국 일정 상당수의 원천이고, 이미 가지고
                계신 FRED 키로 무료 조회됩니다.
              </li>
              <li>
                <strong>규칙 계산</strong> — 선물옵션 만기일(매월 둘째 목요일),
                배당락일, KRX 휴장일.
              </li>
              <li>
                <strong>DART API</strong> — 정기보고서 제출로 실적발표 시점 추적
                (사후 공시라 &quot;예정일&quot;은 아님).
              </li>
              <li>
                <strong>수동 입력</strong> — 한국은행 금통위·FOMC는 연 8회
                고정이라 연 1회만 넣으면 됩니다.
              </li>
            </ul>
          </div>

          <a
            href="https://www.tossinvest.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-3 hover:bg-[var(--card-2)]"
          >
            <div>
              <div className="text-[14px] font-bold">
                토스증권 증시 캘린더에서 보기 ↗
              </div>
              <div className="mt-0.5 text-[12px] text-[var(--fg-subtle)]">
                컨센서스·예측치까지 포함된 전체 일정은 토스증권에서 확인하세요.
              </div>
            </div>
            <span className="text-[var(--fg-subtle)]">→</span>
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {days.map(([date, list]) => {
            const d = new Date(`${date}T00:00:00Z`);
            const isToday = date === today;
            const isPast = date < today;
            return (
              <div
                key={date}
                className={`overflow-hidden rounded-lg border bg-[var(--card)] ${
                  isToday ? "border-[var(--accent)]" : "border-[var(--line)]"
                } ${isPast ? "opacity-60" : ""}`}
              >
                <div
                  className={`flex items-center gap-2 px-4 py-2 ${
                    isToday ? "bg-[var(--accent-bg)]" : "bg-[var(--card-2)]"
                  }`}
                >
                  <span className="text-[14px] font-bold tabular">
                    {date} ({WEEK[d.getUTCDay()]})
                  </span>
                  {isToday && (
                    <span className="rounded bg-[var(--accent)] px-1.5 py-px text-[12px] font-bold text-white">
                      오늘
                    </span>
                  )}
                  <span className="ml-auto text-[12px] text-[var(--fg-subtle)]">
                    {list.length}건
                  </span>
                </div>

                <ul className="divide-y divide-[var(--line)]">
                  {list.map((e) => {
                    const meta = KIND_META[e.kind] ?? {
                      label: e.kind,
                      cls: "bg-[var(--card-2)] text-[var(--fg-muted)] border-[var(--line)]",
                    };
                    return (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-baseline gap-2 px-4 py-2"
                      >
                        <span
                          className={`rounded border px-1.5 py-px text-[12px] font-medium ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[12px] text-[var(--fg-subtle)]">
                          {REGION[e.region] ?? e.region}
                        </span>
                        <span className="text-[14px] font-medium text-[var(--fg)]">
                          {e.source_url ? (
                            <a
                              href={e.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[var(--accent-fg)] hover:underline"
                            >
                              {e.title}
                            </a>
                          ) : (
                            e.title
                          )}
                        </span>
                        {e.detail && (
                          <span className="text-[12px] text-[var(--fg-subtle)]">
                            {e.detail}
                          </span>
                        )}
                        {e.importance >= 3 && (
                          <span className="rounded bg-[var(--up)] px-1 py-px text-[11px] font-bold text-white">
                            중요
                          </span>
                        )}
                        {e.source && (
                          <span className="ml-auto text-[12px] text-[var(--fg-subtle)]">
                            {e.source}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
