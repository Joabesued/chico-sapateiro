import json
import calendar
from datetime import datetime, date as date_type, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
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

    faturado_mes = sum(
        max(0.0, sum(i.valor * (i.quantidade or 1) for i in o.itens) - (o.desconto or 0.0))
        for o in ordens_mes
    )
    recebido_mes = sum(o.entrada or 0.0 for o in ordens_mes)

    todas = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens)
    ).all()
    pendente_total = sum(
        max(0.0, max(0.0, sum(i.valor * (i.quantidade or 1) for i in o.itens) - (o.desconto or 0.0)) - (o.entrada or 0.0))
        for o in todas
    )

    hoje_str = hoje.date().isoformat()
    amanha_str = (hoje.date() + timedelta(days=1)).isoformat()
    semana_str = (hoje.date() + timedelta(days=7)).isoformat()

    em_atraso = db.query(models.OrdemServico).filter(
        models.OrdemServico.prazo_entrega < hoje_str,
        models.OrdemServico.status != models.StatusOS.entregue,
    ).count()

    os_prazo_hoje = db.query(models.OrdemServico).filter(
        models.OrdemServico.prazo_entrega.like(f"{hoje_str}%"),
        models.OrdemServico.status != models.StatusOS.entregue,
    ).count()

    os_prazo_amanha = db.query(models.OrdemServico).filter(
        models.OrdemServico.prazo_entrega.like(f"{amanha_str}%"),
        models.OrdemServico.status != models.StatusOS.entregue,
    ).count()

    os_prazo_semana = db.query(models.OrdemServico).filter(
        models.OrdemServico.prazo_entrega > hoje_str,
        models.OrdemServico.prazo_entrega <= semana_str,
        models.OrdemServico.status != models.StatusOS.entregue,
    ).count()

    return schemas.DashboardResumo(
        os_abertas_hoje=os_hoje,
        faturado_mes=round(faturado_mes, 2),
        recebido_mes=round(recebido_mes, 2),
        pendente_total=round(pendente_total, 2),
        os_em_atraso=em_atraso,
        os_prazo_hoje=os_prazo_hoje,
        os_prazo_amanha=os_prazo_amanha,
        os_prazo_semana=os_prazo_semana,
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
            qtd = item.quantidade or 1
            for s in servicos:
                servico_qtd[s] = servico_qtd.get(s, 0) + qtd
                servico_val[s] = servico_val.get(s, 0.0) + item.valor * qtd

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
        total_itens = round(sum(i.valor * (i.quantidade or 1) for i in o.itens), 2)
        desconto = o.desconto or 0.0
        total_liquido = round(max(0.0, total_itens - desconto), 2)
        entrada = o.entrada or 0.0
        resta = round(max(0.0, total_liquido - entrada), 2)

        total_faturado += total_liquido
        total_recebido += entrada
        if resta > 0:
            total_pendente += resta

        os_por_status[o.status] = os_por_status.get(o.status, 0) + 1
        os_por_pagamento[o.status_pagamento] = os_por_pagamento.get(o.status_pagamento, 0) + 1

        if resta > 0:
            os_pendentes.append(schemas.OSPendente(
                numero=o.numero,
                cliente_nome=o.cliente.nome if o.cliente else "—",
                total=total_liquido,
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


@router.get("/diario", response_model=schemas.RelatorioDiario)
def relatorio_diario(
    data: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    if data:
        try:
            d = datetime.strptime(data, "%Y-%m-%d").date()
        except ValueError:
            d = datetime.now(timezone.utc).date()
    else:
        d = datetime.now(timezone.utc).date()

    inicio = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
    fim = datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=timezone.utc)

    ordens_hoje = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens),
        joinedload(models.OrdemServico.cliente),
    ).filter(
        models.OrdemServico.criado_em.between(inicio, fim)
    ).order_by(models.OrdemServico.numero).all()

    os_finalizadas = db.query(models.OrdemServico).filter(
        models.OrdemServico.status == models.StatusOS.entregue,
        models.OrdemServico.atualizado_em.between(inicio, fim)
    ).count()

    total_faturado = 0.0
    total_recebido = 0.0
    resumos = []

    for o in ordens_hoje:
        total_itens = round(sum(i.valor * (i.quantidade or 1) for i in o.itens), 2)
        desconto = o.desconto or 0.0
        total_liquido = round(max(0.0, total_itens - desconto), 2)
        entrada = o.entrada or 0.0
        resta = round(max(0.0, total_liquido - entrada), 2)

        total_faturado += total_liquido
        total_recebido += entrada

        resumos.append(schemas.OSResumoDiario(
            numero=o.numero,
            cliente_nome=o.cliente.nome if o.cliente else "—",
            total=total_liquido,
            entrada=entrada,
            resta=resta,
            status_pagamento=o.status_pagamento,
            status=o.status,
            qtd_itens=len(o.itens),
        ))

    return schemas.RelatorioDiario(
        data=d.isoformat(),
        os_abertas=len(ordens_hoje),
        os_finalizadas=os_finalizadas,
        total_faturado=round(total_faturado, 2),
        total_recebido=round(total_recebido, 2),
        ordens=resumos,
    )


@router.get("/categorias", response_model=schemas.RankingCategorias)
def ranking_categorias(
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
    cat_count: dict = {}

    for ordem in ordens:
        for item in ordem.itens:
            if item.categoria:
                cat_count[item.categoria] = cat_count.get(item.categoria, 0) + (item.quantidade or 1)

    ranking = sorted(
        [schemas.RankingCategoria(categoria=k, quantidade=v) for k, v in cat_count.items()],
        key=lambda x: x.quantidade, reverse=True
    )

    return schemas.RankingCategorias(ranking=ranking)


@router.get("/dicas", response_model=List[str])
def dicas_gestao(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    dicas = []
    hoje = datetime.now(timezone.utc)
    amanha_str = (hoje.date() + timedelta(days=1)).isoformat()

    # OS sem entrega há mais de 7 dias
    limite_7d = hoje - timedelta(days=7)
    os_paradas = db.query(models.OrdemServico).filter(
        models.OrdemServico.status != models.StatusOS.entregue,
        models.OrdemServico.criado_em < limite_7d,
    ).count()
    if os_paradas > 0:
        s = 's' if os_paradas != 1 else ''
        dicas.append(f"Você tem {os_paradas} nota{s} com mais de 7 dias sem entrega.")

    # Serviço mais realizado no mês
    inicio_mes = datetime(hoje.year, hoje.month, 1, tzinfo=timezone.utc)
    ordens_mes = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens)
    ).filter(
        (models.OrdemServico.criado_em == None) |  # noqa: E711
        (models.OrdemServico.criado_em >= inicio_mes)
    ).all()

    servico_qtd: dict = {}
    for o in ordens_mes:
        for item in o.itens:
            try:
                servicos = json.loads(item.servicos or "[]")
            except Exception:
                servicos = []
            for sv in servicos:
                servico_qtd[sv] = servico_qtd.get(sv, 0) + (item.quantidade or 1)

    if servico_qtd:
        top = max(servico_qtd, key=servico_qtd.get)
        dicas.append(f"O serviço mais realizado este mês foi '{top}' ({servico_qtd[top]}x).")

    # Clientes com pagamento pendente há mais de 5 dias
    limite_5d = hoje - timedelta(days=5)
    os_pendentes = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens)
    ).filter(
        models.OrdemServico.status_pagamento != models.StatusPagamento.pago_total,
        models.OrdemServico.criado_em < limite_5d,
    ).all()

    clientes_pendentes: set = set()
    for o in os_pendentes:
        total_liq = max(0.0, sum(i.valor * (i.quantidade or 1) for i in o.itens) - (o.desconto or 0))
        resta = max(0.0, total_liq - (o.entrada or 0))
        if resta > 0.01:
            clientes_pendentes.add(o.cliente_id)

    if clientes_pendentes:
        n = len(clientes_pendentes)
        s = 's têm' if n != 1 else ' tem'
        dicas.append(f"{n} cliente{s} pagamento pendente há mais de 5 dias.")

    # Clientes com prazo vencendo amanhã
    vencendo = db.query(models.OrdemServico).filter(
        models.OrdemServico.prazo_entrega.like(f"{amanha_str}%"),
        models.OrdemServico.status != models.StatusOS.entregue,
    ).count()
    if vencendo > 0:
        s = 's' if vencendo != 1 else ''
        dicas.append(f"Considere contatar {vencendo} cliente{s} com prazo vencendo amanhã.")

    return dicas


