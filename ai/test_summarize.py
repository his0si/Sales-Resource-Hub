#!/usr/bin/env python3
"""qwen2.5:14b 로 sales_memo 한 건을 고정 JSON 스키마로 요약 테스트."""
import json, sys, time, urllib.request, subprocess

MEMO_ID = sys.argv[1] if len(sys.argv) > 1 else "326"

# --- DB 에서 메모 한 건 로드 ---
cols = ["visit_date","author_name","customer_name","strategy",
        "operation","product","takeaway","followup_plan","activity_plan"]
sql = f"SELECT row_to_json(t) FROM (SELECT {','.join(cols)} FROM sales_memo WHERE id={MEMO_ID}) t;"
raw = subprocess.run(
    ["psql","-h","127.0.0.1","-p","5433","-U","hansolax","-d","hansolax","-t","-A","-c",sql],
    env={"PGPASSWORD":"hansol0513","PATH":"/usr/bin:/bin"},
    capture_output=True, text=True).stdout.strip()
memo = json.loads(raw)

# 원본 본문 (관점별 필드 합치기)
body = "\n\n".join(
    f"[{k}]\n{memo[k]}" for k in
    ["strategy","operation","product","takeaway","followup_plan","activity_plan"]
    if memo.get(k))

SCHEMA_DESC = """반드시 아래 JSON 스키마로만 출력하라. 다른 텍스트 금지.
{
  "channel": "시판" | "특판" | "미상",         // 대리점/취급점 대상이면 시판, 건설사/특판현장이면 특판
  "customer": "거래선명",
  "product_categories": ["가구재" | "바닥재" | "인테리어필름" | "하드웨어/부자재" | "기타"],
  "products_mentioned": ["원문에 등장한 구체 제품/브랜드명 그대로"],
  "summary_dealer_view": "대리점(거래선) 입장에서 무엇을 말했는지 사실만 3~4문장",
  "summary_sales_view": "영업사원이 챙겨야 할 현장 사실·요청사항만 3~4문장",
  "key_issues": [
    {"category":"제품군","product":"제품명","issue":"이슈 사실","type":"고객불만"|"시장동향"|"경쟁사"|"기회"|"요청"}
  ],
  "cross_team_alerts": [
    {"target":"이 이슈를 알아야 할 담당(예: 바닥재 담당)","reason":"왜 알아야 하는지 사실"}
  ]
}
규칙:
- AI 의견/추천/평가/전망을 절대 쓰지 마라. 원문에 적힌 사실만 옮겨라.
- 시판부문과 특판부문 내용은 섞지 말고 channel 로 명확히 구분하라.
- 담당 제품군이 달라도 캐치해야 할 이슈는 cross_team_alerts 에 넣어라."""

prompt = f"""너는 한솔홈데코 영업일지 요약기다. 아래 영업일지를 분석해 JSON 으로만 답하라.

{SCHEMA_DESC}

== 영업일지 ==
거래선: {memo['customer_name']} / 작성자: {memo['author_name']} / 방문일: {memo['visit_date']}

{body}
"""

req = {"model":"qwen2.5:14b","prompt":prompt,"stream":False,
       "format":"json","options":{"temperature":0.2,"num_ctx":8192}}
t0=time.time()
r = urllib.request.urlopen("http://localhost:11434/api/generate",
        data=json.dumps(req).encode(), timeout=600)
resp = json.loads(r.read())
dt=time.time()-t0
out = resp["response"]
print(f"=== 입력 {len(prompt)}자 / 생성 {dt:.1f}초 / {resp.get('eval_count','?')} tok ===\n")
try:
    parsed = json.loads(out)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))
except Exception as e:
    print("JSON 파싱 실패:", e); print(out)
