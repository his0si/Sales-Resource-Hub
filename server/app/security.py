"""비밀번호 해싱(bcrypt) + JWT 토큰 발급/검증."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings


# --- 비밀번호 ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# --- JWT ---

def _create_token(subject: str, token_type: str, expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,          # "access"(로그인) | "verify"(이메일 인증)
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(email: str) -> str:
    return _create_token(email, "access", settings.access_token_expire_minutes)


def create_verify_token(email: str) -> str:
    return _create_token(email, "verify", settings.verify_token_expire_minutes)


def decode_token(token: str, expected_type: str) -> str:
    """토큰을 검증하고 sub(email)을 돌려준다. 실패 시 jwt 예외 발생."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("토큰 종류가 올바르지 않습니다.")
    sub = payload.get("sub")
    if not sub:
        raise jwt.InvalidTokenError("토큰에 sub 가 없습니다.")
    return sub
