import json
from datetime import datetime, date as date_type, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import auth as auth_utils

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/analise-atrasos")
def analise_atrasos(
    dias: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    usuario=Depends(auth_utils.get_usuario_atual),
):
    hoje = datetime.now(timezone.utc)
    hoje_str = hoje.date().isoformat()
    inicio = hoje - timedelta(days=dias)

    ordens = db.query(models.OrdemServico).options(
        joinedload(models.OrdemServico.itens)
    ).filter(
        (models.OrdemServico.criado_em == None) |  # noqa: E711
        (models.OrdemServico.criado_em >= inicio)
    ).all()

    # Pré-computa dias de atraso por OS (0 quando prazo não passou)
    os_dias_atraso = {}
    for os in ordens:
        if not os.prazo_entrega:
            os_dias_atraso[os.id] = 0
            continue
        prazo = os.prazo_entrega[:10]
        if prazo >= hoje_str:
            os_dias_atraso[os.id] = 0
            continue
        try:
            prazo_date = date_type.fromisoformat(prazo)
            os_dias_atraso[os.id] = (hoje.date() - prazo_date).days
        except Exception:
            os_dias_atraso[os.id] = 0

    # Monta lista plana de itens com flag de atraso
    # Um item é atrasado quando: prazo da OS já passou E item.entregue == False
    itens_flat = []
    for os in ordens:
        dias_atraso_os = os_dias_atraso[os.id]
        for item in os.itens:
            qtd = item.quantidade or 1
            is_atrasado = dias_atraso_os > 0 and not item.entregue
            try:
                svcs = json.loads(item.servicos) if isinstance(item.servicos, str) else (item.servicos or [])
            except Exception:
                svcs = []
            itens_flat.append({
                "item": item,
                "qtd": qtd,
                "dias_atraso": dias_atraso_os if is_atrasado else 0,
                "is_atrasado": is_atrasado,
                "svcs": svcs,
            })

    total_itens = sum(d["qtd"] for d in itens_flat)
    total_itens_atrasados = sum(d["qtd"] for d in itens_flat if d["is_atrasado"])
    taxa_atraso = round(total_itens_atrasados / total_itens * 100, 1) if total_itens > 0 else 0.0

    atrasados = [d for d in itens_flat if d["is_atrasado"]]
    atraso_medio = (
        round(sum(d["dias_atraso"] for d in atrasados) / len(atrasados), 1)
        if atrasados else 0.0
    )

    # Pior atraso — item (não OS) com maior dias_atraso
    pior_atraso_dias = 0
    pior_atraso_categoria = None
    pior_atraso_servico = None
    if atrasados:
        pior = max(atrasados, key=lambda d: d["dias_atraso"])
        pior_atraso_dias = pior["dias_atraso"]
        pior_atraso_categoria = pior["item"].categoria
        svcs_pior = pior["svcs"]
        pior_atraso_servico = svcs_pior[0] if svcs_pior else pior["item"].categoria

    # Ranking de categorias (por contagem de itens × quantidade)
    cat_data = {}
    for d in itens_flat:
        cat = d["item"].categoria or "Sem categoria"
        if cat not in cat_data:
            cat_data[cat] = {"total": 0, "atrasados": 0, "dias": []}
        cat_data[cat]["total"] += d["qtd"]
        if d["is_atrasado"]:
            cat_data[cat]["atrasados"] += d["qtd"]
            cat_data[cat]["dias"].append(d["dias_atraso"])

    ranking_categorias = []
    for cat, data in cat_data.items():
        pct = round(data["atrasados"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0
        media_dias = round(sum(data["dias"]) / len(data["dias"]), 1) if data["dias"] else 0.0
        ranking_categorias.append({
            "nome": cat,
            "total_itens": data["total"],
            "total_atrasados": data["atrasados"],
            "percentual_atraso": pct,
            "media_dias_atraso": media_dias,
        })
    ranking_categorias.sort(key=lambda x: x["percentual_atraso"], reverse=True)

    # Ranking de serviços (por ocorrência de serviço × quantidade)
    svc_data = {}
    for d in itens_flat:
        for svc in d["svcs"]:
            if svc not in svc_data:
                svc_data[svc] = {"total": 0, "atrasados": 0, "dias": []}
            svc_data[svc]["total"] += d["qtd"]
            if d["is_atrasado"]:
                svc_data[svc]["atrasados"] += d["qtd"]
                svc_data[svc]["dias"].append(d["dias_atraso"])

    ranking_servicos = []
    for svc, data in svc_data.items():
        pct = round(data["atrasados"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0
        media_dias = round(sum(data["dias"]) / len(data["dias"]), 1) if data["dias"] else 0.0
        ranking_servicos.append({
            "nome": svc,
            "total_ocorrencias": data["total"],
            "total_atrasados": data["atrasados"],
            "percentual_atraso": pct,
            "media_dias_atraso": media_dias,
        })
    ranking_servicos.sort(key=lambda x: x["percentual_atraso"], reverse=True)

    # Cruzamento retorno x eficiência
    # Valor por serviço = item.valor / nº de serviços do item (divisão igualitária)
    svc_valor = {}
    for d in itens_flat:
        svcs = d["svcs"]
        if not svcs:
            continue
        valor_por_svc = d["item"].valor / len(svcs)
        qtd = d["qtd"]
        for svc in svcs:
            if svc not in svc_valor:
                svc_valor[svc] = {"total_valor": 0.0, "total": 0, "atrasados": 0}
            svc_valor[svc]["total_valor"] += valor_por_svc * qtd
            svc_valor[svc]["total"] += qtd
            if d["is_atrasado"]:
                svc_valor[svc]["atrasados"] += qtd

    retorno_list = []
    for svc, data in svc_valor.items():
        total_oc = data["total"]
        valor_medio = round(data["total_valor"] / total_oc, 2) if total_oc > 0 else 0.0
        pct = round(data["atrasados"] / total_oc * 100, 1) if total_oc > 0 else 0.0
        retorno_list.append({"nome": svc, "valor_medio": valor_medio, "percentual_atraso": pct})

    # Mediana dos valores médios para definir as tags
    if retorno_list:
        valores_ordenados = sorted(r["valor_medio"] for r in retorno_list)
        n = len(valores_ordenados)
        mediana = (
            valores_ordenados[n // 2]
            if n % 2 != 0
            else (valores_ordenados[n // 2 - 1] + valores_ordenados[n // 2]) / 2
        )
    else:
        mediana = 0.0

    for r in retorno_list:
        pct = r["percentual_atraso"]
        vm = r["valor_medio"]
        if pct >= 30 and vm <= mediana:
            r["tag"] = "evitar_acumulo"
        elif pct >= 15 and vm >= mediana:
            r["tag"] = "cobrar_mais"
        elif pct >= 15 and vm < mediana:
            r["tag"] = "atencao"
        else:
            r["tag"] = "manter"

    retorno_list.sort(key=lambda x: x["percentual_atraso"], reverse=True)

    return {
        "visao_geral": {
            "total_itens_atrasados": total_itens_atrasados,
            "total_itens": total_itens,
            "taxa_atraso": taxa_atraso,
            "atraso_medio_dias": atraso_medio,
            "pior_atraso_dias": pior_atraso_dias,
            "pior_atraso_categoria": pior_atraso_categoria,
            "pior_atraso_servico": pior_atraso_servico,
        },
        "ranking_categorias": ranking_categorias,
        "ranking_servicos": ranking_servicos,
        "retorno_eficiencia": retorno_list,
    }
