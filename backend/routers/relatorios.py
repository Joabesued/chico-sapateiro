import json
import calendar
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/relatorios", tags=["relatorios"])


@router.get("/dashboard", response_model=schemas.DashboardResumo)
def dashboard_resumo(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    hoje = datetime.now(timezone.utc)
    inicio_hoje = hoje.replace(hour=0, minute=0, second=0, microsecond=0)
    fim_hoje = hoje.replace(hour=23, minute=59, second=59, microsecond=999999)

    _, ultimo_dia = calendar.monthrange(hoje.year, hoje.month)
    inicio_mes = datetime(hoje.year, hoje.month, 1, tzinfo=timezone.utc)
    fim_mes = datetime(hoje.year, hoje.month, ultimo_dia, 23, 59, 59, 999999, tzinfo=timezone.utc)

    os_hoje = db.query(models.OrdemServico).filter(
        models.OrdemServico.criado_em.between(inicio_hoje, fim_hoje)
    ).count()

    ordens_mes = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens)
    ).filter(
        (models.OrdemServico.criado_em == None) |  # noqa: E711
        (models.OrdemServico.criado_em.between(inicio_mes, fim_mes))
    ).all()

    faturado_mes = sum(sum(i.valor for i in o.itens) for o in ordens_mes)
    recebido_mes = sum(o.entrada or 0.0 for o in ordens_mes)

    todas = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens)
    ).all()
    pendente_total = sum(
        max(0.0, sum(i.valor for i in o.itens) - (o.entrada or 0.0))
        for o in todas
    )

    hoje_str = hoje.date().isoformat()
    em_atraso = db.query(models.OrdemServico).filter(
        models.OrdemServico.prazo_entrega < hoje_str,
        models.OrdemServico.status != models.StatusOS.entregue,
    ).count()

    return schemas.DashboardResumo(
        os_abertas_hoje=os_hoje,
        faturado_mes=round(faturado_mes, 2),
        recebido_mes=round(recebido_mes, 2),
        pendente_total=round(pendente_total, 2),
        os_em_atraso=em_atraso,
    )


@router.get("/ranking", response_model=schemas.RankingResumo)
def ranking_servicos(
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    query = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens),
    )
    if ano and mes:
        _, ultimo_dia = calendar.monthrange(ano, mes)
        inicio = datetime(ano, mes, 1, 0, 0, 0, tzinfo=timezone.utc)
        fim = datetime(ano, mes, ultimo_dia, 23, 59, 59, 999999, tzinfo=timezone.utc)
        query = query.filter(
            (models.OrdemServico.criado_em == None) |  # noqa: E711
            (models.OrdemServico.criado_em.between(inicio, fim))
        )
    elif ano:
        inicio = datetime(ano, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        fim = datetime(ano, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc)
        query = query.filter(
            (models.OrdemServico.criado_em == None) |  # noqa: E711
            (models.OrdemServico.criado_em.between(inicio, fim))
        )

    ordens = query.all()
    servico_qtd: dict = {}
    servico_val: dict = {}

    for ordem in ordens:
        for item in ordem.itens:
            try:
                servicos = json.loads(item.servicos) if isinstance(item.servicos, str) else (item.servicos or [])
            except Exception:
                servicos = []
            for s in servicos:
                servico_qtd[s] = servico_qtd.get(s, 0) + 1
                servico_val[s] = servico_val.get(s, 0.0) + item.valor

    ranking_quantidade = sorted(
        [schemas.RankingItem(servico=k, quantidade=v, total=round(servico_val.get(k, 0), 2))
         for k, v in servico_qtd.items()],
        key=lambda x: x.quantidade, reverse=True
    )[:10]

    ranking_valor = sorted(
        [schemas.RankingItem(servico=k, quantidade=servico_qtd.get(k, 0), total=round(v, 2))
         for k, v in servico_val.items()],
        key=lambda x: x.total, reverse=True
    )[:10]

    return schemas.RankingResumo(
        ranking_quantidade=ranking_quantidade,
        ranking_valor=ranking_valor,
    )


@router.get("/resumo", response_model=schemas.RelatorioResumo)
def resumo_financeiro(
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    query = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens),
        joinedload(models.OrdemServico.cliente),
    )

    # Filtro por intervalo de datas — robusto com SQLite
    # Quando mes/ano não informados (modo Geral), retorna todas as OS
    if ano and mes:
        _, ultimo_dia = calendar.monthrange(ano, mes)
        inicio = datetime(ano, mes, 1, 0, 0, 0, tzinfo=timezone.utc)
        fim    = datetime(ano, mes, ultimo_dia, 23, 59, 59, 999999, tzinfo=timezone.utc)
        # Inclui também OS com criado_em NULL (não perder dados com datas corrompidas)
        query = query.filter(
            (models.OrdemServico.criado_em == None) |  # noqa: E711
            (models.OrdemServico.criado_em.between(inicio, fim))
        )
    elif ano:
        inicio = datetime(ano, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        fim    = datetime(ano, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc)
        query = query.filter(
            (models.OrdemServico.criado_em == None) |  # noqa: E711
            (models.OrdemServico.criado_em.between(inicio, fim))
        )

    ordens = query.all()

    total_os = len(ordens)
    total_faturado = 0.0
    total_recebido = 0.0
    total_pendente = 0.0
    os_por_status: dict = {}
    os_por_pagamento: dict = {}
    os_pendentes: list = []

    for o in ordens:
        total_itens = round(sum(i.valor for i in o.itens), 2)
        entrada = o.entrada or 0.0
        resta = round(max(0.0, total_itens - entrada), 2)

        total_faturado += total_itens
        total_recebido += entrada
        if resta > 0:
            total_pendente += resta

        os_por_status[o.status] = os_por_status.get(o.status, 0) + 1
        os_por_pagamento[o.status_pagamento] = os_por_pagamento.get(o.status_pagamento, 0) + 1

        if resta > 0:
            os_pendentes.append(schemas.OSPendente(
                numero=o.numero,
                cliente_nome=o.cliente.nome if o.cliente else "—",
                total=total_itens,
                entrada=entrada,
                resta=resta,
            ))

    os_pendentes.sort(key=lambda x: x.resta, reverse=True)

    return schemas.RelatorioResumo(
        total_os=total_os,
        total_faturado=round(total_faturado, 2),
        total_recebido=round(total_recebido, 2),
        total_pendente=round(total_pendente, 2),
        os_por_status=os_por_status,
        os_por_pagamento=os_por_pagamento,
        os_pendentes=os_pendentes,
    )
