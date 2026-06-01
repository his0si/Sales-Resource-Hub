"""로그인 인증 라우터.

흐름:
  1) POST /api/auth/register  : 도메인 검증 -> 미인증 유저 생성 -> 인증메일 발송
  2) GET  /api/auth/verify    : 메일 링크. JWT 검증 후 is_verified=TRUE, 프론트로 리다이렉트
  3) POST /api/auth/login     : 자격 확인 + 인증여부 확인 -> access 토큰 발급
  4) GET  /api/auth/me        : Bearer 토큰으로 본인 정보 조회
"""

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app import db
from app.config import settings
from app.email_utils import send_verification_email
from app.security import (
    create_access_token,
    create_verify_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=True)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="8자 이상")


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _check_domain(email: str) -> None:
    domain = email.rsplit("@", 1)[-1].lower()
    if domain not in settings.allowed_domains:
        allowed = ", ".join(settings.allowed_domains)
        raise HTTPException(
            status_code=400,
            detail=f"허용된 이메일 도메인이 아닙니다. ({allowed} 만 가입 가능)",
        )


@router.get("/config")
async def auth_config():
    """프론트엔드가 허용 도메인을 표시/안내하는 데 사용 (도메인 단일 출처)."""
    return {"allowed_domains": settings.allowed_domains}


@router.post("/register")
async def register(body: RegisterIn):
    email = str(body.email).lower()
    _check_domain(email)

    pool = db.get_pool()
    existing = await pool.fetchrow(
        "SELECT id, is_verified FROM users WHERE email = $1", email
    )
    if existing and existing["is_verified"]:
        raise HTTPException(status_code=409, detail="이미 가입된 이메일입니다.")

    hashed = hash_password(body.password)
    if existing:
        # 미인증 상태에서 재가입: 비밀번호 갱신 후 인증메일 재발송
        await pool.execute(
            "UPDATE users SET password = $1 WHERE email = $2", hashed, email
        )
    else:
        await pool.execute(
            "INSERT INTO users (email, password, is_verified) VALUES ($1, $2, FALSE)",
            email,
            hashed,
        )

    token = create_verify_token(email)
    verify_url = f"{settings.app_base_url}/api/auth/verify?token={token}"
    await send_verification_email(email, verify_url)
    return {"message": "인증 메일을 보냈습니다. 메일함을 확인해 인증을 완료해주세요."}


@router.get("/verify")
async def verify(token: str):
    """메일 링크 진입점. 결과를 쿼리스트링에 담아 프론트 /login 으로 리다이렉트."""
    try:
        email = decode_token(token, "verify")
    except jwt.ExpiredSignatureError:
        return RedirectResponse(f"{settings.app_base_url}/login?verified=expired")
    except jwt.InvalidTokenError:
        return RedirectResponse(f"{settings.app_base_url}/login?verified=invalid")

    pool = db.get_pool()
    await pool.execute(
        "UPDATE users SET is_verified = TRUE WHERE email = $1", email.lower()
    )
    return RedirectResponse(f"{settings.app_base_url}/login?verified=success")


@router.post("/login")
async def login(body: LoginIn):
    email = str(body.email).lower()
    pool = db.get_pool()
    user = await pool.fetchrow(
        "SELECT id, email, password, is_verified FROM users WHERE email = $1", email
    )
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    if not user["is_verified"]:
        raise HTTPException(
            status_code=403, detail="이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요."
        )

    access = create_access_token(email)
    return {"access_token": access, "token_type": "bearer", "email": email}


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        email = decode_token(cred.credentials, "access")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")

    pool = db.get_pool()
    user = await pool.fetchrow(
        "SELECT id, email, is_verified, created_at FROM users WHERE email = $1",
        email.lower(),
    )
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")
    return dict(user)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
