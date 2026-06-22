from __future__ import annotations

import csv
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env", override=True)


PRODUCT_CATEGORY_OPTIONS = ["바닥재", "가구재", "벽장재", "인테리어 필름", "세라믹 상판"]
VALID_SOURCES = ["working_news_articles", "sales_memo", "raw_consumer_trend"]
NEWS_SOURCE = "working_news_articles"
SALES_MEMO_SOURCE = "sales_memo"
VOC_SOURCE = "raw_consumer_trend"


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", str(text)).lower()


def load_product_names(path: Path | None = None) -> list[str]:
    product_path = path or ROOT_DIR / "products.csv"
    try:
        with product_path.open(newline="", encoding="utf-8-sig") as f:
            return sorted(
                {row["product_name"] for row in csv.DictReader(f) if row.get("product_name")},
                key=len,
                reverse=True,
            )
    except FileNotFoundError:
        return []


@dataclass(frozen=True)
class Settings:
    database_url: str
    ollama_chat_model: str = "exaone3.5"
    ollama_base_url: str = "http://localhost:11434"
    ollama_embedding_model: str = "bge-m3"

    @classmethod
    def from_env(cls) -> "Settings":
        from app.config import settings as server_settings
        database_url = os.getenv("DATABASE_URL") or server_settings.database_url
        if not database_url:
            raise ValueError("DATABASE_URL is not set")

        return cls(
            database_url=database_url,
            ollama_chat_model=os.getenv("OLLAMA_CHAT_MODEL", cls.ollama_chat_model),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL") or server_settings.ollama_url,
            ollama_embedding_model=os.getenv("OLLAMA_EMBEDDING_MODEL", cls.ollama_embedding_model),
        )


PRODUCT_NAMES = load_product_names()
