from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 컨테이너에서는 docker-compose env_file(server/.env)이 환경변수로 주입,
    # 로컬 개발에서는 server/.env 파일을 직접 읽음.
    database_url: str | None = None

    # === 인증 / JWT ===
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24       # 로그인 토큰 유효기간(24시간)
    verify_token_expire_minutes: int = 60 * 24       # 이메일 인증 링크 유효기간(24시간)

    # === 가입 허용 이메일 도메인 (쉼표로 구분) ===
    #  ★ 도메인을 바꾸려면 여기(또는 .env 의 ALLOWED_EMAIL_DOMAINS)만 수정하면 됩니다.
    #    프론트엔드도 /api/auth/config 로 이 값을 받아오므로 다른 곳은 손댈 필요 없습니다.
    allowed_email_domains: str = "ewhain.net,ewha.ac.kr"

    # === Gmail SMTP (인증 메일 발송) ===
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str | None = None       # 발송에 쓸 Gmail 주소
    smtp_password: str | None = None   # Gmail "앱 비밀번호"(16자리, 일반 비번 아님)
    smtp_from: str | None = None       # 보내는 사람 표시(미설정 시 smtp_user 사용)

    # 인증 링크/리다이렉트에 사용하는 서비스 기본 URL
    app_base_url: str = "https://hansolax.kro.kr"

    # === Gmail API (메일 읽기, OAuth2) ===
    #  고정된 한 계정의 메일을 서버가 읽는 용도. 동의는 한 번만 하고,
    #  이후엔 refresh token 으로 access token 을 자동 발급해 Gmail API 를 호출한다.
    #  ★ 읽을 메일 계정을 바꾸려면: 새 계정으로 scripts/gmail_authorize.py 를 다시 돌려
    #    refresh token 을 새로 발급받아 GMAIL_REFRESH_TOKEN 을 교체하고,
    #    GMAIL_MAILBOX 를 새 주소로 바꾸면 됩니다.
    gmail_client_id: str | None = None
    gmail_client_secret: str | None = None
    gmail_refresh_token: str | None = None
    gmail_mailbox: str = "ai.hansolhomedeco@gmail.com"   # 읽을 메일 계정(표시·확인용)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_domains(self) -> list[str]:
        """쉼표로 구분된 도메인 문자열 -> 소문자 리스트."""
        return [d.strip().lower() for d in self.allowed_email_domains.split(",") if d.strip()]

    @property
    def mail_from(self) -> str:
        return self.smtp_from or self.smtp_user or "no-reply@localhost"


settings = Settings()
