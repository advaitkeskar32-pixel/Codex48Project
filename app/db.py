"""Database engine and session helpers.

Works with TiDB Cloud (MySQL protocol, TLS required) and with SQLite for tests.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


def _looks_like_placeholder(value: str) -> bool:
    cleaned = value.strip()
    return (
        not cleaned
        or "*" in cleaned
        or "<your-" in cleaned.lower()
        or "placeholder" in cleaned.lower()
        or cleaned.startswith("mysql") and "@" not in cleaned
        or "tidbcloud.com" in cleaned and "@" not in cleaned
    )


def _usable_url(url: str) -> str:
    if _looks_like_placeholder(url):
        return "sqlite:///./brandguard.db"
    if url.startswith("mysql"):
        try:
            from sqlalchemy.engine import make_url

            parsed = make_url(url)
            if not parsed.username or "*" in parsed.username or not parsed.host:
                return "sqlite:///./brandguard.db"
        except Exception:
            return "sqlite:///./brandguard.db"
    return url


def make_engine(url: str | None = None):
    candidate_url = _usable_url(url or settings.database_url)
    kwargs: dict = {"pool_pre_ping": True}

    if candidate_url.startswith("mysql"):
        import certifi

        # TiDB Cloud serverless requires TLS; certifi's CA bundle validates it.
        kwargs["connect_args"] = {"ssl": {"ca": certifi.where()}}
        kwargs["pool_recycle"] = 280
    elif candidate_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_engine(candidate_url, **kwargs)
    if candidate_url.startswith("mysql"):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:
            sqlite_url = "sqlite:///./brandguard.db"
            return create_engine(sqlite_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    return engine


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def _migrate_sqlite_reviews(eng) -> None:
    """Add columns introduced by the workflow schema to older local databases."""
    if not str(eng.url).startswith("sqlite"):
        return

    from sqlalchemy import inspect, text

    inspector = inspect(eng)
    if "reviews" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("reviews")}
    additions = {
        "title": "VARCHAR(300) NOT NULL DEFAULT 'Untitled Content'",
        "channel": "VARCHAR(100) NOT NULL DEFAULT 'General'",
        "status": "VARCHAR(30) NOT NULL DEFAULT 'draft'",
        "creator_name": "VARCHAR(100) NOT NULL DEFAULT 'Maya (Content Creator)'",
        "assigned_reviewer": "VARCHAR(100) NOT NULL DEFAULT 'Jordan (Brand Manager)'",
        "version": "INTEGER NOT NULL DEFAULT 1",
        "ai_used": "BOOLEAN NOT NULL DEFAULT 0",
        "ai_error": "VARCHAR(500) NOT NULL DEFAULT ''",
        "updated_at": "DATETIME",
    }

    with eng.begin() as connection:
        for column, definition in additions.items():
            if column not in existing:
                connection.execute(text(f"ALTER TABLE reviews ADD COLUMN {column} {definition}"))


def _migrate_sqlite_workflow(eng) -> None:
    _migrate_sqlite_reviews(eng)

    if not str(eng.url).startswith("sqlite"):
        return

    from sqlalchemy import inspect, text

    inspector = inspect(eng)
    if "findings" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("findings")}
    additions = {
        "verdict": "VARCHAR(20)",
        "message": "TEXT NOT NULL DEFAULT ''",
        "original": "TEXT NOT NULL DEFAULT ''",
        "suggestion": "TEXT NOT NULL DEFAULT ''",
        "start": "INTEGER",
        "end": "INTEGER",
        "evidence": "TEXT NOT NULL DEFAULT '{}'",
        "status": "VARCHAR(12) NOT NULL DEFAULT 'open'",
        "dismiss_reason": "VARCHAR(500) NOT NULL DEFAULT ''",
        "incorrect_finding": "BOOLEAN NOT NULL DEFAULT 0",
        "decided_at": "DATETIME",
    }
    with eng.begin() as connection:
        for column, definition in additions.items():
            if column not in existing:
                connection.execute(text(f"ALTER TABLE findings ADD COLUMN {column} {definition}"))


def init_db(eng=None) -> None:
    from . import models  # noqa: F401  (register tables)

    active_engine = eng or engine
    Base.metadata.create_all(active_engine)
    _migrate_sqlite_workflow(active_engine)


def get_session():
    """FastAPI dependency."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
