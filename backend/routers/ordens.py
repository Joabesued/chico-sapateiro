import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/ordens", tags=["ordens"])


def _proximo_numero(db: Session) -> int:
    max_num = db.query(func.max(models.OrdemServico.numero)).scalar()
    return (max_num or 0) + 1


def _buscar_ou_criar_cliente(db: Session, nome: str, telefone: Optional[str]) -> models.Cliente:
    cliente = db.query(models.Cliente).filter(
        func.lower(models.Cliente.nome) == func.lower(nome)
    ).first()
    if not cliente:
        cliente = models.Cliente(nome=nome, telefone=telefone)
        db.add(cliente)
        db.flush()
    elif telefone and not cliente.telefone:
        cliente.telefone = telefone
    return cliente


def _calcular_status_pagamento(total: float, entrada: float) -> str:
    if entrada <= 0:
        return models.StatusPagamento.nao_pago
    if entrada >= total:
        return models.StatusPagamento.pago_total
    return models.StatusPagamento.pago_parcial


def _carregar_ordem(db: Session, os_id: int) -> models.OrdemServico:
    return db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.cliente),
        joinedload(models.OrdemServico.itens),
    ).filter(models.OrdemServico.id == os_id).first()


def _item_para_model(item: schemas.ItemOSCreate, ordem_id: int) -> models.ItemOS:
    concluidos = item.servicos_concluidos or []
    # Mantém apenas serviços concluídos que ainda existem na lista de serviços do item.
    concluidos = [s for s in concluidos if s in item.servicos]
    revisao = item.revisao or False
    return models.ItemOS(
        ordem_id=ordem_id,
        categoria=item.categoria,
        subcategoria=item.subcategoria or "",
        lado=item.lado or "",
        servicos=json.dumps(item.servicos, ensure_ascii=False),
        servicos_concluidos=json.dumps(concluidos, ensure_ascii=False),
        observacao_servico=item.observacao_servico or "",
        cor=item.cor or "",
        descricao=item.descricao or "",
        qtd_rodas=item.qtd_rodas,
        valor=0.0 if revisao else item.valor,
        foto_url=item.foto_url or "",
        quantidade=max(1, item.quantidade or 1),
        revisao=revisao,
    )


@router.get("/", response_model=List[schemas.OSResponse])
def listar_ordens(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    query = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.cliente),
        joinedload(models.OrdemServico.itens),
    )
    if status:
        query = query.filter(models.OrdemServico.status == status)
    return query.order_by(models.OrdemServico.id.desc()).all()


@router.get("/{os_id}", response_model=schemas.OSResponse)
def buscar_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    ordem = _carregar_ordem(db, os_id)
    if not ordem:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    return ordem


@router.post("/", response_model=schemas.OSResponse, status_code=status.HTTP_201_CREATED)
def criar_ordem(
    dados: schemas.OSCreate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    if not dados.itens:
        raise HTTPException(status_code=400, detail="A OS deve ter pelo menos um item.")

    cliente = _buscar_ou_criar_cliente(db, dados.cliente_nome, dados.cliente_telefone)

    total = sum(i.valor for i in dados.itens)
    desconto = dados.desconto or 0.0
    total_liquido = max(0.0, total - desconto)
    status_pag = _calcular_status_pagamento(total_liquido, dados.entrada)

    ordem = models.OrdemServico(
        numero=_proximo_numero(db),
        cliente_id=cliente.id,
        prazo_entrega=dados.prazo_entrega,
        entrada=dados.entrada,
        desconto=desconto,
        status_pagamento=status_pag,
        status=models.StatusOS.em_andamento,
    )
    db.add(ordem)
    db.flush()

    for item in dados.itens:
        db.add(_item_para_model(item, ordem.id))

    db.commit()
    return _carregar_ordem(db, ordem.id)


@router.patch("/{os_id}", response_model=schemas.OSResponse)
def atualizar_ordem(
    os_id: int,
    dados: schemas.OSUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    ordem = db.query(models.OrdemServico).filter(
        models.OrdemServico.id == os_id
    ).first()
    if not ordem:
        raise HTTPException(status_code=404, detail="OS não encontrada")

    if dados.prazo_entrega is not None:
        ordem.prazo_entrega = dados.prazo_entrega
    if dados.status is not None:
        ordem.status = dados.status
    if dados.entrada is not None:
        ordem.entrada = dados.entrada
    if dados.desconto is not None:
        ordem.desconto = dados.desconto

    if dados.itens is not None:
        if not dados.itens:
            raise HTTPException(status_code=400, detail="A OS deve ter pelo menos um item.")
        db.query(models.ItemOS).filter(models.ItemOS.ordem_id == os_id).delete()
        for item in dados.itens:
            db.add(_item_para_model(item, ordem.id))
        db.flush()

    itens = db.query(models.ItemOS).filter(models.ItemOS.ordem_id == os_id).all()
    total = sum(i.valor for i in itens)
    desconto = ordem.desconto or 0.0
    total_liquido = max(0.0, total - desconto)
    ordem.status_pagamento = _calcular_status_pagamento(total_liquido, ordem.entrada)

    db.commit()
    return _carregar_ordem(db, os_id)


def _todos_servicos_concluidos(itens: List[models.ItemOS]) -> bool:
    """True se todos os itens têm pelo menos um serviço e todos estão concluídos."""
    if not itens:
        return False
    total_servicos = 0
    for it in itens:
        try:
            servicos = json.loads(it.servicos or "[]")
            concluidos = json.loads(it.servicos_concluidos or "[]")
        except Exception:
            return False
        if not servicos:
            return False
        total_servicos += len(servicos)
        if any(s not in concluidos for s in servicos):
            return False
    return total_servicos > 0


@router.patch("/{os_id}/itens/{item_id}/checklist", response_model=schemas.OSResponse)
def atualizar_checklist_item(
    os_id: int,
    item_id: int,
    dados: schemas.ChecklistUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    item = db.query(models.ItemOS).filter(
        models.ItemOS.id == item_id,
        models.ItemOS.ordem_id == os_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    try:
        servicos = json.loads(item.servicos or "[]")
    except Exception:
        servicos = []
    concluidos = [s for s in dados.servicos_concluidos if s in servicos]
    item.servicos_concluidos = json.dumps(concluidos, ensure_ascii=False)
    db.flush()

    # Auto-promove status para "Pronto para retirada" quando todos os serviços
    # de todos os itens estiverem concluídos. Só altera se ainda estiver "Em andamento"
    # (não rebaixa "Entregue" nem mexe em status manuais).
    ordem = db.query(models.OrdemServico).filter(models.OrdemServico.id == os_id).first()
    if ordem and ordem.status == models.StatusOS.em_andamento:
        itens = db.query(models.ItemOS).filter(models.ItemOS.ordem_id == os_id).all()
        if _todos_servicos_concluidos(itens):
            ordem.status = models.StatusOS.pronto

    db.commit()
    return _carregar_ordem(db, os_id)


@router.delete("/{os_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_ordem(
    os_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    ordem = db.query(models.OrdemServico).filter(
        models.OrdemServico.id == os_id
    ).first()
    if not ordem:
        raise HTTPException(status_code=404, detail="OS não encontrada")
    db.delete(ordem)
    db.commit()
