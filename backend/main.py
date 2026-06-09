import os
print(f"PORT recebida: {os.environ.get('PORT', 'NÃO DEFINIDA')}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from database import engine, SessionLocal
import models
from routers import auth, ordens, clientes, relatorios, categorias, servicos, produtos, mensagens
from migrate import run_migration

CATEGORIAS_PADRAO = [
    "Sapato social", "Tênis", "Sapatênis", "Mocassins", "Sandália",
    "Mala", "Cinto", "Bolsa", "Capa de prancha", "Carteira",
]

CALCADOS_PADRAO = {
    "Sapato social", "Tênis", "Sapatênis", "Mocassins", "Sandália",
}


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
        cols_cat = {c["name"] for c in insp.get_columns("categorias")}

        novos = []

        # itens_os
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

        # ordens_servico
        if "desconto" not in cols_os:
            novos.append("ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS desconto FLOAT DEFAULT 0.0")

        # categorias — coluna tipo (causa dos erros de CORS no Railway)
        if "tipo" not in cols_cat:
            novos.append("ALTER TABLE categorias ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'diverso'")

        # urgente em ordens_servico e itens_os
        if "urgente" not in cols_os:
            novos.append("ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS urgente BOOLEAN NOT NULL DEFAULT false")
        if "urgente" not in cols_it:
            novos.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS urgente BOOLEAN NOT NULL DEFAULT false")

        # tabela mensagens_prontas (PostgreSQL)
        novos.append("""
            CREATE TABLE IF NOT EXISTS mensagens_prontas (
                id            SERIAL PRIMARY KEY,
                nome          TEXT NOT NULL,
                corpo         TEXT NOT NULL,
                criado_em     TIMESTAMPTZ DEFAULT NOW(),
                atualizado_em TIMESTAMPTZ
            )
        """)

        if novos:
            with engine.connect() as conn:
                for sql in novos:
                    conn.execute(text(sql))
                conn.commit()
            print(f"[migrate_postgres] {len(novos)} coluna(s) adicionada(s).")

        # Garantir tipo correto dos calçados base (idempotente)
        calcados_list = list(CALCADOS_PADRAO)
        placeholders = ", ".join(f"'{n}'" for n in calcados_list)
        with engine.connect() as conn:
            conn.execute(text(
                f"UPDATE categorias SET tipo = 'calcado' WHERE nome IN ({placeholders})"
            ))
            conn.commit()
        print("[migrate_postgres] tipos de categorias sincronizados.")

    except Exception as e:
        print(f"[migrate_postgres] ERRO: {e}")


def _seed_categorias():
    """Garante que as categorias padrão existam no banco — funciona em SQLite e PostgreSQL."""
    db = SessionLocal()
    try:
        for nome in CATEGORIAS_PADRAO:
            tipo = "calcado" if nome in CALCADOS_PADRAO else "diverso"
            existe = db.query(models.Categoria).filter(models.Categoria.nome == nome).first()
            if not existe:
                db.add(models.Categoria(nome=nome, tipo=tipo))
            elif existe.tipo != tipo:
                existe.tipo = tipo
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
app.include_router(produtos.router)
app.include_router(mensagens.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "Chico Sapateiro"}


@app.get("/api/cors-test")
def cors_test():
    return {"cors": "ok"}
