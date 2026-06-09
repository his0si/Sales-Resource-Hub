#!/usr/bin/env python3
"""세일즈 메모 요약 테스트 하니스.
Ollama(qwen2.5)로 메모 1건을 고정 JSON 스키마로 요약한다.
원칙: AI의 의견/추천 금지, 원문에 있는 내용만 요약·분류한다.

사용법:
  python3 summarize.py [memo_sample.json] [--model qwen2.5:14b]
"""
import json, sys, time, urllib.request

OLLAMA = "http://localhost:11434/api/chat"

SYSTEM = """너는 한솔(건축자재) 영업조직의 '세일즈 메모 요약기'다.
절대 규칙:
1. 너의 의견·추천·평가·제안을 만들지 마라. 원문(메모)에 적힌 사실만 요약·분류한다.
   영업사원의 의사결정은 사람이 한다. 너는 근거 자료만 정리한다.
2. 원문에 없는 정보를 지어내지 마라. 불확실하면 빈 배열/"불명"으로 둔다.
3. 시판부문과 특판부문의 내용은 명확히 구분한다.
4. 가구재 담당자도 바닥재 이슈를 캐치해야 하듯, 담당 제품군과 별개로 언급된
   '다른 제품군' 이슈는 타제품_참고알림 에 따로 분리해 담는다.
출력은 반드시 아래 JSON 스키마 하나만, 다른 말 없이 출력한다."""

SCHEMA_GUIDE = """{
  "부문": "시판 | 특판 | 불명",                       // 메모 정황상 판단, 근거 없으면 불명
  "주제품군": ["가구재" | "바닥재" | "벽장재" | "기타"], // 메모의 핵심 제품군
  "언급제품": ["스토리보드", "포그그레이", ...],         // 원문에 등장한 제품/패턴명 그대로
  "핵심이슈": [
    {"제품": "캐니언미스트", "이슈": "이색(붉은끼) 문제", "심각도": "상|중|하"}
  ],
  "경쟁사동향": ["LX 보르떼 5/1 단가인상", "예림 5/18 2차 인상", ...],
  "요약_사원관점": "영업사원이 후속 영업활동에 쓸 사실/할일 중심 3~5문장 (의견 금지)",
  "요약_대리점관점": "대리점/거래선이 제기한 VOC·요구·불만 중심 3~5문장 (의견 금지)",
  "타제품_참고알림": [
    {"제품군": "바닥재", "내용": "담당 제품군 외의 제품 이슈를 한 줄로"}
  ]
}"""

def build_user_prompt(memo: dict) -> str:
    return (
        "다음은 세일즈 메모 1건이다. 빈 필드는 무시하라.\n\n"
        f"--- 메모 ---\n{json.dumps(memo, ensure_ascii=False, indent=2)}\n--- 끝 ---\n\n"
        f"아래 스키마 그대로 JSON 한 개만 출력하라:\n{SCHEMA_GUIDE}"
    )

def run(memo: dict, model: str) -> tuple[str, float]:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": build_user_prompt(memo)},
        ],
        "stream": False,
        "format": "json",          # Ollama 구조화 출력 강제
        "options": {"temperature": 0.1, "num_ctx": 8192},
    }
    req = urllib.request.Request(
        OLLAMA, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=600) as r:
        out = json.load(r)
    return out["message"]["content"], time.time() - t0

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "memo_sample.json"
    model = "qwen2.5:14b"
    if "--model" in sys.argv:
        model = sys.argv[sys.argv.index("--model") + 1]
    with open(path, encoding="utf-8") as f:
        memo = json.load(f)
    content, dt = run(memo, model)
    print(f"=== model={model}  latency={dt:.1f}s ===\n")
    try:
        print(json.dumps(json.loads(content), ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        print("[JSON 파싱 실패 — 원문 출력]\n" + content)
