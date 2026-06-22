"""AI 챗봇 서비스 래퍼.

LangGraph 챗봇(app.chatbot.graph)을 PostgresSaver checkpointer 와 함께 싱글톤으로 띄우고,
라우터가 쓰기 좋은 형태(인터럽트 payload / 최종답변+출처)로 정규화해 돌려준다.

- 대화 상태는 PostgreSQL 에 영속화(thread_id 별). 컨테이너 재기동돼도 이어짐.
- 그래프/체인/검색/LLM 호출 모두 동기(psycopg + requests + ChatOllama)라
  라우터는 동기 def 핸들러로 두어 Starlette 가 threadpool 에서 돌리게 한다.
"""

from __future__ import annotations

import uuid
from typing import Any

from langgraph.types import Command

from app.chatbot.config import Settings
from app.chatbot.graph import SalesLangGraphChatbot
from app.chatbot.state import initial_state

_bot: SalesLangGraphChatbot | None = None

_SOURCE_LABEL = {
    "working_news_articles": "뉴스",
    "sales_memo": "세일즈 메모",
    "raw_consumer_trend": "소비자 반응(VOC)",
}


def _get_bot() -> SalesLangGraphChatbot:
    """그래프+PostgresSaver 싱글톤(최초 호출 시 1회 생성, 테이블 셋업)."""
    global _bot
    if _bot is None:
        settings = Settings.from_env()
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool
        from langgraph.checkpoint.postgres import PostgresSaver

        pool = ConnectionPool(
            conninfo=settings.database_url,
            max_size=4,
            kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": 0},
        )
        saver = PostgresSaver(pool)
        saver.setup()  # checkpoint 테이블 생성(멱등)
        _bot = SalesLangGraphChatbot(settings=settings, checkpointer=saver)
    return _bot


def _interrupt_payload(result: dict[str, Any]) -> dict[str, Any] | None:
    interrupts = result.get("__interrupt__")
    if not interrupts:
        return None
    item = interrupts[0]
    value = getattr(item, "value", item)
    return value if isinstance(value, dict) else {"message": str(value)}


def _sources(result: dict[str, Any]) -> list[dict[str, Any]]:
    docs = (result.get("structured_results") or {}).get("retrieved_documents", []) or []
    out = []
    for d in docs:
        text = (d.get("document_text") or "").replace("\n", " ").strip()
        out.append(
            {
                "source": d.get("source"),
                "source_label": _SOURCE_LABEL.get(d.get("source"), d.get("source")),
                "source_id": d.get("source_id"),
                "snippet": text[:200],
                "similarity": round(float(d.get("similarity") or 0), 3),
            }
        )
    return out


def get_history(thread_id: str) -> dict[str, Any]:
    """thread 의 누적 대화(messages)를 화면 복원용으로 반환. 없으면 빈 목록."""
    from langchain_core.messages import AIMessage, HumanMessage

    bot = _get_bot()
    snapshot = bot.app.get_state({"configurable": {"thread_id": thread_id}})
    messages = (snapshot.values or {}).get("messages", []) if snapshot else []
    out = []
    for m in messages:
        if isinstance(m, HumanMessage):
            role = "user"
        elif isinstance(m, AIMessage):
            role = "ai"
        else:
            continue
        text = (m.content or "").strip() if isinstance(m.content, str) else str(m.content)
        if text:
            out.append({"role": role, "text": text})
    return {"thread_id": thread_id, "messages": out}


def run_chat(
    question: str | None = None,
    thread_id: str | None = None,
    resume: str | None = None,
) -> dict[str, Any]:
    """질문(신규) 또는 카테고리 선택(resume)을 받아 그래프를 한 스텝 진행.

    반환:
      - 카테고리 선택 필요: {status:'interrupted', thread_id, message, options, field}
      - 완료:             {status:'done', thread_id, answer, sources, selected_product_category}
    """
    bot = _get_bot()
    tid = thread_id or f"chat-{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": tid}}

    if resume is not None:
        result = bot.invoke(Command(resume=resume), config=config)
    else:
        result = bot.invoke(initial_state(question or ""), config=config)

    payload = _interrupt_payload(result)
    if payload:
        return {
            "status": "interrupted",
            "thread_id": tid,
            "message": payload.get("message", "추가 입력이 필요합니다."),
            "options": payload.get("options", []),
            "field": payload.get("field"),
        }
    return {
        "status": "done",
        "thread_id": tid,
        "answer": result.get("final_answer") or "",
        "sources": _sources(result),
        "selected_product_category": result.get("selected_product_category"),
    }
