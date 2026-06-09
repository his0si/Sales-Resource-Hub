"""조직 마스터(employees) 조회 — 세일즈 메모 작성자의 부서/부문 판별.

employees 테이블(부문/부서/사번/성명)을 메모 작성자와 대조해
"이 메모 원문이 어느 부서/부문에서 나온 것인지"를 판별한다.

매칭 우선순위:
  1) 사번(author_emp_no = emp_no)  — 정확 매칭(권장)
  2) 성명(author_name = name)      — 사번이 없거나 미등록일 때 폴백.
                                     동명이인이 있으면 매칭하지 않는다(모호).

조직표는 정적이라 메모 한 건마다 DB 를 때리지 않도록, 한 번 읽어
emp_no→부서, name→부서 dict 두 개로 만들어 board 핸들러가 재사용한다.
"""

import asyncpg


class EmployeeDirectory:
    """employees 한 스냅샷에 대한 사번/성명 → (부서, 부문) 조회기."""

    def __init__(self, rows: list[asyncpg.Record]):
        # 사번 → (부서, 부문): 사번은 유니크하므로 항상 단일 매핑
        self._by_emp: dict[str, tuple[str, str]] = {}
        # 성명 → (부서, 부문): 동명이인은 모호하므로 제외(아래에서 처리)
        name_hits: dict[str, set[tuple[str, str]]] = {}
        for r in rows:
            team, division = r["team"], r["division"]
            emp_no = (r["emp_no"] or "").strip()
            name = (r["name"] or "").strip()
            if emp_no:
                self._by_emp[emp_no] = (team, division)
            if name:
                name_hits.setdefault(name, set()).add((team, division))
        self._by_name: dict[str, tuple[str, str]] = {
            name: next(iter(hits)) for name, hits in name_hits.items() if len(hits) == 1
        }

    def lookup(self, emp_no: str | None, name: str | None) -> tuple[str | None, str | None]:
        """작성자 사번/성명 → (부서, 부문). 못 찾으면 (None, None)."""
        if emp_no:
            hit = self._by_emp.get(emp_no.strip())
            if hit:
                return hit
        if name:
            hit = self._by_name.get(name.strip())
            if hit:
                return hit
        return None, None


async def load_directory(pool: asyncpg.Pool) -> EmployeeDirectory:
    """employees 테이블을 읽어 조회기를 만든다 (테이블이 없으면 빈 조회기)."""
    try:
        rows = await pool.fetch("SELECT emp_no, name, team, division FROM employees")
    except asyncpg.UndefinedTableError:
        rows = []
    return EmployeeDirectory(rows)
