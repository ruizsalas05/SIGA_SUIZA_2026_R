from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import MetaData
from sqlalchemy.pool import NullPool
import os
import sys
from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, String, JSON, Boolean, text, Table

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME", "siga_suiza_2026")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

metadata = MetaData()
Base = declarative_base(metadata=metadata)

core_users_table = Table(
    "core_users",
    metadata,
    Column("id", Integer, primary_key=True),
    extend_existing=True,
)

class TimeStampedMixin:
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BaseModel(Base, TimeStampedMixin):
    __abstract__ = True
    id = Column(Integer, primary_key=True, index=True)

class OutboxEvent(BaseModel):
    __tablename__ = "outbox_events"
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    published = Column(Boolean, default=False, index=True)

_is_test = (os.getenv("DB_NAME") == "siga_test") or ("pytest" in sys.modules)

_engine_kwargs = {}
if _is_test:
    _engine_kwargs["poolclass"] = NullPool
    _engine_kwargs["echo"] = False
else:
    _engine_kwargs["echo"] = True
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_recycle"] = 300

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as db:
        try:
            yield db
        except BaseException:
            await db.rollback()
            raise
        finally:
            await db.close()

async def _backfill_periodo_admision(conn):
    try:
        async with conn.begin_nested():
            await conn.execute(text("""
                UPDATE estudiantes e
                SET periodo_admision_id = (oe.payload->'data'->>'periodo_id')::int
                FROM outbox_events oe
                WHERE e.periodo_admision_id IS NULL
                  AND oe.event_type = 'gestion_academica.admision.estudiante_ingresado'
                  AND (oe.payload->'data'->>'estudiante_id')::int = e.id
                  AND NULLIF(oe.payload->'data'->>'periodo_id', '') ~ '^\\d+$'
            """))
    except Exception as exc:
        print(f"  • backfill periodo_admision_id skipped: {exc}")


async def ensure_schema(conn=None):
    sentencias = [
        "ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS plan_estudios_id INTEGER",
        "ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS ciclo_actual INTEGER DEFAULT 1",
        "ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS periodo_admision_id INTEGER",
        "CREATE INDEX IF NOT EXISTS ix_estudiantes_periodo_admision_id ON estudiantes (periodo_admision_id)",
        "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS ciclo INTEGER",
        "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS casuistica VARCHAR(50)",
        "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS boleta_codigo VARCHAR(64)",
        "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS boleta_emitida_en TIMESTAMP",
        "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS consolidada BOOLEAN DEFAULT FALSE",
        "ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS registro_academico VARCHAR(50)",
    ]

    async def aplicar(connection):
        for sentencia in sentencias:
            await connection.execute(text(sentencia))
        await _backfill_periodo_admision(connection)

    if conn is None:
        async with engine.begin() as connection:
            await aplicar(connection)
    else:
        await aplicar(conn)
    print("Esquema de matrícula verificado/actualizado")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            async with conn.begin_nested():
                await conn.execute(text("ALTER TABLE estudiantes ALTER COLUMN foto_url TYPE TEXT"))
        except Exception as exc:
            print(f"  • foto_url (TEXT) check skipped: {exc}")
        await ensure_schema(conn)
    print("Tablas creadas/verificadas")
