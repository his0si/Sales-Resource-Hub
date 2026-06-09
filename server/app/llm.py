"""로컬 LLM(Ollama) 호출 헬퍼.

ollama serve 가 떠 있는 호스트(settings.ollama_url)에 /api/generate 로 프롬프트를 보내고
완성 텍스트를 받는다. AI 위클리 브리핑 생성에 사용한다.
"""

import httpx

from app.config import settings


class LLMError(RuntimeError):
    pass


async def generate(prompt: str, *, num_predict: int = 320, temperature: float = 0.4) -> str:
    """Ollama 로 텍스트 생성. 실패 시 LLMError."""
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": num_predict, "temperature": temperature},
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(f"{settings.ollama_url}/api/generate", json=payload)
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        raise LLMError(f"Ollama 호출 실패: {exc}") from exc
    text = (data.get("response") or "").strip()
    if not text:
        raise LLMError("LLM 응답이 비어 있습니다.")
    return text
