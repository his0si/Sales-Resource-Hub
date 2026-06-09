"""제품 카테고리(categories.json) 로더 + 영업일지 텍스트 분류/태그 추출.

categories.json 은 한솔홈데코 제품 트리(카테고리/서브카테고리/변형)다.
세일즈 메모 화면의 '부서' 필터는 이 카테고리들로 구성되고,
각 메모는 본문 텍스트를 카테고리 키워드와 매칭해 부서(카테고리)로 분류한다.
"""

import json
import re
from pathlib import Path

_DATA = Path(__file__).parent / "data" / "categories.json"

with _DATA.open(encoding="utf-8") as f:
    _RAW: list[dict] = json.load(f)

# 등장 순서를 보존한 카테고리 목록
CATEGORIES: list[str] = []
for _row in _RAW:
    c = _row["category"]
    if c not in CATEGORIES:
        CATEGORIES.append(c)

# 카테고리 -> 서브카테고리 목록 (트리, 프론트 드롭다운/제품필터에 사용)
TREE: dict[str, list[str]] = {c: [] for c in CATEGORIES}
for _row in _RAW:
    sub = _row.get("subcategory", "").strip()
    if sub and sub not in TREE[_row["category"]]:
        TREE[_row["category"]].append(sub)

# 분류용 키워드: 카테고리명 + 서브카테고리명 + 도메인 동의어.
# (숫자/한 글자 변형은 오탐이 많아 제외)
_SYNONYMS: dict[str, list[str]] = {
    "바닥재": ["바닥재", "마루", "바닥", "데코타일", "강화마루", "스킨플로어", "층간차음", "차음재", "온돌"],
    "가구재": ["가구재", "스토리보드", "가구", "방염보드", "보드"],
    "벽장재": ["벽장재", "스토리월", "콜렉트월", "커버베이직", "벽장", "벽재"],
    "인테리어 필름": ["인테리어 필름", "스토리필름", "필름", "방염필름"],
    "세라믹": ["세라믹", "콜렉트스톤", "포세린", "타일"],
}

# categories.json 의 서브카테고리명도 키워드에 추가
for _cat, _subs in TREE.items():
    for _s in _subs:
        if _s not in _SYNONYMS[_cat]:
            _SYNONYMS[_cat].append(_s)

# 태그 추출용 — 지역 / 주제 키워드 (디자인의 #대구 #견적 같은 칩 재현)
_REGIONS = [
    "서울", "경기", "인천", "수원", "성남", "용인", "부천", "안양", "고양", "화성",
    "대구", "부산", "광주", "대전", "울산", "세종", "청주", "천안", "전주", "포항",
    "창원", "김해", "제주", "강릉", "원주", "구미", "양산", "평택", "안산",
]
_TOPICS = [
    "견적", "샘플", "시공", "경쟁사", "동향", "단가", "납기", "마감", "실적",
    "신제품", "출시", "상담", "방문", "협조", "미팅", "계약", "발주", "클레임",
    "품질", "인증", "친환경", "리모델링", "특판", "프로젝트", "VOC", "전시",
]


def category_tree() -> dict:
    """프론트 드롭다운/제품 필터용 카테고리 트리."""
    return {"categories": CATEGORIES, "tree": TREE}


def _text_of(memo: dict) -> str:
    parts = [
        memo.get("customer_name"),
        memo.get("activity_plan"),
        memo.get("product"),
        memo.get("strategy"),
        memo.get("operation"),
        memo.get("takeaway"),
        memo.get("personal"),
        memo.get("followup_plan"),
    ]
    return " ".join(p for p in parts if p)


def classify(memo: dict) -> str | None:
    """메모 본문을 훑어 가장 많이 매칭되는 카테고리를 반환(없으면 None)."""
    text = _text_of(memo)
    if not text:
        return None
    best, best_score = None, 0
    for cat in CATEGORIES:
        score = sum(text.count(kw) for kw in _SYNONYMS[cat])
        if score > best_score:
            best, best_score = cat, score
    return best


def extract_tags(memo: dict, category: str | None, limit: int = 3) -> list[str]:
    """지역·주제·서브카테고리 키워드를 추출해 해시태그 후보로 반환."""
    text = _text_of(memo)
    tags: list[str] = []

    def add(t: str) -> None:
        if t and t not in tags:
            tags.append(t)

    # 서브카테고리(제품군) 우선
    if category:
        for sub in TREE.get(category, []):
            if sub in text:
                add(sub)
                break
    # 지역
    for r in _REGIONS:
        if r in text:
            add(r)
            break
    # 주제
    for t in _TOPICS:
        if re.search(re.escape(t), text):
            add(t)
            if len(tags) >= limit:
                break
    # 비면 카테고리라도
    if not tags and category:
        add(category)
    return tags[:limit]
