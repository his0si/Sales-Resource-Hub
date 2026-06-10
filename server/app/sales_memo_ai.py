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


# ---- 카드 제목 (로컬 LLM) ----

# 제목에서 지워야 할 머리기호·도형·이모지(원문 불릿 '○ ', 모델이 붙인 이모지 등).
# 기하도형(○●◇◆…)·불릿·가운뎃점·화살표·딩벳·각종 이모지 영역을 통째로 제거한다.
_TITLE_SYMBOLS = re.compile(
    "["
    "•·⁃∙"            # 불릿(•)·가운뎃점(·)·하이픈불릿(⁃)·∙
    "■-◿"                       # 기하도형(○ U+25CB, ● U+25CF, ◇ ◆ ■ □ …)
    "←-⇿"                       # 화살표
    "⌀-➿"                       # 기타기호·딩벳(✓ ★ ☆ ➤ ☀ …)
    "⬀-⯿"                       # 추가 기호·화살표
    "️⃣"                        # variation selector·keycap
    "\U0001f000-\U0001faff"              # 이모지(그림문자) 전 영역
    "]+",
    flags=re.UNICODE,
)


def clean_title(text: str | None) -> str:
    """제목 문자열에서 머리기호·도형·이모지를 제거하고 공백/구분기호를 정리한다."""
    if not text:
        return ""
    t = _TITLE_SYMBOLS.sub(" ", text)
    t = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", t.strip())  # 남은 리스트 마커
    t = re.sub(r"\s+", " ", t)                              # 연속 공백 → 한 칸
    t = re.sub(r"\s*,\s*[,\-–—]*\s*", ", ", t)              # 쉼표 주변/중복 구분기호 정리
    return t.strip(" ,·-–—\"'“”‘’")


def build_title_prompt(memo: dict) -> str:
    cust = (memo.get("customer_name") or "").strip()
    body = "\n".join(
        f"{label}: {str(memo[key]).strip()}"
        for label, key in _PROMPT_FIELDS
        if memo.get(key) and str(memo[key]).strip()
    )
    return (
        "너는 한솔홈데코 영업 메모의 제목을 다는 편집자다. 아래 메모의 핵심을 짧은 제목 한 줄로 만들어라.\n"
        "[규칙]\n"
        f'1. 형식: "{cust}, OOO" — 반드시 거래선명 \'{cust}\' 으로 시작하고 쉼표 뒤에 핵심을 쓴다.\n'
        "2. 쉼표 뒤는 12자 내외. 메모에 실제로 나온 제품명·키워드·활동만 쓰고, "
        "메모에 없는 단어·수치·평가는 절대 추가하지 않는다.\n"
        "3. '검토/처리/대응/목표'처럼 메모에 없는 동작 표현을 지어내지 말 것. "
        "가장 비중 큰 사실 하나만 명사구로.\n"
        "4. 따옴표·마침표·머리기호(○ - • 등)·이모지·설명 없이 제목 한 줄만 출력.\n\n"
        f"[메모]\n{body}\n\n[제목]\n"
    )


# 제목에 들어오면 LLM 이 폭주(한자/일본어/라틴 발음기호/메타발화)한 것으로 보고 폐기할 문자.
# 정상 거래선명의 평범한 ASCII(BD60, Dasan&Tech)는 허용하되, 한국 메모에 나올 수 없는
# 한자·가나·라틴 발음기호(é ñ ỉ …)·물음표는 차단한다.
_TITLE_BAD = re.compile(r"[À-ɏḀ-ỿ぀-ヿ㐀-鿿？?。！]")


def _valid_title(title: str) -> bool:
    """모델 폭주(한자·가나·물음표 섞임)나 과도한 길이는 무효로 본다."""
    return bool(title) and len(title) <= 40 and not _TITLE_BAD.search(title)


async def generate_title(memo: dict) -> str:
    """LLM 으로 카드 제목을 생성(기호 제거 + 검증). 실패 시 llm.LLMError 전파.

    거래선으로 시작하지 않으면 거래선명을 앞에 붙여 형식을 보정하고,
    모델이 폭주(한자 섞임 등)하면 '거래선, 활동계획 첫 줄'로 폴백한다.
    """
    cust = (memo.get("customer_name") or "").strip()
    text = await llm.generate(build_title_prompt(memo), num_predict=40, temperature=0.1)
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    title = clean_title(first)
    if cust and not title.startswith(cust):
        title = f"{cust}, {title}".rstrip(" ,") if title else cust

    if _valid_title(title):
        return title
    # 폴백: 거래선 + 활동계획 첫 줄(기호 제거)
    head = clean_title(_first_line(memo.get("activity_plan")))
    if cust and head:
        return f"{cust}, {head}"[:40]
    return (cust or head or "")[:40]


