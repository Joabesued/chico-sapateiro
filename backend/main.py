import os
print(f"PORT recebida: {os.environ.get('PORT', 'NÃO DEFINIDA')}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from database import engine, SessionLocal
import models
from routers import auth, ordens, clientes, relatorios, categorias, servicos
from migrate import run_migration

CATEGORIAS_PADRAO = [
    "Sapato social", "Tênis", "Sapatênis", "Mocassins", "Sandália",
    "Mala", "Cinto", "Bolsa", "Capa de prancha", "Carteira",
]


def _migrate_postgres():
    """Adiciona colunas novas ao PostgreSQL do Railway.
    migrate.py só trata SQLite — este bloco cobre o PostgreSQL.
    Usa ADD COLUMN IF NOT EXISTS, portanto é idempotente.
    """
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or db_url.startswith("sqlite"):
        return  # SQLite é coberto pelo migrate.py

    try:
        insp = inspect(engine)
        cols_it = {c["name"] for c in insp.get_columns("itens_os")}
        cols_os = {c["name"] for c in insp.get_columns("ordens_servico")}
        novos = []
        if "subcategoria" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS subcategoria TEXT DEFAULT ''")
        if "lado" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS lado TEXT DEFAULT ''")
        if "servicos_concluidos" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS servicos_concluidos TEXT NOT NULL DEFAULT '[]'")
        if "observacao_servico" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS observacao_servico TEXT DEFAULT ''")
        if "foto_url" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT ''")
        if "quantidade" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1")
        if "revisao" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS revisao BOOLEAN NOT NULL DEFAULT false")
        if "entregue" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS entregue BOOLEAN NOT NULL DEFAULT false")
        if "desconto" not in cols_os:
            novos.append("ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS desconto FLOAT DEFAULT 0.0")

        if novos:
            with engine.connect() as conn:
                for sql in novos:
                    conn.execute(text(sql))
                conn.commit()
            print(f"[migrate_postgres] {len(novos)} coluna(s) adicionada(s) em itens_os.")
        else:
            print("[migrate_postgres] Nenhuma coluna nova necessária.")
    except Exception as e:
        print(f"[migrate_postgres] ERRO: {e}")


def _seed_categorias():
    """Garante que as categorias padrão existam no banco — funciona em SQLite e PostgreSQL."""
    db = SessionLocal()
    try:
        for nome in CATEGORIAS_PADRAO:
            existe = db.query(models.Categoria).filter(models.Categoria.nome == nome).first()
            if not existe:
                db.add(models.Categoria(nome=nome))
        db.commit()
        print("[seed_categorias] Categorias verificadas.")
    except Exception as e:
        print(f"[seed_categorias] ERRO: {e}")
        db.rollback()
    finally:
        db.close()


# ── Inicialização ──────────────────────────────────────────────────────────────

# 1. Cria tabelas que ainda não existem (seguro para SQLite e PostgreSQL)
models.Base.metadata.create_all(bind=engine)

# 2. Migração incremental SQLite (colunas novas, categorias padrão, etc.)
run_migration()

# 3. Migração incremental PostgreSQL (colunas novas em itens_os)
_migrate_postgres()

# 4. Seed de categorias padrão para qualquer banco
_seed_categorias()

app = FastAPI(
    title="Chico Sapateiro - API",
    description="Sistema de gestão para sapataria",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ordens.router)
app.include_router(clientes.router)
app.include_router(relatorios.router)
app.include_router(categorias.router)
app.include_router(servicos.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "Chico Sapateiro"}
