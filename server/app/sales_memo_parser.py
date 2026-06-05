"""[HSP SalesMemo] 메일 본문(HTML 표) → sales_memo 컬럼 dict 파서.

메일은 라벨/값 셀이 번갈아 나오는 단일 표 구조다(예: 거래선 | 오성한솔하우징).
라벨 셀 바로 다음 셀이 그 값이라는 규칙만으로 안정적으로 추출한다.
표준 라이브러리(html.parser)만 사용해 의존성을 늘리지 않는다.
"""

import re
from datetime import date, datetime
from html.parser import HTMLParser

_WHITESPACE = re.compile(r"\s+")
_BLANK_LINES = re.compile(r"\n{3,}")

# 메일 라벨 -> sales_memo 컬럼. 공백을 한 칸으로 정규화한 라벨로 비교한다.
LABEL_TO_COLUMN = {
    "거래선": "customer_name",
    "방문예정일": "planned_visit_date",
    "방문일": "visit_date",
    "작성자": "author_name",
    "작성일": "written_at",
    "활동계획": "activity_plan",
    "전략": "strategy",
    "운영": "operation",
    "제품": "product",
    "개인": "personal",
    "영업사원 시사점": "takeaway",
    "팀장 피드백": "followup_plan",
}

DATE_COLUMNS = {"planned_visit_date", "visit_date"}
DATETIME_COLUMNS = {"written_at"}


class _CellCollector(HTMLParser):
    """<td> 단위로 텍스트를 모은다. <br> 은 줄바꿈으로 보존한다."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.cells: list[str] = []
        self._buf: list[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "td":
            self._buf = []
        elif tag == "br" and self._buf is not None:
            self._buf.append("\n")

    def handle_startendtag(self, tag: str, attrs) -> None:
        if tag == "br" and self._buf is not None:
            self._buf.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._buf is not None:
            self.cells.append("".join(self._buf))
            self._buf = None

    def handle_data(self, data: str) -> None:
        # HTML 에서 태그 사이 들여쓰기·줄바꿈은 의미 없는 공백이다.
        # 한 칸 공백으로 합쳐서 본문에 섞이지 않게 한다(줄바꿈은 <br> 로만 생긴다).
        if self._buf is not None:
            self._buf.append(_WHITESPACE.sub(" ", data))


def _norm_label(text: str) -> str:
    """라벨 비교용: 모든 공백을 한 칸으로 합치고 양끝 제거."""
    return " ".join(text.split())


def _clean_value(text: str) -> str:
    """값 셀 정리: 각 줄 양끝 공백 제거 → 빈 줄 2개 이상은 1개로 → 양끝 정리."""
    lines = [ln.strip() for ln in text.split("\n")]
    joined = "\n".join(lines).strip()
    return _BLANK_LINES.sub("\n\n", joined)


def _parse_date(value: str) -> date | None:
    value = value.strip()[:10]
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_datetime(value: str) -> datetime | None:
    value = value.strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def parse_memo_html(html: str) -> dict:
    """메일 HTML 표를 sales_memo 컬럼 dict 로 변환.

    인식한 라벨이 없으면 빈 dict 를 돌려준다(파싱 실패로 간주).
    날짜/시각 컬럼은 date/datetime 으로, 나머지는 None 또는 문자열로 채운다.
    """
    collector = _CellCollector()
    collector.feed(html)
    cells = collector.cells

    result: dict = {}
    i = 0
    while i < len(cells) - 1:
        label = _norm_label(cells[i])
        column = LABEL_TO_COLUMN.get(label)
        if column is None:
            i += 1
            continue
        raw_value = _clean_value(cells[i + 1])
        if column in DATE_COLUMNS:
            result[column] = _parse_date(raw_value)
        elif column in DATETIME_COLUMNS:
            result[column] = _parse_datetime(raw_value)
        else:
            result[column] = raw_value or None
        i += 2  # 값 셀은 라벨로 다시 보지 않도록 건너뛴다

    return result
