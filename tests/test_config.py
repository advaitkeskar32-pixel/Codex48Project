def test_make_engine_falls_back_to_sqlite_when_mysql_connect_fails(monkeypatch):
    import app.db as db

    class FakeEngine:
        def __init__(self, url):
            self.url = url

        def connect(self):
            if str(self.url).startswith("mysql"):
                raise RuntimeError("bad credentials")
            return _NoopConnection()

    class _NoopConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, *_args, **_kwargs):
            return None

    def fake_create_engine(url, **kwargs):
        return FakeEngine(url)

    monkeypatch.setattr(db, "create_engine", fake_create_engine)
    engine = db.make_engine("mysql+pymysql://user@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/brandguard")

    assert str(engine.url) == "sqlite:///./brandguard.db"


def test_sqlite_review_schema_migration(tmp_path):
    import sqlalchemy
    from app.db import Base, _migrate_sqlite_reviews

    engine = sqlalchemy.create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as connection:
        connection.execute(sqlalchemy.text("""
            CREATE TABLE reviews (
                id INTEGER PRIMARY KEY,
                org_id INTEGER NOT NULL,
                user_id INTEGER,
                channel VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                ai_used BOOLEAN NOT NULL,
                ai_error VARCHAR(500) NOT NULL,
                created_at DATETIME
            )
        """))

    _migrate_sqlite_reviews(engine)

    columns = {column["name"] for column in sqlalchemy.inspect(engine).get_columns("reviews")}
    assert {
        "title", "channel", "status", "creator_name", "assigned_reviewer",
        "version", "ai_used", "ai_error", "updated_at",
    } <= columns
