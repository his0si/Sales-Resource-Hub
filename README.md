# server

한솔홈데코_HRBP(AX) 사내 영업 지원 플랫폼 — **세일즈 리소스 허브**

- **백엔드**: FastAPI + asyncpg (`server/`)
- **프론트엔드**: Vite + React + React Router (`client/`)
- **DB**: 호스트 네이티브 PostgreSQL 14 (포트 5433)
- **로컬 LLM**: Ollama (`qwen2.5:14b`) — 세일즈 메모 AI 요약/브리핑
- **도메인**: https://hansolax.kro.kr

---

## 1. 기능 현황 한눈에

사이드바 메뉴(`client/src/components/AppShell.tsx`) 기준 4개 화면 + 인증.
**현재 백엔드까지 완성된 기능은 "세일즈 메모"뿐이고, 나머지 화면은 프론트엔드(디자인 + 예시 데이터)만 구현된 상태**입니다.

| 화면 | 경로 | 상태 | 데이터 출처 |
|------|------|------|-------------|
| **세일즈 메모** | `/sales-memo` | ✅ **풀스택** | Gmail 자동 적재 → `sales_memo` DB + 조직표 분류 + 로컬 LLM 요약 |
| 홈 | `/` | 🔸 프론트 + 인증 | 로그인 상태/공용 메일함(Gmail) |
| 소비자 동향 | `/trends`, `/trends/posts`, `/trends/products` | 🔹 프론트만 | `client/src/pages/trends/data.ts` (Figma 예시 데이터) |
| 뉴스 | `/news` | 🔹 프론트만 | `client/src/pages/News.tsx` 내 예시 배열 (네이버 뉴스 API 미연동) |
| 로그인 / 회원가입 | `/login`, `/register` | ✅ 백엔드 연동 | `users` DB + Gmail SMTP 인증 |

> 🔹 표시는 백엔드 API가 아직 없어 화면 안의 예시 데이터를 쓰는 상태입니다. API가 생기면 해당 데이터 파일만 교체하면 됩니다.
> 뉴스는 스키마(`db/news.sql`, `raw_news_articles`/`working_news_articles`)만 준비돼 있고 수집기·라우터는 미구현입니다.

---

## 2. 배포 아키텍처

이 서버에는 다른 서비스들도 배포돼 있고, **호스트 nginx**(systemd)가 80/443을 잡아 도메인별로 리버스 프록시합니다.

```
인터넷
  │  443 (SSL, 호스트 nginx가 종료)
  ▼
호스트 nginx ── hansolax.kro.kr ──▶ 127.0.0.1:8100
                                       │ (web 컨테이너 / nginx)
                          ┌────────────┴─────────────┐
                          ▼                          ▼
                  정적 프론트엔드            /api ──▶ api 컨테이너 :8000 (FastAPI)
                                                      │
                                                      ▼
                              호스트 PostgreSQL 5433 (host.docker.internal)
                              호스트 Ollama 11434 (host.docker.internal)
```

- **web 컨테이너**: 빌드된 프론트엔드 서빙 + `/api` 프록시. 호스트 `127.0.0.1:8100`에만 바인딩(외부 직접 노출 없음).
- **api 컨테이너**: FastAPI(uvicorn). 컴포즈 내부 네트워크에서만 접근. DB·Ollama는 `host.docker.internal`로 호스트에 접근.
- **SSL**: 호스트 nginx가 종료. 인증서는 acme.sh + **ZeroSSL**로 발급.

> `hansolax` 유저는 docker 그룹이 아니라서 docker 명령에 `sudo`가 필요합니다(`./deploy.sh`, `./setup-ssl.sh`가 알아서 sudo 사용).

---

## 3. 데이터베이스

PostgreSQL은 **도커가 아니라 호스트에 네이티브로** 설치돼 있고, **앱별로 클러스터를 분리**해 운영합니다.

| 클러스터 | 포트 | DB / 유저 | 용도 |
|----------|------|-----------|------|
| `14/hansolax` | 5433 | hansolax | 이 앱 |

- 모든 클러스터는 **`127.0.0.1`에만 바인딩**(외부 미노출). 외부 접속은 **SSH 터널** 필요.
- 클러스터 목록 확인: `pg_lsclusters`

### 테이블

| 테이블 | 정의 파일 | 역할 |
|--------|-----------|------|
| `users` | `db/init_hansolax.sql` | 가입자(이메일·bcrypt 비번·이름·부서·인증여부) |
| `sales_memo` | `db/sales_memo.sql` | 영업일지. [HSP SalesMemo] 메일 자동 적재 + xlsx 초기분 |
| `employees` | `db/employees.sql` | **조직 마스터**(부문·부서·사번·성명). 메모 작성자 → 부서/부문 판별용 |
| `raw_news_articles`, `working_news_articles` | `db/news.sql` | 뉴스 스키마(미연동, 예약) |

