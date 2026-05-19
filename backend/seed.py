"""
Cria o banco de dados, usuário padrão e categorias iniciais.
Execute: python seed.py
"""
from database import engine, SessionLocal
import models
import auth as auth_utils

CATEGORIAS_PADRAO = [
    "Sapato social", "Tênis", "Sapatênis", "Mocassins", "Sandália",
    "Mala", "Cinto", "Bolsa", "Capa de prancha", "Carteira",
]

def init():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existe = db.query(models.Usuario).filter(
            models.Usuario.username == "chico"
        ).first()
        if not existe:
            admin = models.Usuario(
                username="chico",
                password_hash=auth_utils.gerar_hash_senha("sapateiro123"),
                nome="Chico Sapateiro",
            )
            db.add(admin)
            db.commit()
            print("Banco criado. Usuário padrão: chico / sapateiro123")
        else:
            print("Banco já inicializado.")

        for nome in CATEGORIAS_PADRAO:
            existe_cat = db.query(models.Categoria).filter(
                models.Categoria.nome == nome
            ).first()
            if not existe_cat:
                db.add(models.Categoria(nome=nome))
        db.commit()
        print("Categorias padrão verificadas.")
    finally:
        db.close()

if __name__ == "__main__":
    init()
