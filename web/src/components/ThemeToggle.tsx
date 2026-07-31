"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** FOUC 방지용 — layout <head> 에서 렌더 전에 실행된다 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
    setTheme(current);
    setReady(true);
    // 전환 애니메이션은 초기 렌더 이후부터
    document.documentElement.classList.add("theme-ready");
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* 저장 실패해도 화면은 바뀐다 */
    }
  };

  return (
    <div
      className="inline-flex rounded-lg border p-0.5"
      style={{ borderColor: "var(--line)", background: "var(--card)" }}
      role="group"
      aria-label="화면 테마"
    >
      {(
        [
          ["light", "라이트", "☀"],
          ["dark", "다크", "☾"],
        ] as const
      ).map(([key, label, icon]) => {
        const active = ready && theme === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => apply(key)}
            aria-pressed={active}
            title={`${label} 모드`}
            className="rounded-md px-2.5 py-1 text-[13px] font-semibold transition"
            style={{
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--fg-subtle)",
            }}
          >
            <span aria-hidden="true">{icon}</span>
            <span className="ml-1 hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