### 초기 구축 / 재구축

SQL은 `db/`에 있습니다. **`postgres` 리눅스 유저가 홈 디렉터리를 못 읽으므로 `-f` 대신 `<`(stdin)로 실행**합니다.

```bash
# 1) hansolax 전용 클러스터 생성(최초 1회)
sudo pg_createcluster 14 hansolax --port 5433 --start

# 2) DB/유저/users 테이블 (init 의 __SET_YOUR_PASSWORD__ 를 실제 비번으로 교체 후)
sudo -u postgres psql -p 5433 < db/init_hansolax.sql

# 3) 도메인 테이블 적재 (앱 유저로 접속)
PGPASSWORD=<pw> psql -h 127.0.0.1 -p 5433 -U hansolax -d hansolax -f db/sales_memo.sql
PGPASSWORD=<pw> psql -h 127.0.0.1 -p 5433 -U hansolax -d hansolax -f db/employees.sql
```

> `db/init_hansolax.sql`은 비밀번호를 `__SET_YOUR_PASSWORD__` placeholder로 둔 템플릿입니다. 실제 비번은 `ALTER USER`로 바꾸고 **`.env`에만** 보관하세요(커밋된 SQL과 실제 비번이 같으면 안 됨).
> `db/employees.sql`은 `ON CONFLICT` upsert라 조직 개편 시 같은 파일을 다시 돌리면 멱등하게 갱신됩니다.

### DBeaver 접속 (SSH 터널)

- **SSH 탭**: Host = 서버 공인 IP, Port = SSH 포트, 인증 = PEM 키
- **Main 탭**: Host = `localhost`, Port = `5433`, DB = `hansolax`, User = `hansolax`
  - 핵심: Main의 Host는 **`localhost`** (DBeaver가 SSH로 서버에 들어간 뒤 *서버 내부에서* 접속)

### 앱(컨테이너) 연결

api는 컨테이너라 호스트 5433에 `localhost`로 못 붙습니다. `server/.env`에 **`host.docker.internal`** 로 지정:

```
DATABASE_URL=postgresql://hansolax:<password>@host.docker.internal:5433/hansolax
```

동작 조건 두 가지:
- `docker-compose.prod.yml`의 api 서비스에 `extra_hosts: ["host.docker.internal:host-gateway"]`
- 5433 클러스터가 docker 브리지(172.17.0.1)에서의 접속을 허용:

```bash
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost,172.17.0.1'/" /etc/postgresql/14/hansolax/postgresql.conf
echo "host    hansolax    hansolax    172.16.0.0/12    scram-sha-256" | sudo tee -a /etc/postgresql/14/hansolax/pg_hba.conf
sudo pg_ctlcluster 14 hansolax restart
```

연결 확인:

```bash
curl http://127.0.0.1:8100/api/db-health   # → {"db":"ok","result":1}
curl http://127.0.0.1:8100/api/users       # → users 목록(비번 제외)
```

| 파일 | 역할 |
|------|------|
| `server/app/config.py` | `.env` 설정 로딩(pydantic-settings) |
| `server/app/db.py` | asyncpg 풀 생성/해제(연결 실패해도 앱은 기동) |
| `server/app/routers/database.py` | `GET /api/db-health`, `GET /api/users` |
| `server/app/main.py` | lifespan에서 풀 + 백그라운드 태스크 관리 |

---

## 4. 로그인 인증

이메일 도메인 제한 + Gmail SMTP 이메일 인증 + JWT 로그인.

1. **회원가입** `POST /api/auth/register` — 허용 도메인(`@hansolax.com`)만 통과. 미인증 유저 생성 후 인증 메일 발송.
2. **이메일 인증** `GET /api/auth/verify?token=...` — 메일 링크. JWT(`type=verify`) 검증 → `is_verified=TRUE` → `/login?verified=success` 리다이렉트.
3. **로그인** `POST /api/auth/login` — 자격 + 인증여부 확인 후 access JWT 발급.
4. **본인 조회** `GET /api/auth/me` — `Authorization: Bearer <token>`.
5. **프로필/비번** `PATCH /api/auth/profile`, `POST /api/auth/change-password`.
6. **허용 도메인·부서 목록** `GET /api/auth/config` — 프론트가 가입 폼 안내/검증에 사용(단일 출처).

