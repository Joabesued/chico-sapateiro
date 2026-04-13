from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth as auth_utils
from datetime import timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/ping")
def ping():
    return {"status": "ok"}


@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(
        models.Usuario.username == request.username
    ).first()

    if not usuario or not auth_utils.verificar_senha(request.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos"
        )

    token = auth_utils.criar_token(
        data={"sub": usuario.username},
        expires_delta=timedelta(hours=12)
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "nome_usuario": usuario.nome
    }
