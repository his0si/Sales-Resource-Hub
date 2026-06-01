# server

한솔홈데코_HRBP(AX) 서버

- **백엔드**: FastAPI (`server/`)
- **프론트엔드**: Vite + React (`client/`)
- **도메인**: https://hansolax.kro.kr

---

## 배포 아키텍처

이 서버에는 이미 다른 서비스들이 배포돼 있고, **호스트 nginx**(systemd)가 80/443을 잡고 도메인별로 리버스 프록시합니다:

| 도메인 | 프록시 대상 |
|--------|-------------|
| hansolax.kro.kr | 127.0.0.1:8100 |

그래서 이 앱은 80/443을 직접 잡지 않고, 같은 패턴을 따릅니다:

```
인터넷
  |  443 (SSL)
  v
호스트 nginx -- hansolax.kro.kr --> 127.0.0.1:8100
                                       | (web 컨테이너 / nginx)
                          +------------+-------------+
                          v                          v
                  정적 프론트엔드           /api --> api 컨테이너 :8000 (FastAPI)
```

- **web 컨테이너**: 빌드된 프론트엔드 서빙 + `/api`를 백엔드로 프록시. 호스트 `127.0.0.1:8100`에만 바인딩(외부 직접 노출 없음).
- **api 컨테이너**: FastAPI(uvicorn). 컴포즈 내부 네트워크에서만 접근.
- **SSL**: 호스트 nginx가 종료. 인증서는 acme.sh + **ZeroSSL**로 발급.

> 참고: `hansolax` 유저는 docker 그룹이 아니라서 docker 명령에 `sudo`가 필요합니다(`./deploy.sh`, `./setup-ssl.sh`가 알아서 sudo 사용). 실행 시 비밀번호를 물어봅니다.

---

## 데이터베이스

PostgreSQL은 **도커가 아니라 호스트에 네이티브로** 설치돼 있고, **앱별로 클러스터(인스턴스)를 분리**해서 운영합니다. 

| 클러스터 | 포트 | DB / 유저 | 용도 |
|----------|------|-----------|------|
| `14/hansolax` | 5433 | hansolax | 이 앱 |

- 모든 클러스터는 **`127.0.0.1`에만 바인딩**(외부 미노출). 외부에서 붙으려면 **SSH 터널**을 통해야 합니다.
- 클러스터 목록 확인: `pg_lsclusters`


### 초기 구축 / 재구축

SQL 스크립트는 `db/`에 있습니다. **`postgres` 리눅스 유저가 홈 디렉터리를 못 읽으므로 `-f` 대신 `<`(stdin)로 실행**합니다.

```bash
# 1) hansolax 전용 클러스터 생성(최초 1회)
sudo pg_createcluster 14 hansolax --port 5433 --start

# 2) db/init_hansolax.sql 의 __SET_YOUR_PASSWORD__ 를 실제 비밀번호로 교체 후
sudo -u postgres psql -p 5433 < db/init_hansolax.sql
```

> `db/init_hansolax.sql`은 비밀번호를 `__SET_YOUR_PASSWORD__` **placeholder로 둔 채 커밋**합니다(템플릿). 실제 비밀번호는 생성 후 `ALTER USER hansolax WITH PASSWORD '...'`로 바꾸고 **`.env`에만** 보관하세요. 즉 커밋된 SQL과 실제 비번이 절대 같으면 안 됩니다.

### DBeaver 접속 (SSH 터널)

DB는 외부 미노출이라 SSH 터널로 붙습니다.

- **SSH 탭**: Host = 서버 공인 IP, Port = SSH 포트, 인증 = PEM 키
- **Main 탭**: Host = `localhost`, Port = `5433`, Database = `hansolax`, User = `hansolax`
  - 핵심: Main의 Host는 **`localhost`** (DBeaver가 SSH로 서버에 들어간 뒤 *서버 내부에서* 접속하기 때문)

