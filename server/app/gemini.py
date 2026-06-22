"""Gemini(google-genai) 호출 헬퍼 — 뉴스 AI 위클리 브리핑 생성 전용.

세일즈 메모 요약/부서 브리핑은 기존대로 호스트 Ollama(app.llm)를 쓰고,
뉴스 브리핑(news_briefing_backfill)만 이 헬퍼로 Gemini 를 호출한다.
키는 settings.gemini_api_key(.env 의 GEMINI_API_KEY) 에서 읽는다.
"""

import os

from app.config import settings


class GeminiError(RuntimeError):
    pass


_client = None


def _get_client():
    """google-genai 클라이언트(지연 생성). 키 없거나 패키지 미설치면 GeminiError."""
    global _client
    if _client is None:
        key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise GeminiError("GEMINI_API_KEY 미설정")
        try:
            from google import genai
        except ImportError as exc:  # google-genai 미설치
            raise GeminiError(f"google-genai 미설치: {exc}") from exc
        _client = genai.Client(api_key=key)
    return _client


async def generate(prompt: str) -> str:
    """Gemini 로 텍스트 생성. 실패 시 GeminiError."""
    try:
        client = _get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
    except GeminiError:
        raise
    except Exception as exc:  # SDK/네트워크/인증 오류 등
        raise GeminiError(f"Gemini 호출 실패: {exc}") from exc
    text = (resp.text or "").strip()
    if not text:
        raise GeminiError("Gemini 응답이 비어 있습니다.")
    return text
