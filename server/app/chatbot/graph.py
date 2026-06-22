from __future__ import annotations

import asyncio
import re
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableLambda
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.chatbot.chains import SalesChains
from app.chatbot.config import (
    NEWS_SOURCE,
    PRODUCT_CATEGORY_OPTIONS,
    PRODUCT_NAMES,
    SALES_MEMO_SOURCE,
    VOC_SOURCE,
    Settings,
    normalize_text,
)
from app.chatbot.retrieval import DocumentRetriever, OllamaEmbedder
from app.chatbot.state import SalesChatbotState


class SalesGraphNodes:
    def __init__(self, chains: SalesChains, retriever: DocumentRetriever) -> None:
        self.chains = chains
        self.retriever = retriever

    def rewrite_question(self, state: SalesChatbotState) -> dict[str, Any]:
        question = state["question"].strip()
        return {
            "messages": [HumanMessage(content=question)],
            "rewritten_question": self.chains.rewrite_question(question),
        }

    async def arewrite_question(self, state: SalesChatbotState) -> dict[str, Any]:
        question = state["question"].strip()
        return {
            "messages": [HumanMessage(content=question)],
            "rewritten_question": await self.chains.arewrite_question(question),
        }

    def extract_period(self, state: SalesChatbotState) -> dict[str, Any]:
        result = self.chains.extract_period(state["question"].strip())
        print(
            "[extract_period]",
            f"question={state['question']!r}",
            f"period={result.period!r}",
            f"reason={result.reason!r}",
        )
        return {
            "period": result.period,
            "period_reason": result.reason,
        }

    async def aextract_period(self, state: SalesChatbotState) -> dict[str, Any]:
        result = await self.chains.aextract_period(state["question"].strip())
        print(
            "[extract_period]",
            f"question={state['question']!r}",
            f"period={result.period!r}",
            f"reason={result.reason!r}",
        )
        return {
            "period": result.period,
            "period_reason": result.reason,
        }

    def has_product_name(self, text: str) -> bool:
        text_norm = normalize_text(text)
        return any(normalize_text(product_name) in text_norm for product_name in PRODUCT_NAMES)

    def looks_like_product_question(self, text: str) -> bool:
        text_norm = normalize_text(text)
        if "제품" in text or "상품" in text:
            return True
        return any(normalize_text(product_name) in text_norm for product_name in PRODUCT_NAMES)

    def append_keyword_query(self, base_query: str, keyword: str) -> str:
        parts = [part.strip(" .") for part in base_query.split(",") if part.strip(" .")]
        if keyword not in parts:
            parts.append(keyword)
        return ", ".join(parts)

    @staticmethod
    def explicit_sources_from_text(text: str) -> list[str]:
        text_norm = normalize_text(text)
        sources = []
        external_context = any(keyword in text_norm for keyword in ["voc", "소비자반응", "외부반응", "외부리뷰"])
        sales_context = any(
            keyword in text_norm
            for keyword in [
                "세일즈메모",
                "영업메모",
                "미팅메모",
                "방문기록",
                "상담기록",
                "거래처",
                "영업사원",
                "현장",
                "상담",
            ]
        )
        if not external_context and "고객" in text_norm:
            sales_context = True

        if any(keyword in text_norm for keyword in ["뉴스", "기사", "언론"]):
            sources.append(NEWS_SOURCE)
        if sales_context:
            sources.append(SALES_MEMO_SOURCE)
        if external_context:
            sources.append(VOC_SOURCE)
        elif not sales_context and any(keyword in text_norm for keyword in ["불만", "클레임"]):
            sources.append(VOC_SOURCE)
        elif "오늘의집" in text_norm and any(keyword in text_norm for keyword in ["반응", "리뷰", "후기", "문의"]):
            sources.append(VOC_SOURCE)
        elif "셀인카페" in text_norm and any(keyword in text_norm for keyword in ["반응", "리뷰", "후기", "문의"]):
            sources.append(VOC_SOURCE)

        return list(dict.fromkeys(sources))

    def ask_or_apply_product_category(self, state: SalesChatbotState) -> dict[str, Any]:
        target_question = state.get("rewritten_question") or state["question"]
        if self.looks_like_product_question(target_question):
            selected_category = next(
                (category for category in PRODUCT_CATEGORY_OPTIONS if category in target_question),
                None,
            )
            if selected_category is None:
                selected_category = interrupt(
                    {
                        "type": "product_category_clarification",
                        "field": "product_category",
                        "message": "어떤 제품 카테고리를 기준으로 검색할까요?",
                        "options": PRODUCT_CATEGORY_OPTIONS,
                    }
                )
                if isinstance(selected_category, dict):
                    selected_category = selected_category.get("value") or selected_category.get("product_category")
            selected_category = str(selected_category).strip()
            base_question = state.get("rewritten_question") or state["question"]
            return {
                "rewritten_question": self.append_keyword_query(base_question, selected_category),
                "selected_product_category": selected_category,
                "needs_product_category_clarification": False,
                "structured_results": {
                    **state["structured_results"],
                    "product_category": selected_category,
                },
            }

        return {"needs_product_category_clarification": False}

    def select_sources(self, state: SalesChatbotState) -> dict[str, Any]:
        source_hint_text = "\n".join(
            [message.content for message in state.get("messages", []) if isinstance(message, HumanMessage)]
        )
        explicit_sources = self.explicit_sources_from_text(source_hint_text or state["question"])
        if explicit_sources:
            return {
                "sources": explicit_sources,
                "structured_results": {
                    **state["structured_results"],
                    "source_selection": {
                        "sources": explicit_sources,
                        "reason": "질문에 DB source가 명시되어 있어 규칙 기반으로 선택했습니다.",
                    },
                },
            }

        result = self.chains.select_sources(
            {
                "question": state["question"],
                "rewritten_question": state.get("rewritten_question") or state["question"],
                "selected_product_category": state.get("selected_product_category"),
                "has_product_name": self.has_product_name(state.get("rewritten_question") or state["question"]),
            }
        )

        sources = result.sources or []
        return {
            "sources": sources,
            "structured_results": {
                **state["structured_results"],
                "source_selection": {
                    "sources": sources if sources else None,
                    "reason": result.reason,
                },
            },
        }

    async def aselect_sources(self, state: SalesChatbotState) -> dict[str, Any]:
        source_hint_text = "\n".join(
            [message.content for message in state.get("messages", []) if isinstance(message, HumanMessage)]
        )
        explicit_sources = self.explicit_sources_from_text(source_hint_text or state["question"])
        if explicit_sources:
            return {
                "sources": explicit_sources,
                "structured_results": {
                    **state["structured_results"],
                    "source_selection": {
                        "sources": explicit_sources,
                        "reason": "질문에 DB source가 명시되어 있어 규칙 기반으로 선택했습니다.",
                    },
                },
            }

        result = await self.chains.aselect_sources(
            {
                "question": state["question"],
                "rewritten_question": state.get("rewritten_question") or state["question"],
                "selected_product_category": state.get("selected_product_category"),
                "has_product_name": self.has_product_name(state.get("rewritten_question") or state["question"]),
            }
        )

        sources = result.sources or []
        return {
            "sources": sources,
            "structured_results": {
                **state["structured_results"],
                "source_selection": {
                    "sources": sources if sources else None,
                    "reason": result.reason,
                },
            },
        }

    def retrieve_documents(self, state: SalesChatbotState) -> dict[str, Any]:
        sources = state.get("sources", [])
        if not sources:
            return {}

        query = state.get("rewritten_question") or state["question"]
        results = self.retriever.search(
            query=query,
            sources=sources,
            period_days=state.get("period"),
        )

        return {
            "search_queries": {
                **state["search_queries"],
                **{source: [query] for source in sources},
            },
            "news_results": [row for row in results if row["source"] == NEWS_SOURCE],
            "voc_results": [row for row in results if row["source"] == VOC_SOURCE],
            "sales_memo_results": [row for row in results if row["source"] == SALES_MEMO_SOURCE],
            "structured_results": {
                **state["structured_results"],
                "retrieved_documents": results,
                "period": state.get("period"),
                "period_reason": state.get("period_reason"),
            },
        }

    async def aretrieve_documents(self, state: SalesChatbotState) -> dict[str, Any]:
        return await asyncio.to_thread(self.retrieve_documents, state)

    @staticmethod
    def format_documents(documents: list[dict[str, Any]]) -> str:
        if not documents:
            return "검색된 참고 데이터가 없습니다."

        formatted = []
        for idx, doc in enumerate(documents, start=1):
            formatted.append(
                "\n".join(
                    [
                        f"[{idx}] source={doc['source']}, source_id={doc['source_id']}, chunk={doc['chunk_index']}",
                        doc["document_text"],
                    ]
                )
            )
        return "\n\n".join(formatted)

    @staticmethod
    def format_history(state: SalesChatbotState) -> str:
        history = []
        for message in state.get("messages", [])[-6:]:
            role = "사용자" if isinstance(message, HumanMessage) else "AI"
            history.append(f"{role}: {message.content}")
        return "\n".join(history) if history else "이전 대화 없음"

    def generate_answer(self, state: SalesChatbotState) -> dict[str, Any]:
        documents = state["structured_results"].get("retrieved_documents", [])
        draft_answer = self.chains.generate_answer(
            {
                "context": self.format_documents(documents),
                "history": self.format_history(state),
                "question": state["question"],
                "rewritten_question": state.get("rewritten_question") or state["question"],
            }
        )
        return {"draft_answer": draft_answer}

    async def agenerate_answer(self, state: SalesChatbotState) -> dict[str, Any]:
        documents = state["structured_results"].get("retrieved_documents", [])
        draft_answer = await self.chains.agenerate_answer(
            {
                "context": self.format_documents(documents),
                "history": self.format_history(state),
                "question": state["question"],
                "rewritten_question": state.get("rewritten_question") or state["question"],
            }
        )
        return {"draft_answer": draft_answer}

    @staticmethod
    def is_korean_answer(text: str) -> bool:
        korean_count = len(re.findall(r"[가-힣]", text))
        cjk_count = len(re.findall(r"[\u4e00-\u9fff]", text))
        alpha_count = len(re.findall(r"[A-Za-z]", text))

        if cjk_count > 0:
            return False
        return korean_count >= 10 or korean_count >= alpha_count

    def finalize_answer(self, state: SalesChatbotState) -> dict[str, Any]:
        final_answer = state.get("draft_answer") or ""
        return {
            "messages": [AIMessage(content=final_answer)],
            "final_answer": final_answer,
        }

    def postprocess_answer(self, state: SalesChatbotState) -> dict[str, Any]:
        final_answer = self.chains.postprocess_answer(state.get("draft_answer") or "")
        return {
            "messages": [AIMessage(content=final_answer)],
            "final_answer": final_answer,
        }

    async def apostprocess_answer(self, state: SalesChatbotState) -> dict[str, Any]:
        final_answer = await self.chains.apostprocess_answer(state.get("draft_answer") or "")
        return {
            "messages": [AIMessage(content=final_answer)],
            "final_answer": final_answer,
        }


