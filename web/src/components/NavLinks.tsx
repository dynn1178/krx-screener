"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "일별 리포트" },
  { href: "/keywords", label: "키워드보드" },
  { href: "/calendar", label: "급등 캘린더" },
  { href: "/news", label: "뉴스" },
  { href: "/screener", label: "조건 스크리너" },
  { href: "/guide", label: "경기지표 가이드" },
  { href: "/trends", label: "키워드 추이" },
  { href: "/links", label: "증시 사이트" },
];

export default function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // 페이지 이동 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 바깥 클릭 / ESC 로 닫기 — DatePicker와 동일한 패턴
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkStyle = (href: string): React.CSSProperties =>
    isActive(href)
      ? { background: "var(--accent-bg)", color: "var(--accent-fg)" }
      : { color: "var(--fg-subtle)" };

  return (
    <>
      {/* 데스크톱 — lg 이상에서만 인라인 링크 */}
      <nav className="hidden items-center gap-0.5 lg:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded px-2.5 py-1.5 text-[14px] font-semibold transition"
            style={linkStyle(l.href)}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* 모바일 — 햄버거 버튼 + 드롭다운 패널 */}
      <div className="relative lg:hidden" ref={boxRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="메뉴 열기"
          className="grid h-9 w-9 place-items-center rounded border text-[16px]"
          style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--fg-muted)" }}
        >
          {open ? "✕" : "☰"}
        </button>

        {open && (
          <div
            className="absolute left-0 top-11 z-50 grid w-[260px] grid-cols-2 gap-1 rounded-lg border p-2 shadow-lg"
            style={{ borderColor: "var(--line)", background: "var(--card)" }}
          >
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded px-2.5 py-2.5 text-center text-[14px] font-semibold transition"
                style={linkStyle(l.href)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
