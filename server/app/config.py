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
    allowed_email_domains: str = "hansolax.com"

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

    # === 영업일지 메일 자동 적재 (백엔드 폴링) ===
    #  [HSP SalesMemo] 메일을 주기적으로 확인해 파싱 후 sales_memo 테이블에 upsert 한다.
    sales_memo_sync_enabled: bool = True                 # 폴링 활성화 여부
    sales_memo_poll_seconds: int = 300                   # 폴링 주기(초). 기본 5분
    sales_memo_query: str = 'subject:"HSP SalesMemo"'    # 대상 메일 Gmail 검색식
    sales_memo_max_scan: int = 30                        # 한 번에 훑을 최근 메일 수

    # === 로컬 LLM (Ollama) — AI 위클리 브리핑 생성 ===
    #  컨테이너에서는 OLLAMA_URL=http://host.docker.internal:11434 로 호스트 ollama 사용.
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:14b"
    # 메일 적재 시 3줄 AI 요약을 백그라운드로 미리 생성해 sales_memo.ai_summary 에 저장.
    ai_summary_enabled: bool = True
    ai_summary_interval: int = 2  # 한 건 생성 후 대기(초). GPU 과점유 방지

    # === AI 위클리 브리핑 (부서별, 백그라운드 사전생성) ===
    #  요청 시점에 LLM 을 호출하지 않고, briefing_backfill 이 미리 만들어 ai_briefing 에 저장.
    briefing_enabled: bool = True
    briefing_interval: int = 2          # 부서 한 건 생성 후 대기(초). GPU 과점유 방지
    briefing_ttl_seconds: int = 21600   # 새 메모가 없어도 이 주기(기본 6h)마다 재생성
    briefing_memo_limit: int = 40       # 브리핑 생성에 참고할 최근 메모 수

    # === 부서/팀 ===
    #  회원가입 팀 선택지이자 세일즈 메모 '부서' 필터의 단일 출처 (실제 조직표).
    departments: str = (
        "공간솔루션팀,시판사업성장팀,데코솔루션팀,가구솔루션팀,"
        "상업공간파트너팀,건자재솔루션1팀,건자재솔루션2팀,브랜드마케팅팀"
    )
    #  사용자 부서를 모를 때(미로그인/부서 미입력) 쓰는 '본인 부서' 폴백.
    my_department: str = "공간솔루션팀"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_domains(self) -> list[str]:
        """쉼표로 구분된 도메인 문자열 -> 소문자 리스트."""
        return [d.strip().lower() for d in self.allowed_email_domains.split(",") if d.strip()]

    @property
    def department_list(self) -> list[str]:
        """쉼표로 구분된 부서 문자열 -> 리스트."""
        return [d.strip() for d in self.departments.split(",") if d.strip()]

    @property
    def mail_from(self) -> str:
        return self.smtp_from or self.smtp_user or "no-reply@localhost"


settings = Settings()
