# collector/collect_macro.py
import io
import os
import time
from datetime import datetime

import pandas as pd
import requests
from fredapi import Fred
from pykrx import stock
from supabase import create_client

FRED_KEY = os.environ["FRED_API_KEY"]
ECOS_KEY = os.environ["ECOS_API_KEY"]
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
fred = Fred(api_key=FRED_KEY)

# ── 지표 정의 ──────────────────────────────────────────────

FRED_SERIES = {
    "DGS10": "미10년물", "DGS2": "미2년물", "DFF": "연방기금금리",
    "T10Y2Y": "장단기금리차", "DEXKOUS": "원달러환율(FRED)", "DTWEXBGS": "달러인덱스",
    "DCOILWTICO": "WTI유가", "VIXCLS": "VIX지수", "USSLIND": "미선행지수",
    "UMCSENT": "미시간소비자심리", "CPIAUCSL": "미CPI", "UNRATE": "미실업률",
    # 해외지수 — 시장 개요와 매크로 보드에 함께 표시
    "SP500": "S&P 500", "NASDAQCOM": "나스닥종합", "DJIA": "다우존스",
    # 국채금리 — 미(1/5/20/30, 10Y·2Y는 이미 있음) + 유로존 월간 백업
    "DGS1": "미1년물", "DGS5": "미5년물", "DGS20": "미20년물", "DGS30": "미30년물",
    "IRLTLT01EZM156N": "유로존10년물(월간)",
    # 기준금리 — 연준 타깃밴드, ECB
    "DFEDTARU": "연준목표금리상단", "DFEDTARL": "연준목표금리하단",
    "ECBDFR": "ECB예금금리", "ECBMRRFR": "ECB기준금리",
    # 유가 · 금속
    "DCOILBRENTEU": "브렌트유", "POILDUBUSDM": "두바이유",
    "PCOPPUSDM": "구리", "PALUMUSDM": "알루미늄",
}

ECOS_SERIES = {
    "RATE_BASE_M": {"stat": "722Y001", "item": "0101000", "cycle": "M"},
    "FX_USD_D": {"stat": "731Y003", "item": "0000013", "cycle": "D"},
    "FX_CNY_D": {"stat": "731Y003", "item": "0000010", "cycle": "D"},
    "FX_JPY_D": {"stat": "731Y003", "item": "0000006", "cycle": "D"},
    "FX_EUR_D": {"stat": "731Y001", "item": "0000003", "cycle": "D"},
    "M2_TOTAL_M":  {"stat": "161Y005", "item": "BBHS00", "cycle": "M"},
    "CLI_LEADING_M":          {"stat": "901Y067", "item": "I16A", "cycle": "M"},
    "CLI_COINCIDENT_M":       {"stat": "901Y067", "item": "I16B", "cycle": "M"},
    "CLI_LAGGING_M":          {"stat": "901Y067", "item": "I16C", "cycle": "M"},
    "CLI_LEADING_CYCLE_M":    {"stat": "901Y067", "item": "I16E", "cycle": "M"},
    "CLI_COINCIDENT_CYCLE_M": {"stat": "901Y067", "item": "I16D", "cycle": "M"},
    "CPI_TOTAL_M": {"stat": "901Y009", "item": "0", "cycle": "M"},
    "CCSI_M":        {"stat": "511Y002", "item": "FME",   "cycle": "M"},
    "CCSI_TRAVEL_M": {"stat": "511Y002", "item": "FMCCD", "cycle": "M"},
    "BSI_ACTUAL_M":   {"stat": "512Y013", "item": "99988", "cycle": "M"},
    "BSI_FORECAST_M": {"stat": "512Y014", "item": "99988", "cycle": "M"},
    # 국채금리 — 한국 국고채 (시장금리, 일별)
    "KR_1Y":  {"stat": "817Y002", "item": "010190000", "cycle": "D"},
    "KR_5Y":  {"stat": "817Y002", "item": "010200001", "cycle": "D"},
    "KR_10Y": {"stat": "817Y002", "item": "010210000", "cycle": "D"},
    "KR_20Y": {"stat": "817Y002", "item": "010220000", "cycle": "D"},
    "KR_30Y": {"stat": "817Y002", "item": "010230000", "cycle": "D"},
}

# 국내지수 — pykrx. 지수 시세는 KRX 로그인 없이 조회된다.
KRX_INDEX_SERIES = {
    "KOSPI": "1001",
    "KOSDAQ": "2001",
}

DERIVED_SERIES = {
    "M2_TOTAL_YOY_M": {"base": "M2_TOTAL_M", "method": "yoy_pct"},
}

# ── 수집 함수 ──────────────────────────────────────────────

