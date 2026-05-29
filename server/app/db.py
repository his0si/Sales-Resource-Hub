"""호스트 네이티브 PostgreSQL(hansolax 클러스터, 5433) 연결 풀.

DATABASE_URL 예: postgresql://hansolax:<password>@host.docker.internal:5433/hansolax
컨테이너→호스트 접근은 docker-compose의 extra_hosts(host.docker.internal)로 매핑된다.
"""

import asyncpg

from app.config import settings

pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    """앱 기동 시 풀 생성. DB가 아직 접속 불가여도 앱은 죽지 않고 경고만 남긴다."""
    global pool
    if not settings.database_url:
        print("[db] DATABASE_URL 미설정 — DB 연결 건너뜀")
        return
    try:
        pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=10,
        )
        print("[db] PostgreSQL 연결 풀 생성 완료")
    except Exception as exc:  # 연결 실패해도 기동은 계속 (헬스체크로 확인)
        pool = None
        print(f"[db] 연결 실패(앱은 계속 기동): {exc!r}")


async def disconnect_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("DB 풀이 초기화되지 않았습니다 (DATABASE_URL 미설정 또는 연결 실패)")
    return pool
