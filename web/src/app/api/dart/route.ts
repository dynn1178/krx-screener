import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Financials } from "@/lib/types";

const FINSTATE = "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json";
const REPRT_ANNUAL = "11011"; // 사업보고서

const ACCOUNTS = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"];

// 응답의 3개년 컬럼 → 기준연도 대비 오프셋
const TERMS: [string, number][] = [
  ["thstrm_amount", 0],
  ["frmtrm_amount", -1],
  ["bfefrmtrm_amount", -2],
];

type DartRow = {
  fs_div?: string;
  account_nm: string;
  thstrm_amount?: string;
  frmtrm_amount?: string;
  bfefrmtrm_amount?: string;
};

const toNum = (v?: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n / 1e8 : null; // 억원
};

async function fetchYear(corp: string, year: number, key: string) {
  const url = `${FINSTATE}?crtfc_key=${key}&corp_code=${corp}&bsns_year=${year}&reprt_code=${REPRT_ANNUAL}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== "000" || !json.list?.length) return null;
  return json.list as DartRow[];
}

export async function GET(req: Request) {
  const key = process.env.DART_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "DART_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 200 }
    );

  const ticker = new URL(req.url).searchParams.get("ticker");
  if (!ticker)
    return NextResponse.json({ error: "ticker 파라미터 없음" }, { status: 400 });

  // 종목코드 → DART 고유번호 (collector가 stocks 테이블에 채워둠)
  const { data: stockRow } = await supabase
    .from("stocks")
    .select("dart_corp_code")
    .eq("ticker", ticker)
    .maybeSingle();

  const corp = stockRow?.dart_corp_code;
  if (!corp)
    return NextResponse.json(
      { error: "DART 고유번호가 없습니다. collector를 --mode master로 실행하세요." },
      { status: 200 }
    );

  const now = new Date();
  // 사업보고서는 통상 3월 제출 → 4월 이전이면 최신 보고서는 재작년 것
  const latest = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;

  // 1회 호출 = 3개년(당기/전기/전전기) → 2회로 6개년 커버, 여기선 최근 4개년만 사용
  const bases = [latest, latest - 3];
  const raws = await Promise.all(bases.map((y) => fetchYear(corp, y, key)));

  const byYear: Record<string, Record<string, number | null>> = {};

  // 기준연도와 응답을 쌍으로 유지 (null 필터링 시 인덱스가 어긋나지 않도록)
  bases.forEach((base, idx) => {
    const raw = raws[idx];
    if (!raw) return;

    // 연결(CFS) 우선, 없으면 별도(OFS)
    const hasCfs = raw.some((r) => r.fs_div === "CFS");
    const rows = hasCfs ? raw.filter((r) => r.fs_div === "CFS") : raw;

    for (const [col, offset] of TERMS) {
      const y = String(base + offset);
      if (byYear[y]) continue;

      const bucket: Record<string, number | null> = {};
      let any = false;
      for (const acct of ACCOUNTS) {
        const hit = rows.find((r) => r.account_nm === acct);
        const v = toNum(hit?.[col as keyof DartRow] as string | undefined);
        bucket[acct] = v;
        if (v != null) any = true;
      }
      if (any) byYear[y] = bucket;
    }
  });

  const years = Object.keys(byYear).sort().slice(-4);
  if (!years.length)
    return NextResponse.json({ error: "재무 데이터를 찾지 못했습니다." }, { status: 200 });

  const accounts: Financials["accounts"] = {};
  for (const acct of ACCOUNTS) {
    accounts[acct] = years.map((y) => byYear[y][acct] ?? null);
  }

  // 파생 지표
  const derive = (
    label: string,
    fn: (y: Record<string, number | null>) => number | null
  ) => {
    accounts[label] = years.map((y) => fn(byYear[y]));
  };
  derive("영업이익률(%)", (y) =>
    y["매출액"] && y["영업이익"] != null && y["매출액"] > 0
      ? (y["영업이익"]! / y["매출액"]!) * 100
      : null
  );
  derive("ROE(%)", (y) =>
    y["자본총계"] && y["당기순이익"] != null && y["자본총계"] > 0
      ? (y["당기순이익"]! / y["자본총계"]!) * 100
      : null
  );
  derive("부채비율(%)", (y) =>
    y["자본총계"] && y["부채총계"] != null && y["자본총계"] > 0
      ? (y["부채총계"]! / y["자본총계"]!) * 100
      : null
  );

  // YoY 성장률
  const growth: Financials["growth"] = {};
  if (years.length >= 2) {
    const last = years.length - 1;
    for (const [acct, label] of [
      ["매출액", "매출 YoY"],
      ["영업이익", "영업이익 YoY"],
      ["당기순이익", "순이익 YoY"],
    ] as const) {
      const c = accounts[acct]?.[last];
      const p = accounts[acct]?.[last - 1];
      if (c != null && p != null && p > 0) growth[label] = (c / p - 1) * 100;
    }
  }

  return NextResponse.json({ years, accounts, growth } satisfies Financials);
}
