# collector/collect_macro.py
import os
import time
import pandas as pd
import requests
from fredapi import Fred
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
}

ECOS_SERIES = {
    "RATE_BASE_M": {"stat": "722Y001", "item": "0101000", "cycle": "M"},
    "FX_USD_D":    {"stat": "731Y006", "item": "0000013", "cycle": "D"},
    "FX_CNY_D":    {"stat": "731Y006", "item": "0000010", "cycle": "D"},
    "FX_JPY_D":    {"stat": "731Y006", "item": "0000006", "cycle": "D"},
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

def collect_ecos():
    rows = []
    for sid, meta in ECOS_SERIES.items():
        url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{ECOS_KEY}/json/kr/1/10000/"
               f"{meta['stat']}/{meta['cycle']}/20150101/20261231/{meta['item']}")
        res = requests.get(url, timeout=10).json()
        data_rows = res.get("StatisticSearch", {}).get("row", [])
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
    base_rows = fred_rows + ecos_rows
    derived_rows = compute_derived(base_rows)
    all_rows = base_rows + derived_rows

    pivot_and_upsert(all_rows)
    print(f"적재 완료: {len(all_rows)}건 → macro_daily 테이블로 pivot 저장")
