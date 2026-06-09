from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/mensagens", tags=["mensagens"])


@router.get("/", response_model=List[schemas.MensagemProntaResponse])
def listar_mensagens(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    return db.query(models.MensagemPronta).order_by(models.MensagemPronta.id).all()


@router.post("/", response_model=schemas.MensagemProntaResponse, status_code=201)
def criar_mensagem(
    dados: schemas.MensagemProntaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    msg = models.MensagemPronta(nome=dados.nome.strip(), corpo=dados.corpo.strip())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.patch("/{msg_id}", response_model=schemas.MensagemProntaResponse)
def atualizar_mensagem(
    msg_id: int,
    dados: schemas.MensagemProntaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    msg = db.query(models.MensagemPronta).filter(models.MensagemPronta.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    if dados.nome is not None:
        msg.nome = dados.nome.strip()
    if dados.corpo is not None:
        msg.corpo = dados.corpo.strip()
    db.commit()
    db.refresh(msg)
    return msg


@router.delete("/{msg_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_mensagem(
    msg_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    msg = db.query(models.MensagemPronta).filter(models.MensagemPronta.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    db.delete(msg)
    db.commit()