| 파일 | 역할 |
|------|------|
| `server/app/security.py` | bcrypt 해싱 + JWT 발급/검증 |
| `server/app/email_utils.py` | Gmail SMTP 인증 메일 발송 |
| `server/app/routers/auth.py` | 위 엔드포인트 |
| `client/src/pages/{Register,Login}.tsx`, `components/AccountModal.tsx` | 가입/로그인/계정 화면 |

- **Gmail 앱 비밀번호**: Google 계정 → 보안 → 2단계 인증 ON → "앱 비밀번호" 생성 → `.env`의 `SMTP_PASSWORD`.
- SMTP 미설정 시 메일 발송 대신 인증 링크를 **api 컨테이너 로그**에 출력(개발용).

---

## 5. 세일즈 메모 (핵심 기능, 풀스택)

`ai.hansolhomedeco@gmail.com` 메일함으로 오는 **[HSP SalesMemo]** 메일(거래선 방문 영업일지)을 백엔드가 주기적으로 읽어 파싱·적재하고, 화면은 Gmail이 아니라 **DB만** 본다. 적재된 메모는 조직표로 부서를 분류하고, 로컬 LLM으로 3줄 요약/주간 브리핑을 만든다.

### 5.1 메일 자동 적재 (폴러)

1. **메일 읽기** — `gmail_client.py`가 OAuth2 refresh token으로 Gmail API(`users.messages`) 호출. (최초 1회 `server/scripts/gmail_authorize.py`로 refresh token 발급 → `.env`)
2. **폴링 적재** — `sales_memo_sync.py`가 `SALES_MEMO_POLL_SECONDS`(기본 300초)마다 `subject:"HSP SalesMemo"` 메일을 확인. 새 메일만 `sales_memo_parser.py`로 파싱해 upsert. `main.py` lifespan의 백그라운드 태스크.
3. **AI 요약 백필** — `summary_backfill.py`가 요약이 없는 메모를 골라 로컬 LLM으로 3줄 요약을 미리 생성해 `ai_summary`에 저장(GPU 과점유 방지용 인터벌).

**메일 표 라벨 → `sales_memo` 컬럼**

| 메일 라벨 | 컬럼 | 메일 라벨 | 컬럼 |
|-----------|------|-----------|------|
| 거래선 | customer_name | 활동계획 | activity_plan |
| 방문예정일 | planned_visit_date | 전략 | strategy |
| 방문일 | visit_date | 운영 | operation |
| 작성자 | author_name | 제품 | product |
| 작성일 | written_at | 개인 | personal |
| 영업사원 시사점 | takeaway | 팀장 피드백 | followup_plan |

- 메일에 없는 `customer_code`/`author_emp_no`는 같은 거래선·작성자의 기존 행에서 **자동 보강**.
- **중복 방지**: `gmail_id`(부분 UNIQUE 인덱스). 메일 유입 행의 `visit_no`는 `'GM'+gmail_id`. xlsx 초기분은 `gmail_id=NULL`로 공존 → 한 화면에 최신순 표시.

> ⚠️ **Gmail OAuth 주의**: refresh token이 만료/취소되면(`invalid_grant`) 폴러는 계속 돌지만 매 주기 인증에서 실패해 **신규 메일이 안 들어옵니다**. 
> 헬스 체크: `cd server && python3 -c "import httpx;from app.config import settings as s;print(httpx.post('https://oauth2.googleapis.com/token',data={'client_id':s.gmail_client_id,'client_secret':s.gmail_client_secret,'refresh_token':s.gmail_refresh_token,'grant_type':'refresh_token'}).status_code)"` → 200이면 정상.

### 5.2 부서·부문 판별 (조직 마스터)

메모 작성자가 **어느 부서/부문 소속인지**를 `employees` 조직표와 대조해 판별한다(보드 정렬·필터·표시에 사용).

- 매칭 우선순위: **사번(`author_emp_no` = `emp_no`) → 성명(`author_name` = `name`)**.
  - 사번은 사람마다 유일해 동명이인이 있어도 정확. 성명 폴백은 **동명이인(2곳 이상 매핑)이면 모호하다고 보고 미분류** 처리(오분류 방지).
- 가입자(users) 여부와 무관하게 조직표만으로 분류되므로, 미가입 작성자도 부서가 뜬다.

| 파일 | 역할 |
|------|------|
| `db/employees.sql` | 조직 마스터 테이블 + 데이터(upsert) |
| `server/app/employees.py` | `employees` 로드 → 사번/성명 → (부서, 부문) 조회기 |

