"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "일별 리포트" },
  { href: "/keywords", label: "키워드보드" },
  { href: "/calendar", label: "급등 캘린더" },
  { href: "/news", label: "뉴스" },
  { href: "/schedule", label: "증시 캘린더" },
  { href: "/screener", label: "조건 스크리너" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {LINKS.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className="rounded px-2.5 py-1.5 text-[14px] font-semibold transition"
            style={
              active
                ? { background: "var(--accent-bg)", color: "var(--accent-fg)" }
                : { color: "var(--fg-subtle)" }
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
