"""세일즈 메모 1건의 3줄 AI 요약 (로컬 LLM).

라우터(온디맨드)와 백그라운드 백필(summary_backfill)이 공용으로 쓴다.
요약 결과는 sales_memo.ai_summary 에 줄바꿈으로 join 해 저장한다.
"""

import re

from app import llm

_PROMPT_FIELDS = [
    ("거래선", "customer_name"),
    ("활동계획", "activity_plan"),
    ("전략", "strategy"),
    ("운영", "operation"),
    ("제품", "product"),
    ("개인", "personal"),
    ("시사점", "takeaway"),
    ("F/UP", "followup_plan"),
]


def build_prompt(memo: dict) -> str:
    body = "\n".join(
        f"{label}: {memo[key].strip()}"
        for label, key in _PROMPT_FIELDS
        if memo.get(key) and str(memo[key]).strip()
    )
    return (
        "다음은 한솔홈데코 영업 메모입니다. 핵심만 정확히 3줄로 요약하세요.\n"
        "- 각 줄은 한 문장이며 '- ' 로 시작합니다.\n"
        "- 거래선·제품·핵심 활동/이슈/다음 단계 위주로 적습니다.\n"
        "- 메모에 없는 내용은 지어내지 말고, 머리말 없이 정확히 3줄만 출력하세요.\n\n"
        f"[메모]\n{body}\n\n[3줄 요약]\n"
    )


def parse_bullets(text: str) -> list[str]:
    out: list[str] = []
    for raw in text.splitlines():
        s = re.sub(r"^\s*(?:[-•*]|\d+[.)])\s*", "", raw.strip())
        if s:
            out.append(s)
    return out[:3]


async def summarize(memo: dict) -> list[str]:
    """LLM 으로 3줄 요약을 생성. 실패 시 llm.LLMError 전파."""
    text = await llm.generate(build_prompt(memo), num_predict=220, temperature=0.3)
    return parse_bullets(text)


def join_summary(bullets: list[str]) -> str:
    return "\n".join(bullets)


def split_summary(text: str | None) -> list[str]:
    if not text:
        return []
    return [line for line in text.split("\n") if line.strip()]
