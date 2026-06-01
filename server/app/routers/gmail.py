"""Gmail 메일 읽기 라우터.

고정 계정(settings.gmail_mailbox)의 메일을 OAuth2 refresh token 으로 읽는다.
로그인한 앱 사용자(Bearer)만 접근 가능.

  GET /api/gmail/messages          : 메일 id 목록 (users.messages.list)
  GET /api/gmail/messages/{id}     : 메일 1건 상세 (users.messages.get)
  GET /api/gmail/inbox             : 최근 메일을 제목/보낸이/날짜로 정리해 반환(목록+메타 조회)
"""

import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app import gmail_client
from app.config import settings
from app.gmail_client import GmailNotConfigured
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/gmail", tags=["gmail"])


def _handle_gmail_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, GmailNotConfigured):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, httpx.HTTPStatusError):
        return HTTPException(
            status_code=502,
            detail=f"Gmail API 오류({exc.response.status_code}): {exc.response.text[:300]}",
        )
    return HTTPException(status_code=502, detail=f"Gmail 호출 실패: {exc}")


def _header(msg: dict, name: str) -> str:
    """메일 헤더에서 특정 값 추출(대소문자 무시)."""
    for h in msg.get("payload", {}).get("headers", []):
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


@router.get("/messages")
async def messages(
    max_results: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, description='Gmail 검색 문법 (예: "is:unread")'),
    _user: dict = Depends(get_current_user),
):
    try:
        items = await gmail_client.list_messages(max_results=max_results, query=q)
    except Exception as exc:
        raise _handle_gmail_errors(exc) from exc
    return {"mailbox": settings.gmail_mailbox, "count": len(items), "messages": items}


@router.get("/inbox")
async def inbox(
    max_results: int = Query(10, ge=1, le=50),
    q: str | None = Query(None, description='Gmail 검색 문법 (예: "is:unread")'),
    _user: dict = Depends(get_current_user),
):
    """목록 + 각 메일 메타데이터를 합쳐 제목/보낸이/날짜/미리보기로 반환."""
    try:
        items = await gmail_client.list_messages(max_results=max_results, query=q)
        details = await asyncio.gather(
            *(gmail_client.get_message(m["id"], fmt="metadata") for m in items)
        )
    except Exception as exc:
        raise _handle_gmail_errors(exc) from exc

    mails = [
        {
            "id": d.get("id"),
            "threadId": d.get("threadId"),
            "from": _header(d, "From"),
            "subject": _header(d, "Subject"),
            "date": _header(d, "Date"),
            "snippet": d.get("snippet", ""),
            "unread": "UNREAD" in d.get("labelIds", []),
        }
        for d in details
    ]
    return {"mailbox": settings.gmail_mailbox, "count": len(mails), "messages": mails}


@router.get("/messages/{message_id}")
async def message_detail(
    message_id: str,
    fmt: str = Query("full", pattern="^(full|metadata|minimal|raw)$"),
    _user: dict = Depends(get_current_user),
):
    try:
        return await gmail_client.get_message(message_id, fmt=fmt)
    except Exception as exc:
        raise _handle_gmail_errors(exc) from exc
