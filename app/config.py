"""Central settings, read from environment variables (and .env if present)."""
import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv is optional
    pass


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./brandguard.db").strip()
    if url.startswith("mysql"):
        try:
            from sqlalchemy.engine import make_url

            parsed = make_url(url)
            if not parsed.username or "*" in parsed.username or parsed.host in {None, ""}:
                return "sqlite:///./brandguard.db"
        except Exception:
            return "sqlite:///./brandguard.db"
    return url or "sqlite:///./brandguard.db"


@dataclass(frozen=True)
class Settings:
    database_url: str = _database_url()
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    gemini_embed_model: str = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
    retrieval_top_k: int = int(os.getenv("RETRIEVAL_TOP_K", "5"))
    # Passages weaker than this cosine similarity are not shown to the model.
    min_similarity: float = float(os.getenv("MIN_SIMILARITY", "0.35"))


settings = Settings()
