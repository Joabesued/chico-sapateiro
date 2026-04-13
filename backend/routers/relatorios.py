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
