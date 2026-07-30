"""
KRX 데이터 수집기 → Supabase 적재
════════════════════════════════════════════════════════════════
유니버스: 시가총액 상위 500 ∪ 거래대금 상위 500 (우선주 제외)
  - 중복 제거된 union set (보통 700~850 종목)
  - daily 모드: 매일 산출
  - backfill 모드: 최신일 유니버스로 고정하여 과거 데이터 채움

  python collect.py --mode daily
  python collect.py --mode backfill --days 400
  python collect.py --mode master
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

CHUNK = 1000              # Supabase upsert 배치 크기
KOSPI_INDEX = "1001"
UNIVERSE_TOP_N = 500      # 시총·거래대금 각각의 상위 N개

# ────────────────────────────────────────────── User-Agent 위장
# GitHub Actions 러너(AWS us-east-1) IP가 KRX 서버에서 간헐 차단됩니다.
# 브라우저처럼 UA를 위장하면 통과율이 유의미하게 올라갑니다.
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_orig_get = requests.Session.get
_orig_post = requests.Session.post


def _patched_get(self, url, *args, **kwargs):
    headers = kwargs.get("headers") or {}
    headers.setdefault("User-Agent", _UA)
    kwargs["headers"] = headers
    return _orig_get(self, url, *args, **kwargs)


def _patched_post(self, url, *args, **kwargs):
    headers = kwargs.get("headers") or {}
    headers.setdefault("User-Agent", _UA)
    kwargs["headers"] = headers
    return _orig_post(self, url, *args, **kwargs)


requests.Session.get = _patched_get
requests.Session.post = _patched_post


# ══════════════════════════════════════════════ 유틸
def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def sb() -> Client:
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        sys.exit("❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 없습니다.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def upsert(client: Client, table: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), CHUNK):
        batch = rows[i : i + CHUNK]
        client.table(table).upsert(batch).execute()
        total += len(batch)
    return total


def clean_num(v, as_int: bool = False):
    if v is None or pd.isna(v):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return int(f) if as_int else round(f, 4)


# ══════════════════════════════════════════════ pykrx 재시도 래퍼
def krx_call(fn, *args, tries: int = 3, backoff: int = 5, **kwargs):
    """
    pykrx 호출용 재시도 래퍼. GitHub Actions 러너에서 KRX가 간헐적으로
    빈 응답(Expecting value: line 1 column 1)을 돌려주는 이슈 대응.
    """
    last_exc = None
    for i in range(tries):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_exc = e
            log(f"  ⚠️  {fn.__name__} 재시도 {i+1}/{tries}: {e}")
            if i < tries - 1:
                time.sleep(backoff * (i + 1))
    raise RuntimeError(f"{fn.__name__} 최종 실패: {last_exc}")


# ══════════════════════════════════════════════ 영업일
def business_days(frm: str, to: str) -> list[str]:
    try:
        days = krx_call(stock.get_previous_business_days, fromdate=frm, todate=to)
        return [d.strftime("%Y%m%d") for d in days]
    except Exception:
        out, cur = [], datetime.strptime(frm, "%Y%m%d")
        end = datetime.strptime(to, "%Y%m%d")
        while cur <= end:
            if cur.weekday() < 5:
                out.append(cur.strftime("%Y%m%d"))
            cur += timedelta(days=1)
        return out


def latest_business_day() -> str:
    """pykrx로 최근 영업일 조회. 실패 시 시스템 시간 기반 폴백."""
    for i in range(3):
        try:
            d = stock.get_nearest_business_day_in_a_week()
            if d:
                return d
        except Exception as e:
            log(f"⚠️  latest_business_day 재시도 {i+1}/3: {e}")
            time.sleep(5 * (i + 1))
    d = datetime.now()
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    log(f"⚠️  pykrx 실패, 폴백 사용: {d:%Y%m%d}")
    return d.strftime("%Y%m%d")


# ══════════════════════════════════════════════ 유니버스
def fetch_day(d: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """일자별 원본 데이터 조회 (ohlcv, cap, fund)"""
    ohlcv = krx_call(stock.get_market_ohlcv, d, market="ALL")
    cap = krx_call(stock.get_market_cap, d, market="ALL")
    fund = krx_call(stock.get_market_fundamental, d, market="ALL")
    return ohlcv, cap, fund


def compute_universe(ohlcv: pd.DataFrame, cap: pd.DataFrame) -> set[str]:
    """
    시가총액 상위 N ∪ 거래대금 상위 N (우선주 제외).
    - 종목코드 끝자리 '0'이 아닌 것은 우선주로 간주하고 제외
      (예: 삼성전자우 005935는 '5'로 끝나 제외됨)
    - set 연산으로 중복 자동 제거
    """
    if ohlcv is None or ohlcv.empty or cap is None or cap.empty:
        return set()

    def is_common(t: str) -> bool:
        return str(t).endswith("0")

    ohlcv_c = ohlcv[[is_common(t) for t in ohlcv.index]]
    cap_c = cap[[is_common(t) for t in cap.index]]

    top_value = set(ohlcv_c.nlargest(UNIVERSE_TOP_N, "거래대금").index)
    top_cap = set(cap_c.nlargest(UNIVERSE_TOP_N, "시가총액").index)
    return top_value | top_cap


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


def sync_master(client: Client, base_date: str, universe: set[str]) -> None:
    """유니버스에 속한 종목만 마스터에 저장"""
    log(f"종목 마스터 갱신 중 (유니버스 {len(universe)}종목)...")
    sectors = fetch_sector_map()
    corps = fetch_dart_corp_map()

    rows = []
    for market in ("KOSPI", "KOSDAQ"):
        try:
            tickers = krx_call(stock.get_market_ticker_list, base_date, market=market)
        except Exception as e:
            log(f"⚠️  {market} 종목 리스트 조회 실패, 건너뜀: {e}")
            continue

        for t in tickers:
            if t not in universe:
                continue
            try:
                name = stock.get_market_ticker_name(t)
            except Exception:
                name = None
            if not name:
                continue
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
def save_day(
    client: Client,
    d: str,
    ohlcv: pd.DataFrame,
    fund: pd.DataFrame,
    universe: set[str],
) -> int:
    """유니버스 종목의 하루치 시세·밸류를 Supabase에 저장"""
    if ohlcv is None or ohlcv.empty:
        return 0

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
        if t in universe
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
            if t in universe
        ]
        upsert(client, "daily_fundamental", fund_rows)

    return len(price_rows)


# ══════════════════════════════════════════════ 3. 스냅샷
def index_return(frm: str, to: str) -> float:
    try:
        s = krx_call(stock.get_index_ohlcv, frm, to, KOSPI_INDEX)["종가"]
        return float((s.iloc[-1] / s.iloc[0] - 1) * 100)
    except Exception as e:
        log(f"⚠️  KOSPI 수익률 조회 실패: {e}")
        return 0.0


def build_snapshot(
    client: Client,
    base_date: str,
    ohlcv: pd.DataFrame,
    cap: pd.DataFrame,
    fund: pd.DataFrame,
    universe: set[str],
) -> int:
    """스크리닝용 최신 스냅샷 생성 (유니버스 종목만)"""
    log("스냅샷 생성 중...")

    df = cap.join(fund, how="inner")

    d1y = (datetime.strptime(base_date, "%Y%m%d") - timedelta(days=365)).strftime("%Y%m%d")
    d6m = (datetime.strptime(base_date, "%Y%m%d") - timedelta(days=182)).strftime("%Y%m%d")
    d1m = (datetime.strptime(base_date, "%Y%m%d") - timedelta(days=30)).strftime("%Y%m%d")

    for label, frm in [("ret_1y", d1y), ("ret_6m", d6m), ("ret_1m", d1m)]:
        try:
            chg = krx_call(stock.get_market_price_change, frm, base_date, market="ALL")
            df = df.join(chg[["등락률"]].rename(columns={"등락률": label}), how="left")
        except Exception as e:
            log(f"⚠️  {label} 조회 실패: {e}")
            df[label] = None

    bench = index_return(d1y, base_date)
    log(f"  KOSPI 1년 수익률: {bench:.2f}%")

    master = client.table("stocks").select("ticker,name,market,sector").execute().data
    mdf = pd.DataFrame(master).set_index("ticker") if master else pd.DataFrame()

    iso = f"{base_date[:4]}-{base_date[4:6]}-{base_date[6:]}"
    rows = []
    for t, r in df.iterrows():
        if t not in universe or t not in mdf.index:
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
        # 어떤 모드든 최신일 데이터·유니버스는 필요 (한 번만 조회)
        ohlcv, cap, fund = fetch_day(base_date)
        universe = compute_universe(ohlcv, cap)
        log(
            f"유니버스: {len(universe)}종목 "
            f"(시총 상위 {UNIVERSE_TOP_N} ∪ 거래대금 상위 {UNIVERSE_TOP_N})"
        )
        if not universe:
            raise RuntimeError("유니버스 산출 실패 (원본 데이터가 비어 있음)")

        if args.mode == "master":
            sync_master(client, base_date, universe)

        elif args.mode == "backfill":
            sync_master(client, base_date, universe)
            frm = (date.today() - timedelta(days=args.days)).strftime("%Y%m%d")
            days = business_days(frm, base_date)
            log(f"백필 대상 {len(days)} 영업일 (유니버스는 최신일 기준 고정)")

            for i, d in enumerate(days, 1):
                if d == base_date:
                    day_ohlcv, day_fund = ohlcv, fund
                else:
                    try:
                        day_ohlcv, _, day_fund = fetch_day(d)
                    except Exception as e:
                        log(f"  {d} 조회 실패, 스킵: {e}")
                        continue

                cnt = save_day(client, d, day_ohlcv, day_fund, universe)
                rows += cnt
                if i % 10 == 0 or i == len(days):
                    log(f"  {i}/{len(days)}  {d}  누적 {rows:,}행")
                time.sleep(0.3)   # KRX 부하 방지

            build_snapshot(client, base_date, ohlcv, cap, fund, universe)

        else:  # daily
            sync_master(client, base_date, universe)
            rows = save_day(client, base_date, ohlcv, fund, universe)
            log(f"✅ 일별 시세 {rows}건")
            build_snapshot(client, base_date, ohlcv, cap, fund, universe)

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
