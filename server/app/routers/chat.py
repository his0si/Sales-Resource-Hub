"""AI 챗봇 라우터.

LangGraph RAG 챗봇(app.chatbot)을 /api/chat 로 노출한다.
- 신규 질문: {question} → 답변 또는 카테고리 선택 인터럽트
- 카테고리 선택: {thread_id, resume} → 멈춘 지점부터 이어서 답변
대화 상태는 PostgresSaver(thread_id 별)로 영속화된다. 로그인 사용자만 접근.

LangGraph/LLM 호출이 동기·블로킹이라 핸들러를 def(동기)로 두어
Starlette 가 threadpool 에서 실행하게 한다(이벤트 루프 비차단).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.chatbot import service
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    question: str | None = None
    thread_id: str | None = None
    resume: str | None = None  # 카테고리 선택값(이어가기)


@router.get("/chat/history")
def chat_history(
    thread_id: str = Query(..., description="복원할 대화 thread_id"),
    _user: dict = Depends(get_current_user),
):
    """새로고침·재진입 시 지난 대화를 화면에 다시 그리기 위한 누적 메시지 조회."""
    try:
        return service.get_history(thread_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"대화 기록 조회 오류: {exc}") from exc


@router.post("/chat")
def chat(req: ChatRequest, _user: dict = Depends(get_current_user)):
    if not req.question and req.resume is None:
        raise HTTPException(status_code=400, detail="question 또는 resume 가 필요합니다.")
    if req.resume is not None and not req.thread_id:
        raise HTTPException(status_code=400, detail="resume 에는 thread_id 가 필요합니다.")
    try:
        return service.run_chat(
            question=req.question, thread_id=req.thread_id, resume=req.resume
        )
    except Exception as exc:  # LLM/DB/임베딩 오류를 사용자 메시지로
        raise HTTPException(status_code=503, detail=f"챗봇 처리 중 오류: {exc}") from exc