def collect_fred():
    rows = []
    for sid in FRED_SERIES:
        s = fred.get_series(sid, observation_start="2015-01-01")
        for date, value in s.items():
            if pd.notna(value):
                rows.append({"series_id": sid, "date": date.strftime("%Y-%m-%d"), "value": float(value)})
    return rows

def collect_krx_indices():
    """KOSPI/KOSDAQ 지수 종가를 2015-01-01부터 일괄 수집한다."""
    rows = []
    frm = "20150101"
    to = datetime.now().strftime("%Y%m%d")

    for sid, ticker in KRX_INDEX_SERIES.items():
        df = None
        for attempt in range(3):
            try:
                df = stock.get_index_ohlcv(frm, to, ticker)
                break
            except Exception as e:  # KRX 는 간헐적으로 응답이 끊긴다
                if attempt == 2:
                    print(f"{sid} 수집 실패: {e}")
                else:
                    time.sleep(3 * (attempt + 1))

        if df is None or df.empty or "종가" not in df.columns:
            continue

        for dt, close in df["종가"].items():
            if pd.notna(close) and close > 0:
                rows.append({
                    "series_id": sid,
                    "date": dt.strftime("%Y-%m-%d"),
                    "value": float(close),
                })
        print(f"{sid}: {len(df)}건")

    return rows


def format_ecos_date(cycle: str, is_start: bool) -> str:
    """ECOS 주기별 날짜 형식 변환"""
    if cycle == "D":
        return "20150101" if is_start else "20261231"
    elif cycle == "M":
        return "201501" if is_start else "202612"
    elif cycle == "Q":
        return "2015Q1" if is_start else "2026Q4"
    elif cycle == "A":
        return "2015" if is_start else "2026"
    else:
        raise ValueError(f"지원하지 않는 cycle: {cycle}")

def collect_ecos():
    rows = []
    for sid, meta in ECOS_SERIES.items():
        start_date = format_ecos_date(meta["cycle"], is_start=True)
        end_date = format_ecos_date(meta["cycle"], is_start=False)

        url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{ECOS_KEY}/json/kr/1/10000/"
               f"{meta['stat']}/{meta['cycle']}/{start_date}/{end_date}/{meta['item']}")

        try:
            res = requests.get(url, timeout=30).json()
        except requests.exceptions.RequestException as e:
            print(f"[ECOS 연결 실패] {sid}: {e}")
            continue

        if "StatisticSearch" not in res:
            print(f"[ECOS 오류] {sid} ({meta['stat']}/{meta['item']}): {res}")
            continue

        data_rows = res.get("StatisticSearch", {}).get("row", [])
        print(f"[ECOS 성공] {sid}: {len(data_rows)}건 수집")
        for r in data_rows:
            raw_date = r["TIME"]
            if len(raw_date) == 8:
                date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            elif len(raw_date) == 6:
                date = f"{raw_date[:4]}-{raw_date[4:6]}-01"
            else:
                continue
            rows.append({"series_id": sid, "date": date, "value": float(r["DATA_VALUE"])})
        time.sleep(0.3)
    return rows

# 일본 국채 — 재무성이 공개하는 CSV. 무료·무키. 과거 전체(1974~) + 이번 달치를 합쳐서
# 최신 며칠까지 확실히 반영한다. FRED/ECOS 와 달리 완전히 새 소스라 실패해도 전체
# 수집이 죽지 않도록 함수 전체를 감싼다.
MOF_TENORS = {"1Y": "JP_1Y", "5Y": "JP_5Y", "10Y": "JP_10Y", "20Y": "JP_20Y", "30Y": "JP_30Y"}
MOF_BASE = "https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/"

def collect_mof_jgb():
    try:
        hist = requests.get(MOF_BASE + "historical/jgbcme_all.csv", timeout=60)
        cur = requests.get(MOF_BASE + "jgbcme.csv", timeout=30)

        frames = []
        for r in (hist, cur):
            if r.status_code != 200:
                continue
            text = r.content.decode("utf-8", errors="replace")
            frames.append(pd.read_csv(io.StringIO(text), skiprows=1))
        if not frames:
            print("[MOF 실패] 국채 CSV를 하나도 못 받음")
            return []

        df = pd.concat(frames, ignore_index=True)
        df["Date"] = pd.to_datetime(df["Date"], format="%Y/%m/%d", errors="coerce")
        df = df.dropna(subset=["Date"]).drop_duplicates(subset=["Date"], keep="last")

        rows = []
        for tenor, sid in MOF_TENORS.items():
            if tenor not in df.columns:
                continue
            vals = pd.to_numeric(df[tenor], errors="coerce")  # 결측은 "-" 로 채워져 있다
            for dt, v in zip(df["Date"], vals):
                if pd.notna(v):
                    rows.append({"series_id": sid, "date": dt.strftime("%Y-%m-%d"), "value": float(v)})
        print(f"[MOF 성공] 일본 국채 {len(rows)}건 수집")
        return rows
    except Exception as e:
        print(f"[MOF 실패] {e}")
        return []

