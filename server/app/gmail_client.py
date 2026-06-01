"""Gmail API 로 메일 읽기 (OAuth2 refresh token 방식).

흐름:
  1) 최초 1회: scripts/gmail_authorize.py 로 동의 화면을 거쳐 refresh token 을 발급받아
     .env(GMAIL_REFRESH_TOKEN)에 저장한다.
  2) 런타임: refresh token 으로 access token 을 자동 발급(1시간 캐싱)하고
     Gmail REST API(users.messages.list -> get)를 호출한다.

google 라이브러리 없이 이미 의존성에 있는 httpx 로 직접 호출한다.
"""

import time

import httpx

from app.config import settings

TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

# 읽기 전용 스코프. 인증 스크립트와 동일해야 한다.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# 발급받은 access token 메모리 캐시 (token, 만료 epoch초)
_cached_token: str | None = None
_cached_exp: float = 0.0


class GmailNotConfigured(RuntimeError):
    """client_id/secret/refresh_token 중 하나라도 비어 있을 때."""


def _require_config() -> None:
    missing = [
        name
        for name, val in (
            ("GMAIL_CLIENT_ID", settings.gmail_client_id),
            ("GMAIL_CLIENT_SECRET", settings.gmail_client_secret),
            ("GMAIL_REFRESH_TOKEN", settings.gmail_refresh_token),
        )
        if not val
    ]
    if missing:
        raise GmailNotConfigured(
            "Gmail API 설정이 비어 있습니다: "
            + ", ".join(missing)
            + " (scripts/gmail_authorize.py 로 발급 후 .env 에 넣으세요)"
        )


async def _get_access_token() -> str:
    """refresh token 으로 access token 을 발급. 만료 1분 전까지 캐시 재사용."""
    global _cached_token, _cached_exp
    _require_config()

    if _cached_token and time.time() < _cached_exp - 60:
        return _cached_token

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "refresh_token": settings.gmail_refresh_token,
                "grant_type": "refresh_token",
            },
        )
    resp.raise_for_status()
    data = resp.json()
    _cached_token = data["access_token"]
    _cached_exp = time.time() + data.get("expires_in", 3600)
    return _cached_token


async def _api_get(path: str, params: dict | None = None) -> dict:
    token = await _get_access_token()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{GMAIL_API}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
    resp.raise_for_status()
    return resp.json()


async def list_messages(max_results: int = 20, query: str | None = None) -> list[dict]:
    """메일 목록(id 목록). users.messages.list.

    query 는 Gmail 검색 문법 그대로 사용 (예: "is:unread", "from:foo@bar.com").
    """
    params: dict = {"maxResults": max_results}
    if query:
        params["q"] = query
    data = await _api_get("/messages", params)
    return data.get("messages", [])


async def get_message(message_id: str, fmt: str = "full") -> dict:
    """메일 1건 상세. users.messages.get.

    fmt: "full"(본문 포함) | "metadata"(헤더만) | "minimal" | "raw"
    """
    return await _api_get(f"/messages/{message_id}", {"format": fmt})
