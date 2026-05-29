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
│   ├── main.py          # FastAPI 엔트리, CORS 설정
│   └── routers/         # API 라우터 (기능별로 추가)
│       └── health.py
├── requirements.txt
└── .env.example
```

LangGraph 등 추가 시 `pip install langgraph` 후 `pip freeze > requirements.txt` 로 갱신하세요.