# 유로존 국채 곡선 — ECB Data Portal 공개 API(SDMX, csvdata 포맷).
# 만기 하나가 실패해도 나머지는 계속 수집한다. 이 함수 전체가 실패해도
# FRED 의 월간 유로존10년물(IRLTLT01EZM156N)이 백업으로 남는다.
ECB_TENORS = {1: "EZ_1Y", 5: "EZ_5Y", 10: "EZ_10Y", 20: "EZ_20Y", 30: "EZ_30Y"}

def collect_ecb_yield_curve():
    rows = []
    for n, sid in ECB_TENORS.items():
        try:
            key = f"B.U2.EUR.4F.G_N_A.SV_C_YM.SR_{n}Y"
            url = f"https://data-api.ecb.europa.eu/service/data/YC/{key}?startPeriod=2015-01-01&format=csvdata"
            r = requests.get(url, timeout=30, headers={"Accept": "text/csv"})
            if r.status_code != 200:
                print(f"[ECB 실패] {sid}: HTTP {r.status_code}")
                continue

            df = pd.read_csv(io.StringIO(r.text))
            n_ok = 0
            for _, row in df.iterrows():
                v = row.get("OBS_VALUE")
                if pd.notna(v):
                    rows.append({"series_id": sid, "date": str(row["TIME_PERIOD"]), "value": float(v)})
                    n_ok += 1
            print(f"[ECB 성공] {sid}: {n_ok}건 수집")
        except Exception as e:
            print(f"[ECB 실패] {sid}: {e}")
            continue
    return rows

def compute_derived(all_rows):
    df = pd.DataFrame(all_rows)
    derived_rows = []
    for derived_id, meta in DERIVED_SERIES.items():
        base_df = df[df["series_id"] == meta["base"]].sort_values("date").copy()
        if base_df.empty:
            continue
        base_df["value"] = pd.to_numeric(base_df["value"])
        base_df["yoy"] = base_df["value"].pct_change(periods=12) * 100
        for _, row in base_df.dropna(subset=["yoy"]).iterrows():
            derived_rows.append({
                "series_id": derived_id,
                "date": row["date"],
                "value": round(float(row["yoy"]), 2)
            })
    return derived_rows

# ── 저장 함수 (wide 포맷으로 변경됨) ──────────────────────────

def pivot_and_upsert(all_rows):
    df = pd.DataFrame(all_rows)
    if df.empty:
        print("수집된 데이터 없음")
        return

    df["series_id"] = df["series_id"].str.lower()
    df["date"] = pd.to_datetime(df["date"])

    # long → wide 변환
    wide = df.pivot_table(index="date", columns="series_id", values="value", aggfunc="last")

    # 전체 날짜(휴일 포함 매일)로 인덱스 확장 후 직전값으로 채우기
    full_range = pd.date_range(start=wide.index.min(), end=wide.index.max(), freq="D")
    wide = wide.reindex(full_range)
    wide = wide.ffill()   # 휴일 → 직전 영업일값, 월간지표 → 발표일값을 다음 발표일 전까지 매일 반복

    wide.index.name = "date"
    wide = wide.reset_index()
    wide["date"] = wide["date"].dt.strftime("%Y-%m-%d")

    records = []
    for _, row in wide.iterrows():
        record = {"date": row["date"], "updated_at": pd.Timestamp.now().isoformat()}
        for col in wide.columns:
            if col == "date":
                continue
            val = row[col]
            if pd.notna(val):
                record[col] = float(val)
        records.append(record)

    for i in range(0, len(records), 500):
        supabase.table("macro_daily").upsert(records[i:i+500], on_conflict="date").execute()
        
# ── 실행 ──────────────────────────────────────────────

if __name__ == "__main__":
    fred_rows = collect_fred()
    ecos_rows = collect_ecos()
    krx_rows = collect_krx_indices()
    mof_rows = collect_mof_jgb()
    ecb_rows = collect_ecb_yield_curve()
    base_rows = fred_rows + ecos_rows + krx_rows + mof_rows + ecb_rows
    derived_rows = compute_derived(base_rows)
    all_rows = base_rows + derived_rows

    pivot_and_upsert(all_rows)
    print(f"적재 완료: {len(all_rows)}건 → macro_daily 테이블로 pivot 저장")
