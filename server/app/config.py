from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # 컨테이너에서는 docker-compose env_file(server/.env)이 환경변수로 주입,
    # 로컬 개발에서는 server/.env 파일을 직접 읽음.
    database_url: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
