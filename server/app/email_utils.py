"""Gmail SMTP 로 이메일 인증 메일 발송."""

from email.message import EmailMessage

import aiosmtplib

from app.config import settings


async def send_verification_email(to_email: str, verify_url: str) -> None:
    # SMTP 미설정(로컬 개발 등)이면 메일을 보내지 않고 콘솔에 링크만 출력한다.
    if not settings.smtp_user or not settings.smtp_password:
        print(f"[email] SMTP 미설정 — 인증 링크를 직접 여세요:\n  {verify_url}")
        return

    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = to_email
    message["Subject"] = "[한솔홈데코] 이메일 인증을 완료해주세요"
    message.set_content(
        "아래 링크를 클릭하면 이메일 인증이 완료됩니다.\n\n"
        f"{verify_url}\n\n"
        "본인이 요청하지 않았다면 이 메일을 무시하세요.\n"
        "(이 링크는 24시간 동안만 유효합니다.)"
    )
    message.add_alternative(
        f"""\
<html>
  <body style="font-family: sans-serif; line-height: 1.6; color: #222;">
    <h2>이메일 인증</h2>
    <p>아래 버튼을 클릭하면 이메일 인증이 완료됩니다.</p>
    <p>
      <a href="{verify_url}"
         style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
                text-decoration:none;border-radius:8px;font-weight:600;">
        이메일 인증하기
      </a>
    </p>
    <p style="color:#666;font-size:13px;">
      버튼이 동작하지 않으면 아래 주소를 복사해서 브라우저에 붙여넣으세요:<br>
      <a href="{verify_url}">{verify_url}</a>
    </p>
    <p style="color:#999;font-size:12px;">이 링크는 24시간 동안만 유효합니다.</p>
  </body>
</html>
""",
        subtype="html",
    )

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        start_tls=True,
        username=settings.smtp_user,
        password=settings.smtp_password,
    )
