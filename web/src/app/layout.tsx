import type { Metadata } from "next";
import { Nanum_Gothic } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const nanumGothic = Nanum_Gothic({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-nanum-gothic",
});

export const metadata: Metadata = {
  title: "KRX 종목 스크리너",
  description: "조건 기반 국내 주식 스크리닝 · 재무 · 수급 · 뉴스",
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
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-[13px] font-bold text-white">
                K
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                KRX 종목 스크리너
              </span>
            </Link>
            <span className="ml-auto text-xs text-neutral-500">
              KRX · OpenDART · 네이버
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-5 py-6">{children}</main>
        <footer className="mx-auto max-w-[1500px] px-5 pb-10 pt-4 text-xs leading-relaxed text-neutral-400">
          투자 판단의 근거가 아닌 <strong>탐색 보조 도구</strong>입니다. 지표는 KRX
          공시 반영 기준으로 시차가 있을 수 있습니다.
        </footer>
      </body>
    </html>
  );
}
