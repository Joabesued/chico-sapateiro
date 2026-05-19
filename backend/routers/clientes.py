from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


@router.post("/", response_model=schemas.ClienteResponse, status_code=201)
def criar_cliente(
    dados: schemas.ClienteCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    nome = dados.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome não pode ser vazio.")
    cliente = models.Cliente(nome=nome, telefone=dados.telefone)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/", response_model=List[schemas.ClienteComOS])
def listar_clientes(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    clientes = db.query(models.Cliente).options(
        joinedload(models.Cliente.ordens)
    ).order_by(models.Cliente.nome).all()

    resultado = []
    for c in clientes:
        total = len(c.ordens)
        ultima = max((o.criado_em for o in c.ordens), default=None)
        resultado.append(schemas.ClienteComOS(
            id=c.id,
            nome=c.nome,
            telefone=c.telefone,
            criado_em=c.criado_em,
            total_os=total,
            ultima_os=ultima,
        ))
    return resultado


@router.get("/{cliente_id}/ordens", response_model=List[schemas.OSResponse])
def ordens_do_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    return db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.cliente),
        joinedload(models.OrdemServico.itens),
    ).filter(
        models.OrdemServico.cliente_id == cliente_id
    ).order_by(models.OrdemServico.id.desc()).all()


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    tem_os = db.query(models.OrdemServico).filter(
        models.OrdemServico.cliente_id == cliente_id
    ).first()
    if tem_os:
        raise HTTPException(status_code=409, detail="Não é possível remover cliente com ordens de serviço vinculadas.")
    db.delete(cliente)
    db.commit()


@router.patch("/{cliente_id}", response_model=schemas.ClienteResponse)
def atualizar_cliente(
    cliente_id: int,
    dados: schemas.ClienteBase,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    cliente = db.query(models.Cliente).filter(
        models.Cliente.id == cliente_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    cliente.nome = dados.nome
    cliente.telefone = dados.telefone
    db.commit()
    db.refresh(cliente)
    return cliente