@router.get("/produtividade", response_model=schemas.ProdutividadeResumo)
def produtividade(
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    hoje = datetime.now(timezone.utc).date()

    todas = db.query(models.OrdemServico).all()

    historico_vazio = [
        schemas.HistoricoDia(data=(hoje - timedelta(days=i)).isoformat(), qtd=0)
        for i in range(13, -1, -1)
    ]

    if not todas:
        return schemas.ProdutividadeResumo(
            media_notas_dia=0.0,
            dias_em_operacao=0,
            dia_mais_produtivo=None,
            dia_mais_produtivo_qtd=0,
            tendencia_semana=0.0,
            os_semana_atual=0,
            os_semana_passada=0,
            historico_14dias=historico_vazio,
        )

    datas_criacao = [o.criado_em for o in todas if o.criado_em]
    contagem_por_dia: dict = {}
    for criado in datas_criacao:
        dia = criado.date().isoformat()
        contagem_por_dia[dia] = contagem_por_dia.get(dia, 0) + 1

    primeira_data = min(c.date() for c in datas_criacao) if datas_criacao else hoje
    dias_em_operacao = (hoje - primeira_data).days + 1

    dias_com_os = len(contagem_por_dia)
    media = len(todas) / dias_com_os if dias_com_os > 0 else 0.0

    dia_top = max(contagem_por_dia, key=contagem_por_dia.get) if contagem_por_dia else None
    dia_top_qtd = contagem_por_dia.get(dia_top, 0) if dia_top else 0

    os_semana_atual = sum(
        contagem_por_dia.get((hoje - timedelta(days=i)).isoformat(), 0)
        for i in range(7)
    )
    os_semana_passada = sum(
        contagem_por_dia.get((hoje - timedelta(days=i)).isoformat(), 0)
        for i in range(7, 14)
    )

    if os_semana_passada > 0:
        tendencia = ((os_semana_atual - os_semana_passada) / os_semana_passada) * 100
    elif os_semana_atual > 0:
        tendencia = 100.0
    else:
        tendencia = 0.0

    historico = [
        schemas.HistoricoDia(
            data=(hoje - timedelta(days=i)).isoformat(),
            qtd=contagem_por_dia.get((hoje - timedelta(days=i)).isoformat(), 0),
        )
        for i in range(13, -1, -1)
    ]

    return schemas.ProdutividadeResumo(
        media_notas_dia=round(media, 1),
        dias_em_operacao=dias_em_operacao,
        dia_mais_produtivo=dia_top,
        dia_mais_produtivo_qtd=dia_top_qtd,
        tendencia_semana=round(tendencia, 1),
        os_semana_atual=os_semana_atual,
        os_semana_passada=os_semana_passada,
        historico_14dias=historico,
    )


@router.get("/produtos", response_model=schemas.RelatorioProdutos)
def relatorio_produtos(
    mes: Optional[int] = Query(None, ge=1, le=12),
    ano: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    hoje = datetime.now(timezone.utc)
    mes_real = mes or hoje.month
    ano_real = ano or hoje.year

    _, ultimo_dia = calendar.monthrange(ano_real, mes_real)
    inicio = datetime(ano_real, mes_real, 1, 0, 0, 0, tzinfo=timezone.utc)
    fim = datetime(ano_real, mes_real, ultimo_dia, 23, 59, 59, 999999, tzinfo=timezone.utc)

    vendas = db.query(models.VendaProduto).options(
        joinedload(models.VendaProduto.produto)
    ).filter(
        models.VendaProduto.criado_em.between(inicio, fim)
    ).all()

    total_vendido = sum(v.quantidade for v in vendas)
    receita_bruta = sum(v.total for v in vendas)
    receita_liquida = sum(
        v.total - (v.produto.preco_custo * v.quantidade)
        for v in vendas
    )
    margem_media = round((receita_liquida / receita_bruta) * 100, 1) if receita_bruta > 0 else 0.0

    produtos_dict: dict = {}
    for v in vendas:
        pid = v.produto_id
        if pid not in produtos_dict:
            produtos_dict[pid] = {
                "produto_id": pid,
                "produto_nome": v.produto.nome,
                "quantidade_vendida": 0,
                "receita_bruta": 0.0,
                "receita_liquida": 0.0,
            }
        produtos_dict[pid]["quantidade_vendida"] += v.quantidade
        produtos_dict[pid]["receita_bruta"] += v.total
        produtos_dict[pid]["receita_liquida"] += v.total - (v.produto.preco_custo * v.quantidade)

    top_produtos = sorted(
        [schemas.RelatorioProdutosItem(**v) for v in produtos_dict.values()],
        key=lambda x: x.quantidade_vendida,
        reverse=True,
    )[:10]

    produto_mais_vendido = top_produtos[0].produto_nome if top_produtos else None

    alertas = db.query(models.Produto).filter(
        models.Produto.quantidade_estoque <= models.Produto.quantidade_minima
    ).order_by(models.Produto.nome).all()

    return schemas.RelatorioProdutos(
        total_vendido_mes=total_vendido,
        receita_bruta_mes=round(receita_bruta, 2),
        receita_liquida_mes=round(receita_liquida, 2),
        margem_media=margem_media,
        produto_mais_vendido=produto_mais_vendido,
        alertas_estoque=alertas,
        top_produtos=top_produtos,
    )


@router.get("/previsao", response_model=schemas.PrevisaoResumo)
def previsao_servicos(
    dias: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual)
):
    hoje = datetime.now(timezone.utc).date()
    DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

    resultado = []
    servicos_totais: dict = {}

    for i in range(dias):
        dia = hoje + timedelta(days=i)
        dia_str = dia.isoformat()

        ordens = db.query(models.OrdemServico).options(
            joinedload(models.OrdemServico.cliente),
            joinedload(models.OrdemServico.itens),
        ).filter(
            models.OrdemServico.prazo_entrega.like(f"{dia_str}%"),
            models.OrdemServico.status != models.StatusOS.entregue,
        ).all()

        # Agrupar por categoria e serviços para o dia
        categorias_dict: dict = {}
        resumo_dia: dict = {}

        for o in ordens:
            for item in o.itens:
                try:
                    servicos = json.loads(item.servicos or "[]")
                except Exception:
                    servicos = []
                qtd = item.quantidade or 1
                cat = item.categoria or "Sem categoria"

                if cat not in categorias_dict:
                    categorias_dict[cat] = {"total_itens": 0, "servicos": {}}
                categorias_dict[cat]["total_itens"] += qtd

                for s in servicos:
                    categorias_dict[cat]["servicos"][s] = categorias_dict[cat]["servicos"].get(s, 0) + qtd
                    resumo_dia[s] = resumo_dia.get(s, 0) + qtd
                    servicos_totais[s] = servicos_totais.get(s, 0) + qtd

        categorias_list = sorted(
            [
                schemas.CategoriaPrevisao(
                    categoria=cat,
                    total_itens=data["total_itens"],
                    servicos=sorted(
                        [schemas.ServicoPrevisao(servico=s, quantidade=q) for s, q in data["servicos"].items()],
                        key=lambda x: x.quantidade, reverse=True,
                    ),
                )
                for cat, data in categorias_dict.items()
            ],
            key=lambda x: x.total_itens, reverse=True,
        )

        resumo_servicos = sorted(
            [schemas.ServicoPrevisao(servico=s, quantidade=q) for s, q in resumo_dia.items()],
            key=lambda x: x.quantidade, reverse=True,
        )

        resultado.append(schemas.PrevisaoDia(
            data=dia_str,
            dia_semana=DIAS_SEMANA[dia.weekday()],
            qtd_os=len(ordens),
            ordens=[schemas.OSPrevisaoDia(
                id=o.id,
                numero=o.numero,
                cliente_nome=o.cliente.nome if o.cliente else "—",
                status=o.status,
            ) for o in ordens],
            categorias=categorias_list,
            resumo_servicos=resumo_servicos,
            destaque=len(ordens) >= 5,
        ))

    ranking = sorted(
        [schemas.ServicoPrevisao(servico=k, quantidade=v) for k, v in servicos_totais.items()],
        key=lambda x: x.quantidade, reverse=True,
    )

    return schemas.PrevisaoResumo(dias=resultado, ranking_servicos=ranking)
