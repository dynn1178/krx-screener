import os, time
import pandas as pd
import requests
from fredapi import Fred
from supabase import create_client

FRED_KEY = os.environ["FRED_API_KEY"]
ECOS_KEY = os.environ["ECOS_API_KEY"]
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
fred = Fred(api_key=FRED_KEY)

# --- FRED 수집 ---
def collect_fred():
    rows = []
    for sid in FRED_SERIES:
        s = fred.get_series(sid, observation_start="2015-01-01")
        for date, value in s.items():
            if pd.notna(value):
                rows.append({"series_id": sid, "date": date.strftime("%Y-%m-%d"), "value": float(value)})
    return rows

# --- ECOS 수집 (원본 값 그대로, 변환 없음) ---
def collect_ecos():
    rows = []
    for sid, meta in ECOS_SERIES.items():
        url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{ECOS_KEY}/json/kr/1/10000/"
               f"{meta['stat']}/{meta['cycle']}/20150101/20261231/{meta['item']}")
        res = requests.get(url, timeout=10).json()
        data_rows = res.get("StatisticSearch", {}).get("row", [])
        for r in data_rows:
            raw_date = r["TIME"]
            if len(raw_date) == 8:      # 일별: YYYYMMDD
                date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            elif len(raw_date) == 6:    # 월별: YYYYMM
                date = f"{raw_date[:4]}-{raw_date[4:6]}-01"
            else:
                continue
            rows.append({"series_id": sid, "date": date, "value": float(r["DATA_VALUE"])})
        time.sleep(0.3)
    return rows

# --- 파생 지표 계산 (M2 YoY 증가율) ---
def compute_derived(all_rows):
    df = pd.DataFrame(all_rows)
    derived_rows = []

    for derived_id, meta in DERIVED_SERIES.items():
        base_df = df[df["series_id"] == meta["base"]].sort_values("date").copy()
        if base_df.empty:
            continue
        base_df["value"] = pd.to_numeric(base_df["value"])
        base_df["yoy"] = base_df["value"].pct_change(periods=12) * 100  # 월별 기준 12개월 전 대비

        for _, row in base_df.dropna(subset=["yoy"]).iterrows():
            derived_rows.append({
                "series_id": derived_id,
                "date": row["date"],
                "value": round(float(row["yoy"]), 2)
            })
    return derived_rows

def upsert_values(rows):
    for i in range(0, len(rows), 500):
        supabase.table("macro_values").upsert(rows[i:i+500], on_conflict="series_id,date").execute()

if __name__ == "__main__":
    fred_rows = collect_fred()
    ecos_rows = collect_ecos()
    base_rows = fred_rows + ecos_rows

    derived_rows = compute_derived(base_rows)

    all_rows = base_rows + derived_rows
    upsert_values(all_rows)
    print(f"적재 완료: 원본 {len(base_rows)}건 + 파생 {len(derived_rows)}건 = 총 {len(all_rows)}건")
