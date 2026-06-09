import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db, sales_memo_sync, summary_backfill
from app.routers import auth, categories, database, gmail, health, sales_memo


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect_db()
    # [HSP SalesMemo] 메일을 주기적으로 받아 sales_memo 에 적재하는 백그라운드 폴러
    sync_task = asyncio.create_task(sales_memo_sync.run_forever())
    # 적재된 메모의 3줄 AI 요약을 미리 생성해두는 백그라운드 작업
    summary_task = asyncio.create_task(summary_backfill.run_forever())
    try:
        yield
    finally:
        for task in (sync_task, summary_task):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        await db.disconnect_db()


app = FastAPI(title="server", version="0.1.0", lifespan=lifespan)

# 프론트엔드(Vite dev 서버)에서의 요청 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://hansolax.kro.kr",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(database.router)
app.include_router(auth.router)
app.include_router(gmail.router)
app.include_router(sales_memo.router)
app.include_router(categories.router)


@app.get("/")
def root():
    return {"message": "server is running"}
