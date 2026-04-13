from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import auth, ordens, clientes, relatorios, categorias
from migrate import run_migration

# Cria tabelas novas automaticamente
models.Base.metadata.create_all(bind=engine)

# Migra estrutura antiga se necessário
run_migration()

app = FastAPI(
    title="Chico Sapateiro - API",
    description="Sistema de gestão para sapataria",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
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
