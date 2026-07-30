"""
KRX 데이터 수집기 → Supabase 적재
════════════════════════════════════════════════════════════════
GitHub Actions(평일 16:30 KST) 또는 로컬에서 실행합니다.

  python collect.py --mode daily            # 오늘(최근 영업일) 1일치
  python collect.py --mode backfill --days 400   # 과거 N일 채우기 (최초 1회)
  python collect.py --mode master           # 종목명/업종/DART코드만 갱신

pykrx 의 '전 종목 일괄 조회' 만 사용합니다.
  · 종목별 루프 = 2,700회 호출 → 수십 분
  · 일자별 일괄 = 1일당 3회 호출 → 수 초
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

import pandas as pd
import requests
from pykrx import stock
from supabase import Client, create_client

# ────────────────────────────────────────────── 환경변수
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DART_API_KEY = os.environ.get("DART_API_KEY", "")

CHUNK = 1000          # Supabase upsert 배치 크기
KOSPI_INDEX = "1001"


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def sb() -> Client:
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        sys.exit("❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 없습니다.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def upsert(client: Client, table: str, rows: list[dict]) -> int:
    """청크 단위 upsert"""
    total = 0
    for i in range(0, len(rows), CHUNK):
        batch = rows[i : i + CHUNK]
        client.table(table).upsert(batch).execute()
        total += len(batch)
    return total


def clean_num(v, as_int: bool = False):
    """NaN/inf → None, 숫자 → int/float"""
    if v is None or pd.isna(v):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return int(f) if as_int else round(f, 4)


# ══════════════════════════════════════════════ 영업일
def business_days(frm: str, to: str) -> list[str]:
    try:
        days = stock.get_previous_business_days(fromdate=frm, todate=to)
        return [d.strftime("%Y%m%d") for d in days]
    except Exception:
        # 폴백: 달력일을 순회하며 데이터 유무로 판단
        out, cur = [], datetime.strptime(frm, "%Y%m%d")
        end = datetime.strptime(to, "%Y%m%d")
        while cur <= end:
            if cur.weekday() < 5:
                out.append(cur.strftime("%Y%m%d"))
            cur += timedelta(days=1)
        return out


def latest_business_day() -> str:
    return stock.get_nearest_business_day_in_a_week()


# ══════════════════════════════════════════════ 1. 종목 마스터
def fetch_sector_map() -> dict:
    try:
        import FinanceDataReader as fdr

        listing = fdr.StockListing("KRX")
    except Exception as e:
        log(f"⚠️  업종 조회 실패 (건너뜀): {e}")
        return {}

    code_col = next((c for c in ["Code", "Symbol", "종목코드"] if c in listing.columns), None)
    sec_col = next((c for c in ["Sector", "Industry", "업종"] if c in listing.columns), None)
    if not code_col or not sec_col:
        return {}

    listing[code_col] = listing[code_col].astype(str).str.zfill(6)
    return dict(zip(listing[code_col], listing[sec_col]))


def fetch_dart_corp_map() -> dict:
    """종목코드 → DART 고유번호"""
    if not DART_API_KEY:
        log("⚠️  DART_API_KEY 없음 → 고유번호 매핑 건너뜀")
        return {}
    try:
        res = requests.get(
            "https://opendart.fss.or.kr/api/corpCode.xml",
            params={"crtfc_key": DART_API_KEY},
            timeout=60,
        )
        res.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            xml_bytes = z.read(z.namelist()[0])
        out = {}
        for el in ET.fromstring(xml_bytes).iter("list"):
            sc = (el.findtext("stock_code") or "").strip()
            cc = (el.findtext("corp_code") or "").strip()
            if sc and cc:
                out[sc] = cc
        return out
    except Exception as e:
        log(f"⚠️  DART 고유번호 조회 실패: {e}")
        return {}


def sync_master(client: Client, base_date: str) -> None:
    log("종목 마스터 갱신 중...")
    sectors = fetch_sector_map()
    corps = fetch_dart_corp_map()

    rows = []
    for market in ("KOSPI", "KOSDAQ"):
        for t in stock.get_market_ticker_list(base_date, market=market):
            if not t.endswith("0"):          # 우선주 제외
                continue
            name = stock.get_market_ticker_name(t)
            if any(k in name for k in ("스팩", "리츠")):
                continue
            rows.append({
                "ticker": t,
                "name": name,
                "market": market,
                "sector": sectors.get(t),
                "dart_corp_code": corps.get(t),
            })

    n = upsert(client, "stocks", rows)
    log(f"✅ 종목 마스터 {n}건")


# ══════════════════════════════════════════════ 2. 일별 시세/밸류
def collect_day(client: Client, d: str) -> int:
    """특정 일자의 전 종목 시세 + 밸류에이션 (호출 2회)"""
    try:
        ohlcv = stock.get_market_ohlcv(d, market="ALL")
        fund = stock.get_market_fundamental(d, market="ALL")
    except Exception as e:
        log(f"  {d} 조회 실패: {e}")
        return 0

    if ohlcv is None or ohlcv.empty:
        return 0   # 휴장일

    iso = f"{d[:4]}-{d[4:6]}-{d[6:]}"

    price_rows = [
        {
            "date": iso, "ticker": t,
            "open": clean_num(r.get("시가"), True),
            "high": clean_num(r.get("고가"), True),
            "low": clean_num(r.get("저가"), True),
            "close": clean_num(r.get("종가"), True),
            "volume": clean_num(r.get("거래량"), True),
            "value": clean_num(r.get("거래대금"), True),
        }
        for t, r in ohlcv.iterrows()
        if t.endswith("0")
    ]
    upsert(client, "daily_price", price_rows)

    if fund is not None and not fund.empty:
        fund_rows = [
            {
                "date": iso, "ticker": t,
                "bps": clean_num(r.get("BPS"), True),
                "per": clean_num(r.get("PER")),
                "pbr": clean_num(r.get("PBR")),
                "eps": clean_num(r.get("EPS"), True),
                "div": clean_num(r.get("DIV")),
                "dps": clean_num(r.get("DPS"), True),
            }
            for t, r in fund.iterrows()
            if t.endswith("0")
        ]
        upsert(client, "daily_fundamental", fund_rows)

    return len(price_rows)


# ══════════════════════════════════════════════ 3. 스냅샷
def index_return(frm: str, to: str) -> float:
    try:
        s = stock.get_index_ohlcv(frm, to, KOSPI_INDEX)["종가"]
        return float((s.iloc[-1] / s.iloc[0] - 1) * 100)
    except Exception:
        return 0.0


def build_snapshot(client: Client, base_date: str) -> int:
    """스크리닝용 최신 스냅샷 (호출 5회)"""
    log("스냅샷 생성 중...")

    cap = stock.get_market_cap(base_date, market="ALL")
    fund = stock.get_market_fundamental(base_date, market="ALL")
    df = cap.join(fund, how="inner")

    d1y = (datetime.strptime(base_date, "%Y%m%d") - timedelta(days=365)).strftime("%Y%m%d")
    d6m = (datetime.strptime(base_date, "%Y%m%d") - timedelta(days=182)).strftime("%Y%m%d")
    d1m = (datetime.strptime(base_date, "%Y%m%d") - timedelta(days=30)).strftime("%Y%m%d")

    for label, frm in [("ret_1y", d1y), ("ret_6m", d6m), ("ret_1m", d1m)]:
        chg = stock.get_market_price_change(frm, base_date, market="ALL")
        df = df.join(chg[["등락률"]].rename(columns={"등락률": label}), how="left")

    bench = index_return(d1y, base_date)
    log(f"  KOSPI 1년 수익률: {bench:.2f}%")

    # 종목 마스터 조인 (이름/업종/시장)
    master = client.table("stocks").select("ticker,name,market,sector").execute().data
    mdf = pd.DataFrame(master).set_index("ticker") if master else pd.DataFrame()

    iso = f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:]}"
    rows = []
    for t, r in df.iterrows():
        if not t.endswith("0") or t not in mdf.index:
            continue
        m = mdf.loc[t]
        ret_1y = clean_num(r.get("ret_1y"))
        rows.append({
            "ticker": t,
            "date": iso,
            "name": m["name"],
            "market": m["market"],
            "sector": m["sector"],
            "close": clean_num(r.get("종가"), True),
            "market_cap": clean_num(r.get("시가총액"), True),
            "trade_value": clean_num(r.get("거래대금"), True),
            "shares": clean_num(r.get("상장주식수"), True),
            "per": clean_num(r.get("PER")),
            "pbr": clean_num(r.get("PBR")),
            "eps": clean_num(r.get("EPS"), True),
            "bps": clean_num(r.get("BPS"), True),
            "div": clean_num(r.get("DIV")),
            "ret_1y": ret_1y,
            "ret_6m": clean_num(r.get("ret_6m")),
            "ret_1m": clean_num(r.get("ret_1m")),
            "rs_1y": None if ret_1y is None else round(ret_1y - bench, 4),
        })

    n = upsert(client, "snapshot", rows)
    log(f"✅ 스냅샷 {n}건")
    return n


# ══════════════════════════════════════════════ 메인
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["daily", "backfill", "master"], default="daily")
    ap.add_argument("--days", type=int, default=400, help="backfill 기간(일)")
    args = ap.parse_args()

    client = sb()
    base_date = latest_business_day()
    log(f"기준일: {base_date} / 모드: {args.mode}")

    status, message, rows = "success", "", 0

    try:
        if args.mode == "master":
            sync_master(client, base_date)

        elif args.mode == "backfill":
            sync_master(client, base_date)
            frm = (date.today() - timedelta(days=args.days)).strftime("%Y%m%d")
            days = business_days(frm, base_date)
            log(f"백필 대상 {len(days)} 영업일")
            for i, d in enumerate(days, 1):
                cnt = collect_day(client, d)
                rows += cnt
                if i % 10 == 0 or i == len(days):
                    log(f"  {i}/{len(days)}  {d}  누적 {rows:,}행")
                time.sleep(0.3)          # KRX 부하 방지
            build_snapshot(client, base_date)

        else:  # daily
            sync_master(client, base_date)
            rows = collect_day(client, base_date)
            log(f"✅ 일별 시세 {rows}건")
            build_snapshot(client, base_date)

    except Exception as e:
        status, message = "failed", str(e)[:500]
        log(f"❌ 실패: {e}")

    finally:
        try:
            client.table("collect_log").insert({
                "base_date": f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:]}",
                "mode": args.mode,
                "rows": rows,
                "status": status,
                "message": message,
            }).execute()
        except Exception:
            pass

    if status == "failed":
        sys.exit(1)
    log("🎉 완료")


if __name__ == "__main__":
    main()
