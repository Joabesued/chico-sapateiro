from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/servicos", tags=["servicos"])


@router.get("/", response_model=List[schemas.ServicoCustomResponse])
def listar_servicos_custom(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    return db.query(models.ServicoCustom).order_by(models.ServicoCustom.nome).all()


@router.post("/", response_model=schemas.ServicoCustomResponse)
def criar_servico_custom(
    dados: schemas.ServicoCustomCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    nome = dados.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome não pode ser vazio.")
    existente = db.query(models.ServicoCustom).filter(
        models.ServicoCustom.nome == nome
    ).first()
    if existente:
        return existente
    sc = models.ServicoCustom(nome=nome)
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc


@router.delete("/{servico_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_servico_custom(
    servico_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    sc = db.query(models.ServicoCustom).filter(models.ServicoCustom.id == servico_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    db.delete(sc)
    db.commit()
