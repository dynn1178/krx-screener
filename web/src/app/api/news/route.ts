import { NextResponse } from "next/server";
import type { NewsItem } from "@/lib/types";

const ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

const strip = (s = "") =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();

export async function GET(req: Request) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;

  if (!id || !secret)
    return NextResponse.json(
      { error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 없습니다." },
      { status: 200 }
    );

  const q = new URL(req.url).searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q 파라미터 없음" }, { status: 400 });

  const url = `${ENDPOINT}?query=${encodeURIComponent(`${q} 주가`)}&display=15&sort=date`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": id,
        "X-Naver-Client-Secret": secret,
      },
      next: { revalidate: 1800 }, // 30분 캐시
    });

    if (!res.ok)
      return NextResponse.json(
        { error: `네이버 API 오류 (${res.status})` },
        { status: 200 }
      );

    const json = await res.json();

    const items: NewsItem[] = (json.items ?? []).map((it: any) => ({
      title: strip(it.title),
      description: strip(it.description),
      link: it.originallink || it.link,
      pubDate: it.pubDate ? new Date(it.pubDate).toLocaleString("ko-KR") : "",
    }));

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "뉴스 조회 실패" },
      { status: 200 }
    );
  }
}