### 5.3 화면용 API

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/sales-memo` | 전체 메모 최신순(작성일→방문일→id) |
| `GET /api/sales-memo/board` | 보드 카드 가공: 부서/부문 판별 + 해시태그 + 본인부서 우선 정렬 + 새 글 표시 |
| `GET /api/sales-memo/{id}` | 단건 원문(부서/부문 포함). "원문" 모달용 |
| `GET /api/sales-memo/{id}/summary` | 메모 1건 3줄 AI 요약(저장분 우선, 없으면 즉석 생성·저장) |
| `GET /api/sales-memo/briefing` | 최근 메모 묶음을 로컬 LLM으로 요약한 주간 브리핑(30분 캐시) |
| `GET /api/categories` | 제품 카테고리 트리(해시태그/제품 필터용, `categories.json` 기반) |
| `GET /api/gmail/inbox`·`/messages/{id}` | 공용 메일함 원본 직접 조회(홈 화면) |

**보드 카드 표시 규칙**
- **부서/부문**: `employees` 조직표로 판별(§5.2).
- **해시태그**: 본문을 `categories.json` 제품 키워드 + 지역/주제 사전과 매칭(`categories.py`).
- **새 글 점(●/○)**: 목록 내 **가장 최근 작성일 기준 1일 이내**면 채운 점. (절대 날짜/읽음 여부 아님)
- **본인 부서**: 로그인 사용자의 `department`(없으면 `MY_DEPARTMENT` 폴백)와 같으면 "본인 부서" 뱃지 + 기본 정렬 시 상단.

| 파일 | 역할 |
|------|------|
| `server/app/routers/sales_memo.py` | 위 메모 엔드포인트 |
| `server/app/sales_memo_ai.py` | 메모 1건 3줄 요약 프롬프트/파싱 |
| `server/app/categories.py` + `server/app/data/categories.json` | 제품 카테고리 트리 + 키워드 분류/태그 |
| `server/app/llm.py` | Ollama 호출 래퍼 |
| `client/src/pages/SalesMemoBoard.tsx` + `components/{MemoTable,salesmemo.css}` | 보드 화면 |

### 5.4 로컬 LLM (Ollama)

- 컨테이너에서는 `OLLAMA_URL=http://host.docker.internal:11434`로 호스트 Ollama 사용, 모델 `qwen2.5:14b`.
- 용도: ① 메모별 3줄 요약(`ai_summary`), ② 부서 관점 주간 브리핑.
- `.env`의 `AI_SUMMARY_ENABLED`/`AI_SUMMARY_INTERVAL`로 백필 동작 조정.

---

## 6. 프론트엔드 구조

`client/src/components/AppShell.tsx`가 공통 앱 셸(사이드바·헤더·통합검색)을 제공하고, 각 화면을 그 안에 렌더링한다.

```
client/src/
├── App.tsx                 # 라우팅 (홈/동향/뉴스/세일즈메모/로그인/가입)
├── api.ts                  # 백엔드 호출 모음 (fetch 래퍼)
├── components/
│   ├── AppShell.tsx        # 사이드바 + 헤더 (모든 대시보드 화면 공용)
│   ├── MemoTable.tsx       # 세일즈 메모 원문 표 재구성
│   ├── AccountModal.tsx    # 로그인/계정 모달
│   └── AuthVisual.tsx      # 로그인/가입 비주얼
└── pages/
    ├── Home.tsx            # 홈 (로그인 상태 + 공용 메일함)
    ├── SalesMemoBoard.tsx  # ✅ 세일즈 메모 보드 (풀스택)
    ├── News.tsx            # 🔹 뉴스 (예시 데이터)
    ├── trends/             # 🔹 소비자 동향 (data.ts 예시 데이터)
    │   ├── TrendsMain.tsx / PostList / PostDetail / ProductList / ProductDetail
    │   └── data.ts         # 동향 예시 데이터(백엔드 생기면 이 파일 교체)
    └── {Login,Register}.tsx
```

---

## 7. 운영 배포 (hansolax.kro.kr)

### 사전 준비
1. DNS: `hansolax.kro.kr`가 이 서버의 공인 IP를 가리켜야 함(kro.kr DDNS).
2. `cp .env.example .env` 후 값 입력(DB·JWT·SMTP·Gmail OAuth·Ollama·부서 등). **`server/.env`도 별도로 채움**(api 컨테이너가 읽음).

### 1) 앱 컨테이너 기동
```bash
./deploy.sh        # web → 127.0.0.1:8100. (curl http://127.0.0.1:8100/api/health 로 확인)
```