def _first_line(text: str | None) -> str:
    if not text:
        return ""
    for line in text.splitlines():
        line = line.strip()
        if line:
            return line[:46]
    return ""


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


# ---- 카드 해시태그 (로컬 LLM) ----
# 제목이 '누구와 무엇을' 이라면, 해시태그는 요약 속 '무엇이 어떠한지'(이슈/상태)를 담는다.
# 단순 행위어(방문/상담 등)는 후킹이 안 되므로 제외하고, 본문에 실재하는 단어만 통과시킨다.

# 태그에 섞이면 폭주로 보는 문자(한자·가나·물음표·영문)
_TAG_BAD = re.compile(r"[぀-ヿ㐀-鿿？?。！A-Za-z]")
# 단독으로 쓰면 의미 없는 일반 행위어(태그에서 제외)
_TAG_FILLER = {
    "방문", "상담", "미팅", "문의", "설명", "전달", "안내",
    "점검", "청취", "파악", "협의", "소개", "논의", "확인",
}


def _tag_body(memo: dict) -> str:
    return "\n".join(
        f"{label}: {str(memo[key]).strip()}"
        for label, key in _PROMPT_FIELDS
        if memo.get(key) and str(memo[key]).strip()
    )


def _grounded(tag: str, hay: str) -> bool:
    """태그의 두 글자 토막 중 하나라도 본문(공백 제거)에 있으면 사실 근거가 있다고 본다."""
    core = re.sub(r"[^가-힣0-9]", "", tag)
    return any(core[i:i + 2] in hay for i in range(len(core) - 1))


def parse_tags(text: str, title: str, body: str, limit: int = 4) -> list[str]:
    """LLM 출력 → 검증된 태그 리스트. 한국어 복합명사 3~6자, 필러·제목중복·환각 제거."""
    hay = re.sub(r"\s", "", body)
    title_compact = re.sub(r"[\s,]", "", title or "")
    first = next((ln for ln in text.splitlines() if ln.strip()), "")
    out: list[str] = []
    for raw in re.split(r"[,，、]+", first):
        t = re.sub(r"[#\s]", "", raw).strip()
        if not t or _TAG_BAD.search(t) or not (3 <= len(t) <= 6):
            continue
        if t in _TAG_FILLER or (title_compact and t in title_compact):
            continue
        if not _grounded(t, hay):
            continue
        if t not in out:
            out.append(t)
    return out[:limit]


def build_tags_prompt(title: str, core: str) -> str:
    return (
        "너는 한솔홈데코 영업 메모에 다는 해시태그를 만든다. "
        "메모 요약의 '핵심 이슈/상태'를 드러내는 짧은 태그를 뽑아라.\n"
        "[규칙]\n"
        "1. 한국어만(한자·영어 금지). 2~4개. 각 태그는 공백 없는 자연스러운 복합명사 3~6자.\n"
        "2. '무엇이 어떠한지'를 담는다. 예: 마감불만, 단가조정, 재고부담, 공급불가, "
        "실적달성, 품질이슈, 납기지연, 경쟁사진입, 판매부진, 신규개척.\n"
        "3. '방문/상담/미팅/문의/설명/전달/파악/논의' 같은 단순 행위어 단독 금지.\n"
        "4. 요약에 실제로 있는 사실만. 없는 단어 지어내기 금지. 제목에 나온 단어는 피한다.\n"
        "5. 거래선명·사람이름 금지. 출력은 '#' 없이 쉼표로 구분된 태그만.\n\n"
        f"[제목] {title}\n[요약/핵심]\n{core}\n\n[해시태그]\n"
    )


async def generate_tags(memo: dict, title: str = "", summary: str | None = None) -> list[str]:
    """LLM 으로 해시태그를 생성(검증·grounding 포함). 실패 시 llm.LLMError 전파.

    제목과 본문(grounding 기준)을 함께 넘겨, 제목과 겹치지 않고 본문에 실재하는
    이슈/상태 태그만 남긴다. 유효 태그가 0개면 빈 리스트(호출부가 규칙기반으로 폴백).
    """
    body = _tag_body(memo)
    core = summary or memo.get("ai_summary") or body
    text = await llm.generate(build_tags_prompt(title, core), num_predict=40, temperature=0.2)
    return parse_tags(text, title, body)


def join_tags(tags: list[str]) -> str:
    return ",".join(tags)


def split_tags(text: str | None) -> list[str]:
    if not text:
        return []
    return [t.strip() for t in text.split(",") if t.strip()]
