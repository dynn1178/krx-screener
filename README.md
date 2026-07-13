# 📈 KRX 종목 스크리너

회사 PC의 SSL 검사 문제를 우회하기 위해 **수집을 클라우드로 분리**한 구조입니다.
회사에서는 브라우저로 접속만 하므로 Python도, KRX 접속도 필요 없습니다.

```
GitHub Actions (평일 16:30 KST)
  └─ collector/collect.py  ── pykrx로 전 종목 일괄 수집
        │
        ▼
   Supabase (PostgreSQL)
     · stocks             종목 마스터 (이름/업종/DART 고유번호)
     · daily_price        일별 시세 (전 종목 × 일자)
     · daily_fundamental  일별 PER/PBR/EPS/BPS/DIV
     · snapshot           최신 스크리닝용 (앱이 읽는 테이블)
        │
        ▼
   Next.js on Vercel
     · /              스크리닝 (Supabase에서 읽어 브라우저에서 즉시 필터링)
     · /stock/[코드]  주가·재무·밸류밴드·뉴스
     · /api/dart      DART 재무제표 (서버사이드 호출)
     · /api/news      네이버 뉴스 (서버사이드 호출)
        │
        ▼
   집 · 회사 브라우저
```

---

## 셋업 순서 (약 40분)

### 1. Supabase

1. https://supabase.com → New project
2. **SQL Editor** → `supabase/schema.sql` 전체 붙여넣기 → Run
3. **Settings → API** 에서 3가지 값 복사
   - `Project URL`
   - `anon public` 키 → 웹앱 읽기용
   - `service_role` 키 → 수집기 쓰기용 **(절대 브라우저/깃허브에 노출 금지)**

### 2. GitHub

1. 이 폴더 전체를 **Private** 저장소로 push
2. **Settings → Secrets and variables → Actions** 에 5개 등록

   | Secret | 값 |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_KEY` | service_role 키 |
   | `KRX_ID` | data.krx.co.kr 아이디 |
   | `KRX_PW` | data.krx.co.kr 비밀번호 |
   | `DART_API_KEY` | opendart.fss.or.kr 인증키 |

3. **Actions → KRX 데이터 수집 → Run workflow**
   - mode: **`backfill`**, days: `400` → 과거 1년치 채우기 (약 10~20분)
   - 이후 평일 16:30에 `daily` 모드로 자동 실행

> ⚠️ GitHub Actions 러너는 해외 IP입니다. KRX가 차단하면 로그에 SSL/403 에러가 뜹니다.
> 그 경우 아래 **"수집이 막힐 때"** 를 참고하세요.

### 3. Vercel

1. https://vercel.com → New Project → 같은 저장소 선택
2. **Root Directory** 를 **`web`** 으로 지정 ← 중요
3. Environment Variables 5개 등록

   | 변수 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 |
   | `DART_API_KEY` | DART 인증키 |
   | `NAVER_CLIENT_ID` | 네이버 검색 API |
   | `NAVER_CLIENT_SECRET` | 네이버 검색 API |

4. Deploy → `https://xxx.vercel.app`

---

## API 키 발급 (모두 무료)

| 키 | 발급처 |
|---|---|
| KRX 계정 | https://data.krx.co.kr → 회원가입 |
| DART 인증키 | https://opendart.fss.or.kr → 인증키 신청 |
| 네이버 검색 | https://developers.naver.com → 애플리케이션 등록 → **검색** 선택 |

---

## 수집이 막힐 때 (해외 IP 차단 시)

집 PC에서 하루 1회 돌리면 됩니다. 집은 SSL 검사가 없으니 잘 동작합니다.

```bash
cd collector
pip install -r requirements.txt

set SUPABASE_URL=https://xxx.supabase.co
set SUPABASE_SERVICE_KEY=eyJ...
set KRX_ID=아이디
set KRX_PW=비밀번호
set DART_API_KEY=인증키

python collect.py --mode backfill --days 400   # 최초 1회
python collect.py --mode daily                 # 이후 매일
```

**작업 스케줄러 등록** — `collect.bat` 만들어서 평일 16:40 실행 등록:

```bat
@echo off
cd /d C:\krx\collector
set SUPABASE_URL=...
set SUPABASE_SERVICE_KEY=...
set KRX_ID=...
set KRX_PW=...
set DART_API_KEY=...
python collect.py --mode daily
```

집 PC가 꺼져 있어도 앱은 마지막 수집 데이터로 정상 동작합니다.

---

## 수집 모드

| 모드 | 하는 일 | 소요 |
|---|---|---|
| `master` | 종목명/업종/DART 고유번호만 갱신 | ~2분 |
| `daily` | 오늘 시세·밸류 + 스냅샷 재생성 | ~1분 |
| `backfill` | 과거 N일 시세·밸류 채우기 | 400일 ≈ 15분 |

`backfill` 은 최초 1회만. 주가 차트와 밸류에이션 밴드에 필요합니다.

---

## 로컬 개발 (집에서)

```bash
cd web
npm install
cp .env.local.example .env.local     # 값 채우기
npm run dev                          # http://localhost:3000
```

---

## 설계 노트

**왜 스냅샷 테이블을 따로 두는가**
스크리닝은 최신 1일치만 필요합니다. 2,700행을 한 번에 받아 브라우저에서 필터링하면
슬라이더를 움직일 때마다 서버 왕복 없이 즉시 반응합니다. 시계열(`daily_price`)은
상세 화면에서만 해당 종목 것만 조회합니다.

**왜 DART/뉴스를 API 라우트로 빼는가**
키가 브라우저에 노출되지 않고, 회사 PC가 외부 API를 직접 호출하지 않으므로
SSL 검사 문제가 발생하지 않습니다.

**"전망"에 대해**
애널리스트 컨센서스·목표주가는 무료 API가 사실상 없습니다(FnGuide 등 유료).
대신 **실적 추세(DART) + 밸류에이션 밴드 내 현재 위치**로 대체 구성했습니다.

**한계**
- `daily_fundamental` 의 PER/PBR은 KRX 공시 반영 기준이라 시차가 있습니다
  (12월 결산 → 3월 사업보고서 → KRX 5월경 반영). 정밀한 판단은 DART 재무 탭과 함께 보세요.
- Supabase 무료 티어는 500MB. 일별 데이터 400일 × 2,700종목 ≈ 100MB 수준이라
  2~3년치까지는 여유가 있습니다.
- 본 도구는 **후보군을 좁히는 탐색용**이며 투자 판단 근거가 아닙니다.

---

## 다음에 붙일 만한 것

- **관심종목** — Supabase 테이블 + Supabase Auth → 집/회사 동기화
- **수급** — 외국인·기관 순매수 (종목별 호출이라 관심종목만 수집하는 게 현실적)
- **알림** — 조건 충족 종목 발생 시 Slack/카카오
- **백테스트** — `daily_price` 가 쌓이면 "이 조건으로 6개월 전 샀다면?" 검증 가능