class SalesLangGraphChatbot:
    def __init__(self, settings: Settings | None = None, checkpointer: Any = None) -> None:
        self.settings = settings or Settings.from_env()
        self._checkpointer = checkpointer or MemorySaver()
        self.chains = SalesChains(self.settings)
        self.embedder = OllamaEmbedder(self.settings)
        self.retriever = DocumentRetriever(self.settings, self.embedder)
        self.nodes = SalesGraphNodes(self.chains, self.retriever)
        self.app = self._build_graph()

    @staticmethod
    def route_after_product_category(state: SalesChatbotState) -> str:
        return "select_sources"

    @staticmethod
    def route_after_source_selection(state: SalesChatbotState) -> str:
        if not state.get("sources"):
            return "generate_answer"
        return "retrieve_documents"

    @staticmethod
    def route_after_generate_answer(state: SalesChatbotState) -> str:
        if SalesGraphNodes.is_korean_answer(state.get("draft_answer") or ""):
            return "finalize_answer"
        return "postprocess_answer"

    def _build_graph(self):
        graph = StateGraph(SalesChatbotState)

        graph.add_node(
            "rewrite_question",
            RunnableLambda(self.nodes.rewrite_question, afunc=self.nodes.arewrite_question),
        )
        graph.add_node(
            "extract_period",
            RunnableLambda(self.nodes.extract_period, afunc=self.nodes.aextract_period),
        )
        graph.add_node("ask_or_apply_product_category", self.nodes.ask_or_apply_product_category)
        graph.add_node(
            "select_sources",
            RunnableLambda(self.nodes.select_sources, afunc=self.nodes.aselect_sources),
        )
        graph.add_node(
            "retrieve_documents",
            RunnableLambda(self.nodes.retrieve_documents, afunc=self.nodes.aretrieve_documents),
        )
        graph.add_node(
            "generate_answer",
            RunnableLambda(self.nodes.generate_answer, afunc=self.nodes.agenerate_answer),
        )
        graph.add_node("finalize_answer", self.nodes.finalize_answer)
        graph.add_node(
            "postprocess_answer",
            RunnableLambda(self.nodes.postprocess_answer, afunc=self.nodes.apostprocess_answer),
        )

        graph.add_edge(START, "rewrite_question")
        graph.add_edge(START, "extract_period")
        graph.add_edge(["rewrite_question", "extract_period"], "ask_or_apply_product_category")
        graph.add_conditional_edges(
            "ask_or_apply_product_category",
            self.route_after_product_category,
            {
                "select_sources": "select_sources",
            },
        )
        graph.add_conditional_edges(
            "select_sources",
            self.route_after_source_selection,
            {
                "retrieve_documents": "retrieve_documents",
                "generate_answer": "generate_answer",
            },
        )
        graph.add_edge("retrieve_documents", "generate_answer")
        graph.add_conditional_edges(
            "generate_answer",
            self.route_after_generate_answer,
            {
                "finalize_answer": "finalize_answer",
                "postprocess_answer": "postprocess_answer",
            },
        )
        graph.add_edge("finalize_answer", END)
        graph.add_edge("postprocess_answer", END)

        return graph.compile(checkpointer=self._checkpointer)

    def invoke(self, state: Any, config: dict[str, Any] | None = None) -> SalesChatbotState:
        return self.app.invoke(state, config=config)

    async def ainvoke(self, state: Any, config: dict[str, Any] | None = None) -> SalesChatbotState:
        return await self.app.ainvoke(state, config=config)

    def stream(self, state: Any, config: dict[str, Any] | None = None):
        return self.app.stream(state, config=config)

    async def astream(self, state: Any, config: dict[str, Any] | None = None):
        async for event in self.app.astream(state, config=config):
            yield event