### 2) 호스트 nginx 등록 + SSL 발급 (최초 1회)
```bash
./setup-ssl.sh
```
- **ZeroSSL** 인증서를 `acme.sh`로 발급(`*.kro.kr`은 Let's Encrypt 한도를 공유해 자주 막혀 ZeroSSL 사용).
- `acme.sh`는 hansolax 유저로 설치/실행(자동 갱신 cron도 이 유저). nginx reload만 비번 없이 되도록 `/etc/sudoers.d/hansolax-nginx-reload`에 그 명령 하나만 등록.
- 인증서는 `/etc/nginx/ssl/hansolax.kro.kr/`에 설치, `deploy/nginx-hansolax-ssl.conf`가 443 + HTTP→HTTPS 처리.

완료 후: https://hansolax.kro.kr , 헬스 https://hansolax.kro.kr/api/health.

### 코드 수정 후 재배포
```bash
./deploy.sh        # 변경분만 빌드해 재기동. nginx/SSL 유지
# 또는 컨테이너만:
sudo docker compose -f docker-compose.prod.yml up -d --build api   # 백엔드 코드 변경 반영
sudo docker compose -f docker-compose.prod.yml restart api          # .env만 바뀐 경우(재빌드 불필요)
```

> **언제 rebuild vs restart?** `.py`/프론트 코드가 바뀌면 `--build`(이미지 재빌드). `.env` 값만 바뀌면 `restart`로 충분(환경변수는 기동 시 로드). DB 데이터/스키마 변경은 컨테이너와 무관(호스트 DB 직접 반영).

수동 강제 인증서 갱신: `~/.acme.sh/acme.sh --renew -d hansolax.kro.kr --force --ecc`

---

## 8. 로컬 개발

```bash
# 백엔드 (http://localhost:8000, 문서 /docs)
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# .env 에 DATABASE_URL 을 127.0.0.1:5433 으로 두고 SSH 터널 또는 로컬 PG 사용
fastapi dev app/main.py

# 프론트엔드 (http://localhost:5173)
cd client
npm install
npm run dev
```

---

## 9. 디렉터리 구조

```
.
├── client/                      # Vite + React 프론트엔드
│   ├── Dockerfile               # 빌드 → nginx 서빙(컨테이너 내부 80)
│   └── nginx.conf               # 정적 서빙 + /api 프록시 (HTTP only)
├── server/                      # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py              # FastAPI 앱 + lifespan(풀/폴러/요약 백필)
│   │   ├── config.py            # .env 설정(pydantic-settings)
│   │   ├── db.py                # asyncpg 풀
│   │   ├── security.py          # bcrypt + JWT
│   │   ├── email_utils.py       # SMTP 인증 메일
│   │   ├── gmail_client.py      # Gmail API(OAuth2)
│   │   ├── sales_memo_sync.py   # [HSP SalesMemo] 폴러
│   │   ├── sales_memo_parser.py # 메일 HTML 표 → 컬럼
│   │   ├── sales_memo_ai.py     # 메모 3줄 요약
│   │   ├── summary_backfill.py  # 요약 백그라운드 백필
│   │   ├── employees.py         # 조직표 → 부서/부문 판별
│   │   ├── categories.py        # 제품 카테고리 분류/태그
│   │   ├── llm.py               # Ollama 호출
│   │   ├── data/categories.json # 제품 카테고리 트리
│   │   └── routers/             # auth, database, gmail, sales_memo, categories, health
│   ├── scripts/gmail_authorize.py  # Gmail refresh token 최초 발급
│   └── Dockerfile               # uvicorn
├── db/
│   ├── init_hansolax.sql        # DB/유저/users (비번 placeholder 템플릿)
│   ├── sales_memo.sql           # 영업일지 테이블(+gmail_id 부분 유니크 인덱스)
│   ├── employees.sql            # 조직 마스터(부문·부서·사번·성명, upsert)
│   └── news.sql                 # 뉴스 스키마(미연동, 예약)
├── deploy/
│   ├── nginx-hansolax-http.conf # 발급 중 HTTP(ACME 챌린지 + 프록시)
│   └── nginx-hansolax-ssl.conf  # 최종 HTTPS
├── docker-compose.prod.yml      # web(127.0.0.1:8100) + api(내부)
├── setup-ssl.sh                 # 호스트 nginx 등록 + ZeroSSL 발급(최초 1회)
├── deploy.sh                    # 빌드 + 재배포
└── .env.example                # 설정 템플릿
```

> 도메인/포트를 바꾸려면 `.env`, `deploy/nginx-hansolax-*.conf`(server_name·upstream), `docker-compose.prod.yml`(8100)을 함께 수정하세요.
