"""Gmail 읽기용 refresh token 을 최초 1회 발급받는 스크립트.

사용법 (server 디렉터리에서):
    python scripts/gmail_authorize.py

준비물: .env 에 GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET 가 들어 있어야 한다
(Google Cloud Console 에서 OAuth 클라이언트 발급 후).

흐름:
  1) 출력된 URL 을 브라우저에서 연다 → 읽으려는 Gmail 계정으로 로그인 → 동의.
  2) http://localhost/?code=... 로 리다이렉트되며 페이지는 안 열리지만(정상),
     주소창의 code 값을 복사한다.
  3) 터미널에 붙여넣으면 refresh token 이 출력된다 → .env 의 GMAIL_REFRESH_TOKEN 에 저장.

※ SSH 서버라 localhost 페이지가 안 떠도 됩니다. 주소창의 code 만 있으면 됩니다.
"""

import sys
import urllib.parse
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.gmail_client import SCOPES, TOKEN_URL  # noqa: E402

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
# OAuth 클라이언트에 등록해 둔 redirect URI 와 정확히 일치해야 한다.
REDIRECT_URI = "http://localhost"


def main() -> None:
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        sys.exit("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET 를 .env 에 먼저 넣으세요.")

    params = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",   # refresh token 을 받기 위함
        "prompt": "consent",        # 매번 refresh token 을 확실히 돌려받기 위함
    }
    print("\n1) 아래 URL 을 브라우저에서 열고, 읽으려는 Gmail 계정으로 동의하세요:\n")
    print(f"   {AUTH_URL}?{urllib.parse.urlencode(params)}\n")
    print("2) http://localhost/?code=... 로 리다이렉트되면 'code' 값을 복사하세요.")
    print("   (페이지가 안 열려도 정상 — 주소창의 code 만 있으면 됩니다.)\n")

    raw = input("code 값(또는 리다이렉트된 전체 URL) 붙여넣기: ").strip()
    # 전체 URL 을 붙여넣어도 code 만 뽑아낸다.
    if "code=" in raw:
        raw = urllib.parse.parse_qs(urllib.parse.urlparse(raw).query).get("code", [raw])[0]
    code = raw

    resp = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        sys.exit(f"\n토큰 교환 실패({resp.status_code}): {resp.text}")

    data = resp.json()
    refresh = data.get("refresh_token")
    if not refresh:
        sys.exit(
            "\nrefresh_token 이 응답에 없습니다. "
            "구글 계정 보안 > 타사 앱 액세스에서 이 앱 권한을 제거한 뒤 다시 시도하세요."
        )

    print("\n✅ 발급 완료. 아래 줄을 server/.env 에 저장하세요:\n")
    print(f"GMAIL_REFRESH_TOKEN={refresh}\n")


if __name__ == "__main__":
    main()
