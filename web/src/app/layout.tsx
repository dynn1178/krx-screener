import type { Metadata } from "next";
import { Nanum_Gothic } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import NavLinks from "@/components/NavLinks";

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
    <html lang="ko">
      <body className={nanumGothic.variable}>
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-[13px] font-bold text-white">
                K
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                국내 증시 일별 분석
              </span>
            </Link>

            <NavLinks />

            <span className="ml-auto hidden text-xs text-neutral-500 lg:block">
              KRX · FRED · 한국은행 · OpenDART · 네이버
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-5 py-6">{children}</main>

        <footer className="mx-auto max-w-[1500px] px-5 pb-10 pt-4 text-xs leading-relaxed text-neutral-400">
          모든 수치는 Supabase에 적재된 수집 결과를 그대로 표시합니다. 투자
          판단의 근거가 아닌 <strong>탐색 보조 도구</strong>이며, 밸류에이션
          지표는 KRX 공시 반영 기준이라 시차가 있을 수 있습니다.
        </footer>
      </body>
    </html>
  );
}
