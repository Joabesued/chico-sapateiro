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
    Cada ALTER TABLE é executado em transação separada para evitar
    que um erro aborte as demais migrações.
    """
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or db_url.startswith("sqlite"):
        return  # SQLite é coberto pelo migrate.py

    try:
        insp = inspect(engine)
        tabelas = {t for t in insp.get_table_names()}
        cols_it  = {c["name"] for c in insp.get_columns("itens_os")} if "itens_os" in tabelas else set()
        cols_os  = {c["name"] for c in insp.get_columns("ordens_servico")} if "ordens_servico" in tabelas else set()
        cols_cat = {c["name"] for c in insp.get_columns("categorias")} if "categorias" in tabelas else set()

        stmts = []

        # itens_os
        if "subcategoria" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS subcategoria TEXT DEFAULT ''")
        if "lado" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS lado TEXT DEFAULT ''")
        if "servicos_concluidos" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS servicos_concluidos TEXT NOT NULL DEFAULT '[]'")
        if "observacao_servico" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS observacao_servico TEXT DEFAULT ''")
        if "foto_url" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT ''")
        if "quantidade" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1")
        if "revisao" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS revisao BOOLEAN NOT NULL DEFAULT false")
        if "entregue" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS entregue BOOLEAN NOT NULL DEFAULT false")
        if "urgente" not in cols_it:
            stmts.append("ALTER TABLE itens_os ADD COLUMN IF NOT EXISTS urgente BOOLEAN NOT NULL DEFAULT false")

        # ordens_servico
        if "desconto" not in cols_os:
            stmts.append("ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS desconto FLOAT DEFAULT 0.0")
        if "urgente" not in cols_os:
            stmts.append("ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS urgente BOOLEAN NOT NULL DEFAULT false")

        # categorias — coluna tipo
        if "tipo" not in cols_cat:
            stmts.append("ALTER TABLE categorias ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'diverso'")

        # Executar cada ALTER em transação isolada para que uma falha não aborte as demais
        for sql in stmts:
            try:
                with engine.begin() as conn:
                    conn.execute(text(sql))
                print(f"[migrate_postgres] OK: {sql[:60].strip()}")
            except Exception as e:
                print(f"[migrate_postgres] SKIP ({e.__class__.__name__}): {sql[:60].strip()}")

        # Garantir tipo correto dos calçados base (idempotente)
        calcados_list = list(CALCADOS_PADRAO)
        placeholders = ", ".join(f"'{n}'" for n in calcados_list)
        with engine.begin() as conn:
            conn.execute(text(
                f"UPDATE categorias SET tipo = 'calcado' WHERE nome IN ({placeholders})"
            ))
        print("[migrate_postgres] tipos de categorias sincronizados.")

    except Exception as e:
        print(f"[migrate_postgres] ERRO: {e}")


MENSAGENS_PADRAO = [
    ("Serviço atrasado",
     "Olá [nome]! 😊 Pedimos desculpas pelo atraso no seu serviço.\n"
     "Seu pedido (#[numero]) está sendo finalizado com todo o cuidado.\n"
     "Previsão de entrega: [novo_prazo].\n"
     "Qualquer dúvida, estamos à disposição! 🥿 Chico Sapateiro"),
    ("Serviço em andamento",
     "Olá [nome]! Seu serviço (#[numero]) está em fase de conclusão hoje.\n"
     "Em breve ficará pronto e disponível para retirada.\n"
     "Assim que finalizar, entraremos em contato! 😊\n"
     "Para mais informações, nos envie uma mensagem. 🥿 Chico Sapateiro"),
    ("Serviço pronto para retirada",
     "Olá [nome]! 🎉 Seu serviço (#[numero]) está pronto para retirada!\n"
     "Estamos aguardando você na loja.\n"
     "Rua Afonso Celso, 225 — Loja 7, Barra.\n"
     "Horário: seg a sáb. 🥿 Chico Sapateiro"),
    ("Lembrete de retirada",
     "Olá [nome]! Passando para lembrar que seu serviço (#[numero])\n"
     "já está pronto há alguns dias e aguarda sua retirada. 😊\n"
     "Rua Afonso Celso, 225 — Loja 7, Barra. 🥿 Chico Sapateiro"),
]


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


def _seed_mensagens():
    """Garante que as mensagens padrão existam — funciona em SQLite e PostgreSQL."""
    db = SessionLocal()
    try:
        qtd = db.query(models.MensagemPronta).count()
        if qtd == 0:
            for nome, corpo in MENSAGENS_PADRAO:
                db.add(models.MensagemPronta(nome=nome, corpo=corpo))
            db.commit()
            print(f"[seed_mensagens] {len(MENSAGENS_PADRAO)} mensagens padrão inseridas.")
        else:
            print(f"[seed_mensagens] {qtd} mensagens já existem, seed ignorado.")
    except Exception as e:
        print(f"[seed_mensagens] ERRO: {e}")
        db.rollback()
    finally:
        db.close()


# ── Inicialização ──────────────────────────────────────────────────────────────

# 1. Cria tabelas que ainda não existem (seguro para SQLite e PostgreSQL)
try:
    models.Base.metadata.create_all(bind=engine)
    print("[create_all] Tabelas verificadas.")
except Exception as e:
    print(f"[create_all] ERRO: {e}")

# 2. Migração incremental SQLite (colunas novas, categorias padrão, etc.)
try:
    run_migration()
except Exception as e:
    print(f"[run_migration] ERRO: {e}")

# 3. Migração incremental PostgreSQL (colunas novas em itens_os)
_migrate_postgres()

# 4. Seed de categorias padrão para qualquer banco
_seed_categorias()

# 5. Seed de mensagens padrão para qualquer banco
_seed_mensagens()

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
