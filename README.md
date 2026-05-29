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
├── docker-compose.prod.yml     # web(127.0.0.1:8100) + api(내부)
├── setup-ssl.sh                # 호스트 nginx 등록 + ZeroSSL 발급 (최초 1회)
├── deploy.sh                   # 빌드 + 재배포
└── .env.example                # DOMAIN_NAME, SSL_EMAIL
```

> 도메인/포트를 바꾸려면 `.env`, `deploy/nginx-hansolax.conf`(server_name·upstream), `docker-compose.prod.yml`(8100)을 함께 수정하세요.
