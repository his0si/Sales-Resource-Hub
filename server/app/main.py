from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.routers import auth, database, gmail, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect_db()
    yield
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


@app.get("/")
def root():
    return {"message": "server is running"}