### 앱 연결

api는 **컨테이너**라서 호스트의 5433에 `localhost`로 못 붙습니다. `server/.env`(api 컨테이너가 읽음)에 **`host.docker.internal`** 로 지정합니다:

```
DATABASE_URL=postgresql://hansolax:<password>@host.docker.internal:5433/hansolax
```

이게 동작하려면 두 가지가 맞물려야 합니다:
- `docker-compose.prod.yml`의 api 서비스에 `extra_hosts: ["host.docker.internal:host-gateway"]`
- 5433 클러스터가 docker 브리지(172.17.0.1)에서의 접속을 허용 (아래 참고)

```bash
# 5433 클러스터가 localhost + docker 브리지에서 수신하도록
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost,172.17.0.1'/" /etc/postgresql/14/hansolax/postgresql.conf
# docker 컨테이너 대역 접속 허용
echo "host    hansolax    hansolax    172.16.0.0/12    scram-sha-256" | sudo tee -a /etc/postgresql/14/hansolax/pg_hba.conf
sudo pg_ctlcluster 14 hansolax restart
```

> `localhost`를 유지하므로 DBeaver SSH 터널(127.0.0.1:5433)도 그대로 동작합니다. 172.17.0.1은 docker 내부 브리지라 외부 인터넷에 노출되지 않습니다.

### FastAPI 연동

api 백엔드는 `asyncpg` 커넥션 풀로 위 DB에 접속합니다.

| 파일 | 역할 |
|------|------|
| `server/app/config.py` | `DATABASE_URL` 로딩(pydantic-settings) |
| `server/app/db.py` | asyncpg 풀 생성/해제. (경고만, 헬스체크로 확인) |
| `server/app/routers/database.py` | `GET /api/db-health`(SELECT 1), `GET /api/users`(목록, 비번 제외) |
| `server/app/main.py` | lifespan에서 풀 open/close |

연결 확인:

```bash
curl http://127.0.0.1:8100/api/db-health   # → {"db":"ok","result":1}
curl http://127.0.0.1:8100/api/users       # → users 목록
```

> 코드 변경 없이 재연결만 필요하면 `restart api`로 충분(풀은 기동 시 1회 생성). `.env`/의존성/코드가 바뀌면 `./deploy.sh`.

---

## 로그인 인증

이메일 도메인 제한 + Gmail SMTP 이메일 인증 + JWT 기반 로그인.

**흐름**

1. **회원가입** `POST /api/auth/register` — 허용 도메인(`@hansol.com`)만 통과. 미인증 유저 생성 후 인증 메일 발송.
2. **이메일 인증** `GET /api/auth/verify?token=...` — 메일 속 링크. JWT(`type=verify`) 검증 → `is_verified=TRUE` → 프론트 `/login?verified=success` 로 리다이렉트.
3. **로그인** `POST /api/auth/login` — 자격 + 인증여부 확인 후 access JWT 발급.
4. **본인 조회** `GET /api/auth/me` — `Authorization: Bearer <token>`.
5. **허용 도메인 조회** `GET /api/auth/config` — 프론트가 안내 문구/검증에 사용(도메인 단일 출처).

| 파일 | 역할 |
|------|------|
| `server/app/config.py` | 허용 도메인 / JWT / SMTP 설정 |
| `server/app/security.py` | bcrypt 해싱 + JWT 발급/검증 |
| `server/app/email_utils.py` | Gmail SMTP 인증 메일 발송 |
| `server/app/routers/auth.py` | 위 엔드포인트 |
| `client/src/pages/{Register,Login,Home}.tsx` | 가입/로그인/홈 화면 |


- **Gmail 앱 비밀번호**: Google 계정 → 보안 → 2단계 인증 ON → "앱 비밀번호" 생성.
- SMTP 미설정 시 메일을 보내지 않고 인증 링크를 **api 컨테이너 로그**에 출력합니다(개발용).

---

