"""Database setup using SQLAlchemy."""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables from models and apply lightweight migrations if needed."""
    from app.models import case  # noqa: F401 — ensures models are registered
    Base.metadata.create_all(bind=engine)

    # Lightweight column migration for existing SQLite databases
    if "sqlite" in settings.DATABASE_URL:
        import sqlite3
        db_path = settings.DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
        if db_path and not db_path.startswith(":memory:"):
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                
                # Check cases columns
                cur.execute("PRAGMA table_info(cases)")
                case_cols = {r[1] for r in cur.fetchall()}
                if "input_type" not in case_cols:
                    cur.execute("ALTER TABLE cases ADD COLUMN input_type VARCHAR DEFAULT 'dicom'")
                if "analysis_mode" not in case_cols:
                    cur.execute("ALTER TABLE cases ADD COLUMN analysis_mode VARCHAR DEFAULT 'volumetric_ct'")
                
                # Check scan_metadata columns
                cur.execute("PRAGMA table_info(scan_metadata)")
                sm_cols = {r[1] for r in cur.fetchall()}
                if "input_type" not in sm_cols:
                    cur.execute("ALTER TABLE scan_metadata ADD COLUMN input_type VARCHAR DEFAULT 'dicom'")
                if "analysis_mode" not in sm_cols:
                    cur.execute("ALTER TABLE scan_metadata ADD COLUMN analysis_mode VARCHAR DEFAULT 'volumetric_ct'")
                
                conn.commit()
                conn.close()
            except Exception:
                pass

