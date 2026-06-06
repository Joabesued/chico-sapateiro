from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/produtos", tags=["produtos"])


@router.get("/alertas", response_model=List[schemas.ProdutoResponse])
def alertas_estoque(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    return db.query(models.Produto).filter(
        models.Produto.quantidade_estoque <= models.Produto.quantidade_minima
    ).order_by(models.Produto.nome).all()


@router.get("/vendas", response_model=List[schemas.VendaProdutoResponse])
def listar_vendas(
    os_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    query = db.query(models.VendaProduto).options(joinedload(models.VendaProduto.produto))
    if os_id is not None:
        query = query.filter(models.VendaProduto.os_id == os_id)
    vendas = query.order_by(models.VendaProduto.criado_em.desc()).all()
    return [
        schemas.VendaProdutoResponse(
            id=v.id,
            produto_id=v.produto_id,
            produto_nome=v.produto.nome,
            quantidade=v.quantidade,
            preco_unitario=v.preco_unitario,
            total=v.total,
            os_id=v.os_id,
            criado_em=v.criado_em,
        )
        for v in vendas
    ]


@router.delete("/vendas/{venda_id}", status_code=204)
def cancelar_venda(
    venda_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    venda = db.query(models.VendaProduto).options(
        joinedload(models.VendaProduto.produto)
    ).filter(models.VendaProduto.id == venda_id).first()
    if not venda:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    venda.produto.quantidade_estoque += venda.quantidade
    db.delete(venda)
    db.commit()


@router.get("/", response_model=List[schemas.ProdutoResponse])
def listar_produtos(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    return db.query(models.Produto).order_by(models.Produto.nome).all()


@router.post("/", response_model=schemas.ProdutoResponse, status_code=201)
def criar_produto(
    data: schemas.ProdutoCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    produto = models.Produto(**data.model_dump())
    db.add(produto)
    db.commit()
    db.refresh(produto)
    return produto


@router.patch("/{produto_id}", response_model=schemas.ProdutoResponse)
def editar_produto(
    produto_id: int,
    data: schemas.ProdutoUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(produto, k, v)
    db.commit()
    db.refresh(produto)
    return produto


@router.delete("/{produto_id}", status_code=204)
def deletar_produto(
    produto_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    db.delete(produto)
    db.commit()


@router.post("/{produto_id}/venda", response_model=schemas.VendaProdutoResponse, status_code=201)
def registrar_venda(
    produto_id: int,
    data: schemas.VendaProdutoCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    if produto.quantidade_estoque < data.quantidade:
        raise HTTPException(status_code=400, detail="Estoque insuficiente")

    total = round(produto.preco_venda * data.quantidade, 2)
    venda = models.VendaProduto(
        produto_id=produto_id,
        quantidade=data.quantidade,
        preco_unitario=produto.preco_venda,
        total=total,
        os_id=data.os_id,
    )
    produto.quantidade_estoque -= data.quantidade
    db.add(venda)
    db.commit()
    db.refresh(venda)

    return schemas.VendaProdutoResponse(
        id=venda.id,
        produto_id=venda.produto_id,
        produto_nome=produto.nome,
        quantidade=venda.quantidade,
        preco_unitario=venda.preco_unitario,
        total=venda.total,
        os_id=venda.os_id,
        criado_em=venda.criado_em,
    )
