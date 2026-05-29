# server (FastAPI)

## 실행

```bash
# 가상환경 활성화
source .venv/bin/activate

# 개발 서버 실행 (http://localhost:8000)
fastapi dev app/main.py
```

- API 문서: http://localhost:8000/docs
- 헬스 체크: http://localhost:8000/api/health

## 데이터베이스 연결

이 앱은 **호스트에 네이티브로 설치된 PostgreSQL**(hansolax 전용 클러스터, 포트 **5433**)에 `asyncpg` 커넥션 풀로 접속합니다. DB를 도커로 띄우지 않습니다. (클러스터 구성·격리·DBeaver 접속 등 인프라 전반은 루트 `README.md`의 "데이터베이스" 참고.)

**접속 흐름**

```
운영(컨테이너):  api 컨테이너 ──host.docker.internal:5433──> 호스트 PostgreSQL(hansolax)
로컬 개발(호스트): fastapi dev ──localhost:5433──> (서버 위에서 직접 / 또는 SSH 터널)
```

- 접속 정보는 `server/.env`의 `DATABASE_URL` 한 줄로 지정 (api 컨테이너가 `env_file`로 읽음):
  ```
  DATABASE_URL=postgresql://hansolax:<password>@host.docker.internal:5433/hansolax
  ```
- 풀 수명은 `app/main.py`의 lifespan이 관리 (`app/db.py`의 `connect_db`/`disconnect_db`). **연결 실패해도 앱은 죽지 않고** 기동되며, 상태는 헬스체크로 확인.

**관련 코드**

| 파일 | 역할 |
|------|------|
| `app/config.py` | `DATABASE_URL` 로딩 |
| `app/db.py` | asyncpg 풀 + `get_pool()` |
| `app/routers/database.py` | `GET /api/db-health`(SELECT 1), `GET /api/users`(목록, 비번 제외) |

**연결 확인**

```bash
curl http://127.0.0.1:8100/api/db-health   # → {"db":"ok","result":1}
curl http://127.0.0.1:8100/api/users       # → users 목록
```

> **비번 불일치 주의**: `server/.env`의 비번은 앱이 *내미는* 값이고, DB에 *저장된* 비번과 같아야 합니다. 다르면 `503` + 로그에 `password authentication failed`. 일치시키기:
> ```bash
> sudo -u postgres psql -p 5433 -c "ALTER USER hansolax WITH PASSWORD '<server/.env와 동일한 값>';"
> sudo docker compose -f docker-compose.prod.yml restart api
> ```
> 운영에서 컨테이너가 호스트 DB에 붙으려면 `docker-compose.prod.yml`의 `extra_hosts`(host.docker.internal)와 5433의 docker 브리지 수신 허용이 필요 — 루트 README 참고.

## 의존성 설치 (새 환경에서)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 구조

```
server/
├── app/
│   ├── main.py          # FastAPI 엔트리, CORS, DB 풀 lifespan
│   ├── config.py        # 환경변수 로딩 (DATABASE_URL 등, pydantic-settings)
│   ├── db.py            # asyncpg 커넥션 풀 (생성/해제)
│   └── routers/         # API 라우터 (기능별로 추가)
│       ├── health.py    # GET /api/health
│       └── database.py  # GET /api/db-health, GET /api/users
├── requirements.txt
├── .env.example         # DATABASE_URL 등 (복사해서 .env 로 사용)
└── .env                 # 실제 값 (git 미추적)
```

LangGraph 등 추가 시 `pip install langgraph` 후 `pip freeze > requirements.txt` 로 갱신하세요.