## 운영 배포 (hansolax.kro.kr)

### 사전 준비

1. DNS: `hansolax.kro.kr`가 이 서버의 공인 IP를 가리켜야 함 (kro.kr DDNS).
2. 배포 설정:
   ```bash
   cp .env.example .env      # DOMAIN_NAME, SSL_EMAIL 입력
   ```

### 1) 앱 컨테이너 기동

```bash
./deploy.sh
```
→ web 컨테이너가 `127.0.0.1:8100`에 뜹니다. (`curl http://127.0.0.1:8100/api/health` 로 확인 가능)

### 2) 호스트 nginx 등록 + SSL 발급 (최초 1회)

```bash
./setup-ssl.sh
```
- **ZeroSSL** 인증서를 `acme.sh`로 발급합니다. (`kro.kr`은 Let's Encrypt 주간 한도를 `*.kro.kr` 전체가 공유해 자주 막히므로 ZeroSSL 사용)
- `acme.sh`는 hansolax 유저로 설치/실행(자동 갱신 cron도 이 유저). sudo 실행을 거부하기 때문.
- 자동 갱신 시 nginx reload만 비번 없이 되도록 `/etc/sudoers.d/hansolax-nginx-reload`에 **그 명령 하나만** 등록.
- 인증서는 `/etc/nginx/ssl/hansolax.kro.kr/`에 설치, `deploy/nginx-hansolax-ssl.conf`가 443 + HTTP→HTTPS 리다이렉트 처리.

완료되면 https://hansolax.kro.kr , 헬스 체크 https://hansolax.kro.kr/api/health.

> 인증서 자동 갱신은 acme.sh가 설치한 일일 cron이 처리하고, 갱신되면 nginx가 자동 reload됩니다.

### 코드 수정 후 재배포

```bash
./deploy.sh        # 변경분만 빌드해서 다시 띄움. nginx/SSL은 그대로 유지
```

---

## 로컬 개발

```bash
# 백엔드 (http://localhost:8000, 문서 /docs)
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
fastapi dev app/main.py

# 프론트엔드 (http://localhost:5173)
cd client
npm install
npm run dev
```

---


SSL 인증서는 acme.sh가 설치한 일일 cron(hansolax 유저 crontab)이 자동 갱신하고, 갱신되면 nginx가 자동 reload됩니다. 수동 강제 갱신: `~/.acme.sh/acme.sh --renew -d hansolax.kro.kr --force --ecc`

---

## 구조

```
.
├── client/                     # Vite + React 프론트엔드
│   ├── Dockerfile              # 빌드 → nginx 서빙(컨테이너 내부 80)
│   └── nginx.conf              # 정적 서빙 + /api 프록시 (HTTP only)
├── server/                     # FastAPI 백엔드
│   └── Dockerfile              # uvicorn
├── deploy/
│   ├── nginx-hansolax-http.conf  # 발급 중 HTTP 설정 (ACME 챌린지 + 프록시)
│   └── nginx-hansolax-ssl.conf   # 최종 HTTPS 설정 (→ /etc/nginx/conf.d/hansolax.conf)
├── db/
│   ├── init_hansolax.sql       # hansolax DB/유저/users 테이블 생성 (5433 클러스터, 비번은 placeholder 템플릿)
│   └── isolate_dbs.sql         # (구) 단일 클러스터 시절 DB 간 CONNECT 권한 차단용
├── docker-compose.prod.yml     # web(127.0.0.1:8100) + api(내부)
├── setup-ssl.sh                # 호스트 nginx 등록 + ZeroSSL 발급 (최초 1회)
├── deploy.sh                   # 빌드 + 재배포
└── .env.example                # DOMAIN_NAME, SSL_EMAIL
```

> 도메인/포트를 바꾸려면 `.env`, `deploy/nginx-hansolax.conf`(server_name·upstream), `docker-compose.prod.yml`(8100)을 함께 수정하세요.
