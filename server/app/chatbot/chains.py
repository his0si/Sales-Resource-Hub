from __future__ import annotations

import json
import re

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama

from app.chatbot.config import PRODUCT_CATEGORY_OPTIONS, Settings
from app.chatbot.state import PeriodExtraction, SourceSelection


class SalesChains:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.rewrite_chain = self._build_rewrite_chain()
        self.period_chain = self._build_period_chain()
        self.source_chain = self._build_source_chain()
        self.answer_chain = self._build_answer_chain()
        self.postprocess_chain = self._build_postprocess_chain()

    def _llm(self) -> ChatOllama:
        return ChatOllama(
            model=self.settings.ollama_chat_model,
            base_url=self.settings.ollama_base_url,
            temperature=0,
        )

    def _build_rewrite_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "너는 PostgreSQL pgvector 검색용 키워드 쿼리 작성기다. "
                    "반드시 핵심 검색 키워드만 콤마와 공백으로 구분해 한 줄로 출력한다. "
                    "출력 형식은 반드시 '키워드1, 키워드2, 키워드3' 처럼 키워드와 콤마로만 이루어진 형태다. "
                    "제품명, 데이터 소스, 제품 카테고리, 이슈 유형처럼 검색에 필요한 값만 남긴다. "
                    "제품명:, 제품 유형:, 데이터 소스: 같은 라벨을 절대 쓰지 않는다. "
                    "미정, 없음, 알 수 없음 같은 placeholder를 절대 쓰지 않는다. "
                    "같은 키워드를 반복하지 않는다. "
                    "질문에 영업 메모가 있으면 '세일즈 메모'를 키워드로 포함한다. "
                    "질문에 제품 카테고리가 있으면 카테고리명만 포함한다. "
                    "예시 입력: 세일즈 메모에서 조슈아라이트 인테리어 필름 이슈 찾아줘 "
                    "예시 출력: 세일즈 메모, 조슈아라이트, 인테리어 필름 "
                    "답변이나 설명 없이 검색어 쿼리만 출력한다.",
                ),
                ("human", "원본 질문: {question}"),
            ]
        )
        return prompt | self._llm()

    def _build_period_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "너는 사용자 질문에서 DB 검색 기간 조건만 추출하는 분석기다. "
                    "질문에 명시된 기간 표현이 있으면 일수로 변환하고, 없으면 null을 반환한다. "
                    "기본값을 추측하지 않는다. 기간이 명시되지 않았으면 반드시 period를 null로 둔다. "
                    "오늘/어제는 1, 이번 주/최근/최근 7일은 7, 이번 달은 30, 올해/금년은 365로 본다. "
                    "N일은 N, N주는 N*7, N개월/N달은 N*30, N년은 N*365로 계산한다. "
                    "공백이 있어도 같은 표현으로 본다. 예: '이번 달'과 '이번달'은 모두 30이다. "
                    "반드시 JSON만 출력한다. "
                    "예시1 입력: 세일즈 메모에서 이번 달 포그그레이 이슈 찾아줘. "
                    "예시1 출력: {{\"period\":30,\"reason\":\"이번 달이 명시됨\"}} "
                    "예시2 입력: 최근 3개월 뉴스 찾아줘. "
                    "예시2 출력: {{\"period\":90,\"reason\":\"최근 3개월이 명시됨\"}} "
                    "예시3 입력: 포그그레이 이슈 찾아줘. "
                    "예시3 출력: {{\"period\":null,\"reason\":\"기간 표현 없음\"}}",
                ),
                ("human", "원본 질문: {question}"),
            ]
        )
        return prompt | self._llm()

    def _build_source_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system","""

                    너는 사용자 질문에 필요한 DB source를 선택하는 라우터다.

                    source:

                    * working_news_articles: 뉴스/기사/언론/시장동향/업계동향/경쟁사동향/건설경기/제품이슈
                    * sales_memo: 영업메모/세일즈메모/고객문의/거래처/대리점/상담/미팅/방문기록/영업현장반응
                    * raw_consumer_trend: VOC/소비자반응/외부리뷰/온라인후기/오늘의집/셀인카페/커뮤니티반응

                    규칙:

                    * source는 null에서부터 최대 3개까지 선택 가능
                    * 고객, 거래처, 대리점, 영업, 상담, 미팅, 방문, 문의, 이슈, 리스크가 있으면 sales_memo
                    * 뉴스, 기사, 언론, 시장/업계/경쟁사 동향, 건설경기가 있으면 working_news_articles
                    * raw_consumer_trend는 VOC, 소비자 반응, 외부 리뷰, 온라인 후기, 오늘의집, 셀인카페, 커뮤니티 반응이 직접 언급될 때만 선택
                    * 불만/클레임도 거래처·영업·상담·방문 기록 맥락이면 sales_memo
                    * source가 애매하면 working_news_articles와 sales_memo
                    * DB가 필요 없을 때만 sources=null

                    반드시 JSON만 출력:
                    {{\"sources\":[\"working_news_articles\",\"sales_memo\"],\"reason\":\"선택 근거\"}}
                    """
                    
                ),
                (
                    "human",
                    "원본 질문: {question}\n"
                    "검색용 질문: {rewritten_question}\n"
                    "선택된 제품 카테고리: {selected_product_category}\n"
                    "제품명 포함 여부: {has_product_name}",
                ),
            ]
        )
        return prompt | self._llm()

    def _build_answer_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "당신은 한솔홈데코의 전문 지식 비서 '한솔AI'다. "
                    "제공된 참고 데이터와 이전 대화 기록만 근거로 사용자 질문에 한국어로 답한다. "
                    "근거 문서에 없는 내용은 추측하지 말고 확인이 어렵다고 말한다. "
                    "답변은 실무자가 바로 읽을 수 있게 간결하게 정리한다.",
                ),
                (
                    "human",
                    "[참고 데이터]\n{context}\n\n"
                    "[이전 대화 기록]\n{history}\n\n"
                    "[사용자 질문]\n{question}\n\n"
                    "[검색용 질문]\n{rewritten_question}",
                ),
            ]
        )
        return prompt | self._llm()

    def _build_postprocess_chain(self):
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "너는 답변 후처리 담당자다. 의미를 바꾸지 말고 한국어 표현만 자연스럽게 다듬는다. "
                    "근거 추가, 추측, 새로운 정보 삽입은 하지 않는다.",
                ),
                ("human", "다음 답변을 자연스러운 한국어로 정리해줘:\n\n{answer}"),
            ]
        )
        return prompt | self._llm()

    @staticmethod
    def _json_content(response) -> str:
        content = response.content.strip()
        if content.startswith("```"):
            content = content.strip("`").removeprefix("json").strip()
        # exaone3.5 등은 JSON 뒤에 설명을 덧붙이기도 함 → 첫 번째 균형 잡힌 {...} 객체만 추출
        start = content.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(content)):
                if content[i] == "{":
                    depth += 1
                elif content[i] == "}":
                    depth -= 1
                    if depth == 0:
                        return content[start : i + 1]
        return content

    def extract_period(self, question: str) -> PeriodExtraction:
        response = self.period_chain.invoke({"question": question})
        content = self._json_content(response)
        print("[period_chain.raw]", content)
        return PeriodExtraction.model_validate(json.loads(content))

    async def aextract_period(self, question: str) -> PeriodExtraction:
        response = await self.period_chain.ainvoke({"question": question})
        content = self._json_content(response)
        print("[period_chain.raw]", content)
        return PeriodExtraction.model_validate(json.loads(content))

    def select_sources(self, inputs: dict) -> SourceSelection:
        response = self.source_chain.invoke(inputs)
        content = self._json_content(response)
        return SourceSelection.model_validate(json.loads(content))

    async def aselect_sources(self, inputs: dict) -> SourceSelection:
        response = await self.source_chain.ainvoke(inputs)
        content = self._json_content(response)
        return SourceSelection.model_validate(json.loads(content))

    @staticmethod
    def normalize_rewritten_question(text: str) -> str:
        cleaned = text.strip()
        cleaned = re.sub(r"[\n;|/]+", ",", cleaned)

        parts = []
        for part in cleaned.split(","):
            keyword = part.strip(" .:-")
            keyword = re.sub(r"^(제품명|제품\s*유형|데이터\s*소스|카테고리|이슈\s*유형)\s*[:：]\s*", "", keyword)
            keyword = keyword.strip(" .:-")
            if not keyword:
                continue
            if keyword in {"미정", "없음", "알 수 없음", "unknown", "Unknown", "UNKNOWN", "N/A", "n/a"}:
                continue
            if keyword not in parts:
                parts.append(keyword)

        source_keywords = ["세일즈 메모", "뉴스", "VOC", "소비자 반응", "외부 반응", "외부 리뷰"]
        sources = [part for part in parts if part in source_keywords]
        categories = [part for part in parts if part in PRODUCT_CATEGORY_OPTIONS]
        others = [part for part in parts if part not in sources and part not in categories]

        ordered_parts = sources + others + categories
        return ", ".join(ordered_parts)

    def rewrite_question(self, question: str) -> str:
        response = self.rewrite_chain.invoke({"question": question})
        return self.normalize_rewritten_question(response.content)

    async def arewrite_question(self, question: str) -> str:
        response = await self.rewrite_chain.ainvoke({"question": question})
        return self.normalize_rewritten_question(response.content)

    def generate_answer(self, inputs: dict) -> str:
        response = self.answer_chain.invoke(inputs)
        return response.content.strip()

    async def agenerate_answer(self, inputs: dict) -> str:
        response = await self.answer_chain.ainvoke(inputs)
        return response.content.strip()

    def postprocess_answer(self, answer: str) -> str:
        text = answer.strip()
        if not text:
            return text
        response = self.postprocess_chain.invoke({"answer": text})
        return response.content.strip()

    async def apostprocess_answer(self, answer: str) -> str:
        text = answer.strip()
        if not text:
            return text
        response = await self.postprocess_chain.ainvoke({"answer": text})
        return response.content.strip()
