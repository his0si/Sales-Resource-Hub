"""제품 카테고리 조회 라우터.

categories.json 기반의 카테고리 트리와 '본인 부서' 기본값을 제공한다.
세일즈 메모/제품 리스트 화면의 부서·카테고리 필터가 이 값을 사용한다.
"""

from fastapi import APIRouter, Depends

from app import categories
from app.config import settings
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api", tags=["categories"])


@router.get("/categories")
async def get_categories(_user: dict = Depends(get_current_user)):
    tree = categories.category_tree()
    return {
        "categories": tree["categories"],
        "tree": tree["tree"],
        "my_department": settings.my_department,
    }
