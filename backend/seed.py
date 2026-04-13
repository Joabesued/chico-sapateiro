"""
Cria o banco de dados e o usuário padrão admin.
Execute: python seed.py
"""
from database import engine, SessionLocal
import models
import auth as auth_utils

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
            print("✅ Banco criado. Usuário padrão: chico / sapateiro123")
        else:
            print("ℹ️  Banco já inicializado.")
    finally:
        db.close()

if __name__ == "__main__":
    init()
