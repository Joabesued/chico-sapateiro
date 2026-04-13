from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


@router.get("/", response_model=List[schemas.CategoriaResponse])
def listar_categorias(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    return db.query(models.Categoria).order_by(models.Categoria.nome).all()


@router.post("/", response_model=schemas.CategoriaResponse, status_code=201)
def criar_categoria(
    dados: schemas.CategoriaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    nome = dados.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome não pode ser vazio.")
    existente = db.query(models.Categoria).filter(
        models.Categoria.nome == nome
    ).first()
    if existente:
        raise HTTPException(status_code=409, detail="Categoria já existe.")
    cat = models.Categoria(nome=nome)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
