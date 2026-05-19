import os
print(f"PORT recebida: {os.environ.get('PORT', 'NÃO DEFINIDA')}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
import models
from routers import auth, ordens, clientes, relatorios, categorias
from migrate import run_migration

CATEGORIAS_PADRAO = [
    "Sapato social", "Tênis", "Sapatênis", "Mocassins", "Sandália",
    "Mala", "Cinto", "Bolsa", "Capa de prancha", "Carteira",
]


def _seed_categorias():
    """Garante que as categorias padrão existam no banco — funciona em SQLite e PostgreSQL."""
    db = SessionLocal()
    try:
        for nome in CATEGORIAS_PADRAO:
            existe = db.query(models.Categoria).filter(models.Categoria.nome == nome).first()
            if not existe:
                db.add(models.Categoria(nome=nome))
        db.commit()
    except Exception as e:
        print(f"[seed_categorias] ERRO: {e}")
        db.rollback()
    finally:
        db.close()


# Cria tabelas novas automaticamente
models.Base.metadata.create_all(bind=engine)

# Migra estrutura antiga se necessário (SQLite only)
run_migration()

# Garante categorias padrão para qualquer banco (SQLite e PostgreSQL)
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


@app.get("/")
def root():
    return {"status": "ok", "app": "Chico Sapateiro"}
