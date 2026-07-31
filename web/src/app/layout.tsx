import type { Metadata } from "next";
import { Nanum_Gothic } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import ThemeToggle, { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";

const nanumGothic = Nanum_Gothic({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-nanum-gothic",
});

export const metadata: Metadata = {
  title: "국내 증시 일별 분석",
  description:
    "매크로 지표 · 일별 시황 · 종목 스크리닝 · 키워드보드 · 급등 캘린더",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전에 테마를 적용해 깜빡임을 막는다 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={nanumGothic.variable}>
        <header
          className="sticky top-0 z-40 border-b backdrop-blur"
          style={{
            borderColor: "var(--line)",
            background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          }}
        >
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-md text-[15px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                K
              </span>
              <span className="text-[17px] font-bold tracking-tight">
                국내 증시 일별 분석
              </span>
            </Link>

            <NavLinks />

            <div className="ml-auto flex items-center gap-3">
              <span
                className="hidden text-[13px] xl:block"
                style={{ color: "var(--fg-subtle)" }}
              >
                KRX · FRED · 한국은행 · OpenDART · 네이버
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-5 py-6">{children}</main>

        <footer
          className="mx-auto max-w-[1600px] px-5 pb-10 pt-4 text-[13px] leading-relaxed"
          style={{ color: "var(--fg-subtle)" }}
        >
          모든 수치는 Supabase에 적재된 수집 결과를 그대로 표시합니다. 투자
          판단의 근거가 아닌 <strong>탐색 보조 도구</strong>이며, 밸류에이션
          지표는 KRX 공시 반영 기준이라 시차가 있을 수 있습니다.
        </footer>
      </body>
    </html>
  );
}
