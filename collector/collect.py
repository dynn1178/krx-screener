"""
KRX 데이터 수집기 → Supabase 적재

Universe:
시가총액 상위 500 ∪ 거래대금 상위 500

추가 수집 데이터:
- OHLCV
- 시가총액
- 상장주식수
- PER/PBR/EPS/BPS
- 외국인 순매수
- 기관 순매수
- 개인 순매수
- 등락률
- 전일 대비 변동
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


# ==================================================
# 환경변수
# ==================================================

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    ""
)

SUPABASE_SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_KEY",
    ""
)

DART_API_KEY = os.environ.get(
    "DART_API_KEY",
    ""
)


CHUNK = 1000

UNIVERSE_TOP_N = 500

KOSPI_INDEX = "1001"


# ==================================================
# USER AGENT
# ==================================================

_UA = (
    "Mozilla/5.0 "
    "(Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 "
    "(KHTML, like Gecko) "
    "Chrome/120 Safari/537.36"
)


_original_get = requests.Session.get
_original_post = requests.Session.post



def _patched_get(
    self,
    url,
    *args,
    **kwargs
):

    headers = kwargs.get(
        "headers"
    ) or {}

    headers.setdefault(
        "User-Agent",
        _UA
    )

    kwargs["headers"] = headers

    return _original_get(
        self,
        url,
        *args,
        **kwargs
    )



def _patched_post(
    self,
    url,
    *args,
    **kwargs
):

    headers = kwargs.get(
        "headers"
    ) or {}

    headers.setdefault(
        "User-Agent",
        _UA
    )

    kwargs["headers"] = headers

    return _original_post(
        self,
        url,
        *args,
        **kwargs
    )


requests.Session.get = _patched_get
requests.Session.post = _patched_post



# ==================================================
# UTIL
# ==================================================

def log(msg):

    print(
        f"[{datetime.now():%H:%M:%S}] {msg}",
        flush=True
    )



def sb() -> Client:

    if not SUPABASE_URL:
        sys.exit(
            "SUPABASE_URL 없음"
        )

    return create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY
    )



def upsert(
    client,
    table,
    rows
):

    if not rows:
        return 0

    total = 0

    for i in range(
        0,
        len(rows),
        CHUNK
    ):

        batch = rows[
            i:i+CHUNK
        ]

        client.table(
            table
        ).upsert(
            batch
        ).execute()

        total += len(batch)


    return total



def clean_num(
    v,
    as_int=False
):

    if v is None:
        return None


    try:

        if pd.isna(v):
            return None


        f = float(v)


    except:

        return None


    if f != f:
        return None


    if as_int:
        return int(f)


    return round(
        f,
        4
    )



# ==================================================
# KRX Retry
# ==================================================

def krx_call(
    fn,
    *args,
    tries=3,
    backoff=5,
    **kwargs
):

    last = None


    for i in range(
        tries
    ):

        try:

            return fn(
                *args,
                **kwargs
            )


        except Exception as e:

            last = e

            log(
                f"{fn.__name__} "
                f"retry {i+1}/{tries}: {e}"
            )

            time.sleep(
                backoff*(i+1)
            )


    raise RuntimeError(
        last
    )



# ==================================================
# 영업일
# ==================================================

def business_days(
    frm,
    to
):

    days = krx_call(
        stock.get_previous_business_days,
        fromdate=frm,
        todate=to
    )


    return [
        d.strftime("%Y%m%d")
        for d in days
    ]



def latest_business_day():

    d = stock.get_nearest_business_day_in_a_week()

    return d



# ==================================================
# 데이터 조회
# ==================================================

def fetch_day(
    d
):

    """
    하루치 원본 데이터

    return:
    ohlcv
    cap
    fund
    investor
    """


    log(
        f"KRX 조회 {d}"
    )


    ohlcv = krx_call(
        stock.get_market_ohlcv,
        d,
        market="ALL"
    )


    cap = krx_call(
        stock.get_market_cap,
        d,
        market="ALL"
    )


    fund = krx_call(
        stock.get_market_fundamental,
        d,
        market="ALL"
    )


    investor = krx_call(
        stock.get_market_trading_value_by_date,
        d,
        d,
        market="ALL"
    )


    return (
        ohlcv,
        cap,
        fund,
        investor
    )



# ==================================================
# Universe
# ==================================================

def compute_universe(
    ohlcv,
    cap
):


    def common(t):

        return str(t).zfill(6).endswith("0")


    ohlcv = ohlcv[
        [
            common(x)
            for x in ohlcv.index
        ]
    ]


    cap = cap[
        [
            common(x)
            for x in cap.index
        ]
    ]


    top_value = set(
        ohlcv.nlargest(
            UNIVERSE_TOP_N,
            "거래대금"
        ).index
    )


    top_cap = set(
        cap.nlargest(
            UNIVERSE_TOP_N,
            "시가총액"
        ).index
    )


    return (
        top_value |
        top_cap
    )


# ==================================================
# 전일 종가
# ==================================================

def fetch_prev_close(
    base_date
):

    days = business_days(
        (
            datetime.strptime(
                base_date,
                "%Y%m%d"
            )
            -
            timedelta(days=10)
        ).strftime("%Y%m%d"),

        base_date
    )


    prev_date = [
        d
        for d in days
        if d < base_date
    ][-1]


    log(
        f"전일 종가 기준일 : {prev_date}"
    )


    df = krx_call(
        stock.get_market_ohlcv,
        prev_date,
        market="ALL"
    )


    return df["종가"]




# ==================================================
# 업종지수
# ==================================================

def fetch_sector_index():

    """
    KRX 업종지수 매핑
    """

    result = {}


    try:

        indexes = stock.get_index_ticker_list(
            market="KOSPI"
        )


        for idx in indexes:

            name = stock.get_index_ticker_name(
                idx
            )

            result[name] = idx


    except Exception as e:

        log(
            f"업종지수 조회 실패 : {e}"
        )


    return result




# ==================================================
# Snapshot 생성
# ==================================================

def build_snapshot(
    client,
    base_date,
    ohlcv,
    cap,
    fund,
    investor,
    universe
):


    log(
        "Snapshot 생성 시작"
    )


    prev_close = fetch_prev_close(
        base_date
    )


    # ----------------------------------
    # 데이터 Merge
    # ----------------------------------

    df = (
        ohlcv
        .join(
            cap,
            how="inner"
        )
        .join(
            fund,
            how="inner"
        )
    )


    df["전일종가"] = prev_close


    df["변동가"] = (
        df["종가"]
        -
        df["전일종가"]
    )


    df["등락률"] = (
        df["변동가"]
        /
        df["전일종가"]
        *
        100
    )



    # ----------------------------------
    # 기간 수익률
    # ----------------------------------

    d1y = (
        datetime.strptime(
            base_date,
            "%Y%m%d"
        )
        -
        timedelta(days=365)
    ).strftime("%Y%m%d")


    d6m = (
        datetime.strptime(
            base_date,
            "%Y%m%d"
        )
        -
        timedelta(days=182)
    ).strftime("%Y%m%d")


    d1m = (
        datetime.strptime(
            base_date,
            "%Y%m%d"
        )
        -
        timedelta(days=30)
    ).strftime("%Y%m%d")



    for label, frm in [

        ("ret_1y", d1y),

        ("ret_6m", d6m),

        ("ret_1m", d1m)

    ]:


        try:


            chg = krx_call(
                stock.get_market_price_change,
                frm,
                base_date,
                market="ALL"
            )


            df = df.join(
                chg[
                    ["등락률"]
                ]
                .rename(
                    columns={
                        "등락률":
                        label
                    }
                ),
                how="left"
            )


        except Exception as e:


            log(
                f"{label} 실패 {e}"
            )


            df[label] = None




    # ----------------------------------
    # KOSPI 상대수익률
    # ----------------------------------

    bench = 0


    try:

        kospi = krx_call(
            stock.get_index_ohlcv,
            d1y,
            base_date,
            KOSPI_INDEX
        )


        bench = (
            kospi["종가"].iloc[-1]
            /
            kospi["종가"].iloc[0]
            -1
        ) * 100


    except Exception:

        pass




    # ----------------------------------
    # Master
    # ----------------------------------

    master = (
        client
        .table("stocks")
        .select(
            "ticker,name,market,sector"
        )
        .execute()
        .data
    )


    mdf = pd.DataFrame(master)


    if not mdf.empty:

        mdf = mdf.set_index(
            "ticker"
        )



    iso = (
        f"{base_date[:4]}-"
        f"{base_date[4:6]}-"
        f"{base_date[6:]}"
    )



    rows = []



    for ticker, r in df.iterrows():


        if ticker not in universe:
            continue


        if ticker not in mdf.index:
            continue



        m = mdf.loc[ticker]



        ret_1y = clean_num(
            r.get("ret_1y")
        )



        rows.append(

        {


        "ticker":
            ticker,


        "date":
            iso,


        "name":
            m["name"],


        "market":
            m["market"],


        "sector":
            m["sector"],



        # ==================
        # 가격
        # ==================

        "open":
            clean_num(
                r.get("시가"),
                True
            ),


        "high":
            clean_num(
                r.get("고가"),
                True
            ),


        "low":
            clean_num(
                r.get("저가"),
                True
            ),


        "close":
            clean_num(
                r.get("종가"),
                True
            ),


        "prev_close":
            clean_num(
                r.get("전일종가"),
                True
            ),


        "change_price":
            clean_num(
                r.get("변동가"),
                True
            ),


        "change_rate":
            clean_num(
                r.get("등락률")
            ),



        # ==================
        # 거래
        # ==================

        "market_cap":
            clean_num(
                r.get("시가총액"),
                True
            ),


        "trade_value":
            clean_num(
                r.get("거래대금"),
                True
            ),


        "shares":
            clean_num(
                r.get("상장주식수"),
                True
            ),



        # ==================
        # 투자자 수급
        # ==================

        "foreign_net_buy":
            clean_num(
                investor.loc[ticker,"외국인합계"],
                True
            )
            if ticker in investor.index
            else None,


        "institution_net_buy":
            clean_num(
                investor.loc[ticker,"기관합계"],
                True
            )
            if ticker in investor.index
            else None,


        "individual_net_buy":
            clean_num(
                investor.loc[ticker,"개인"],
                True
            )
            if ticker in investor.index
            else None,



        # ==================
        # 재무
        # ==================

        "per":
            clean_num(
                r.get("PER")
            ),


        "pbr":
            clean_num(
                r.get("PBR")
            ),


        "eps":
            clean_num(
                r.get("EPS"),
                True
            ),


        "bps":
            clean_num(
                r.get("BPS"),
                True
            ),



        # ==================
        # 수익률
        # ==================

        "ret_1m":
            clean_num(
                r.get("ret_1m")
            ),


        "ret_6m":
            clean_num(
                r.get("ret_6m")
            ),


        "ret_1y":
            ret_1y,


        "rs_1y":
            None
            if ret_1y is None
            else round(
                ret_1y - bench,
                4
            )


        }

        )



    n = upsert(
        client,
        "snapshot",
        rows
    )


    log(
        f"Snapshot 저장 완료 : {n}건"
    )


    return n

# ==================================================
# 일별 시세 저장
# ==================================================

def save_day(
    client,
    d,
    ohlcv,
    fund,
    universe
):

    if ohlcv.empty:
        return 0



    iso = (
        f"{d[:4]}-"
        f"{d[4:6]}-"
        f"{d[6:]}"
    )



    rows = []



    for ticker, r in ohlcv.iterrows():


        if ticker not in universe:
            continue



        rows.append(

        {

        "date":
            iso,

        "ticker":
            ticker,

        "open":
            clean_num(
                r.get("시가"),
                True
            ),

        "high":
            clean_num(
                r.get("고가"),
                True
            ),

        "low":
            clean_num(
                r.get("저가"),
                True
            ),

        "close":
            clean_num(
                r.get("종가"),
                True
            ),

        "volume":
            clean_num(
                r.get("거래량"),
                True
            ),

        "value":
            clean_num(
                r.get("거래대금"),
                True
            )

        }

        )



    upsert(
        client,
        "daily_price",
        rows
    )



    if fund is not None and not fund.empty:


        frows = []


        for ticker, r in fund.iterrows():


            if ticker not in universe:
                continue



            frows.append(

            {

            "date":
                iso,

            "ticker":
                ticker,


            "per":
                clean_num(
                    r.get("PER")
                ),


            "pbr":
                clean_num(
                    r.get("PBR")
                ),


            "eps":
                clean_num(
                    r.get("EPS"),
                    True
                ),


            "bps":
                clean_num(
                    r.get("BPS"),
                    True
                ),


            "div":
                clean_num(
                    r.get("DIV")
                )

            }

            )



        upsert(
            client,
            "daily_fundamental",
            frows
        )



    return len(rows)





# ==================================================
# MAIN
# ==================================================

def main():


    parser = argparse.ArgumentParser()


    parser.add_argument(
        "--mode",
        choices=[
            "daily",
            "backfill",
            "master"
        ],
        default="daily"
    )


    parser.add_argument(
        "--days",
        type=int,
        default=400
    )



    args = parser.parse_args()



    client = sb()



    base_date = latest_business_day()



    log(
        f"기준일 {base_date}"
    )



    status = "success"

    message = ""

    rows = 0



    try:



        # ---------------------------------
        # 최신 데이터
        # ---------------------------------

        (
            ohlcv,
            cap,
            fund,
            investor

        ) = fetch_day(
            base_date
        )



        universe = compute_universe(
            ohlcv,
            cap
        )



        log(
            f"Universe {len(universe)}"
        )



        # ---------------------------------
        # master
        # ---------------------------------

        if args.mode == "master":


            sync_master(
                client,
                base_date,
                universe
            )



        # ---------------------------------
        # backfill
        # ---------------------------------

        elif args.mode == "backfill":


            sync_master(
                client,
                base_date,
                universe
            )



            frm = (
                date.today()
                -
                timedelta(
                    days=args.days
                )
            ).strftime(
                "%Y%m%d"
            )



            days = business_days(
                frm,
                base_date
            )



            log(
                f"backfill {len(days)} days"
            )



            for i,d in enumerate(days,1):


                if d == base_date:


                    day_ohlcv = ohlcv

                    day_fund = fund



                else:


                    try:


                        (
                            day_ohlcv,
                            _,
                            day_fund,
                            _

                        ) = fetch_day(
                            d
                        )


                    except Exception as e:


                        log(
                            f"{d} skip {e}"
                        )

                        continue



                cnt = save_day(
                    client,
                    d,
                    day_ohlcv,
                    day_fund,
                    universe
                )


                rows += cnt



                if i % 10 == 0:


                    log(
                        f"{i}/{len(days)}"
                    )



                time.sleep(
                    0.3
                )



            # snapshot 생성

            build_snapshot(
                client,
                base_date,
                ohlcv,
                cap,
                fund,
                investor,
                universe
            )




        # ---------------------------------
        # daily
        # ---------------------------------

        else:



            sync_master(
                client,
                base_date,
                universe
            )



            rows = save_day(
                client,
                base_date,
                ohlcv,
                fund,
                universe
            )



            build_snapshot(
                client,
                base_date,
                ohlcv,
                cap,
                fund,
                investor,
                universe
            )



    except Exception as e:


        status = "failed"

        message = str(e)

        log(
            f"ERROR {e}"
        )



    finally:


        try:


            client.table(
                "collect_log"
            ).insert(

            {

            "base_date":
                f"{base_date[:4]}-"
                f"{base_date[4:6]}-"
                f"{base_date[6:]}",


            "mode":
                args.mode,


            "rows":
                rows,


            "status":
                status,


            "message":
                message

            }

            ).execute()



        except Exception:

            pass




    if status == "failed":

        sys.exit(1)



    log(
        "완료"
    )




if __name__ == "__main__":

    main()
