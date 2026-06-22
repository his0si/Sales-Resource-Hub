from __future__ import annotations

from typing import Annotated, Any, Literal, Optional

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field, model_validator
from typing_extensions import TypedDict

from app.chatbot.config import PRODUCT_CATEGORY_OPTIONS, VALID_SOURCES


SourceName = Literal["working_news_articles", "sales_memo", "raw_consumer_trend"]


class SalesChatbotState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

    question: str
    rewritten_question: Optional[str]
    period: Optional[int]
    period_reason: Optional[str]

    sources: list[SourceName]

    search_queries: dict[str, list[str]]

    news_results: list[dict[str, Any]]
    voc_results: list[dict[str, Any]]
    sales_memo_results: list[dict[str, Any]]

    structured_results: dict[str, Any]

    retry_count: int
    max_retry: int

    product_category_options: list[str]
    needs_product_category_clarification: bool
    selected_product_category: Optional[str]

    draft_answer: Optional[str]
    final_answer: Optional[str]


class SourceSelection(BaseModel):
    sources: Optional[list[SourceName]] = Field(
        default=None,
        description="검색할 DB source 목록. 해당 source가 없으면 null.",
    )
    reason: str = Field(..., description="source 선택 근거")

    @model_validator(mode="after")
    def validate_sources(self) -> "SourceSelection":
        if self.sources is None:
            return self

        deduped = list(dict.fromkeys(self.sources))
        invalid_sources = [source for source in deduped if source not in VALID_SOURCES]
        if invalid_sources:
            raise ValueError(f"invalid sources: {invalid_sources}")
        if not deduped:
            self.sources = None
        else:
            self.sources = deduped
        return self


class PeriodExtraction(BaseModel):
    period: Optional[int] = Field(
        default=None,
        description="질문에 명시된 검색 기간 일수. 기간 표현이 없으면 null.",
    )
    reason: str = Field(..., description="기간 추출 근거")

    @model_validator(mode="after")
    def validate_period(self) -> "PeriodExtraction":
        if self.period is not None and self.period <= 0:
            self.period = None
        return self


def initial_state(question: str, max_retry: int = 2) -> SalesChatbotState:
    return {
        "messages": [],
        "question": question,
        "rewritten_question": None,
        "period": None,
        "period_reason": None,
        "sources": [],
        "search_queries": {"working_news_articles": [], "sales_memo": [], "raw_consumer_trend": []},
        "news_results": [],
        "voc_results": [],
        "sales_memo_results": [],
        "structured_results": {},
        "retry_count": 0,
        "max_retry": max_retry,
        "product_category_options": PRODUCT_CATEGORY_OPTIONS,
        "needs_product_category_clarification": False,
        "selected_product_category": None,
        "draft_answer": None,
        "final_answer": None,
    }
