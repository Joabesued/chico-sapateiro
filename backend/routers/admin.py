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

    total_os = len(ordens)

    def get_dias_atraso(os):
        if not os.prazo_entrega or os.status == models.StatusOS.entregue:
            return 0
        prazo = os.prazo_entrega[:10]
        if prazo >= hoje_str:
            return 0
        try:
            prazo_date = date_type.fromisoformat(prazo)
            return (hoje.date() - prazo_date).days
        except Exception:
            return 0

    atrasadas_map = {}  # os_id -> dias_atraso (apenas OS com atraso)
    for os in ordens:
        d = get_dias_atraso(os)
        if d > 0:
            atrasadas_map[os.id] = d

    total_atrasadas = len(atrasadas_map)
    taxa_atraso = round(total_atrasadas / total_os * 100, 1) if total_os > 0 else 0.0
    atraso_medio = round(sum(atrasadas_map.values()) / total_atrasadas, 1) if total_atrasadas > 0 else 0.0

    # Pior atraso
    pior_atraso_dias = 0
    pior_atraso_servico = None
    if atrasadas_map:
        pior_os_id = max(atrasadas_map, key=atrasadas_map.get)
        pior_atraso_dias = atrasadas_map[pior_os_id]
        pior_os_obj = next((o for o in ordens if o.id == pior_os_id), None)
        if pior_os_obj and pior_os_obj.itens:
            item = pior_os_obj.itens[0]
            try:
                svcs = json.loads(item.servicos) if isinstance(item.servicos, str) else (item.servicos or [])
                pior_atraso_servico = svcs[0] if svcs else item.categoria
            except Exception:
                pior_atraso_servico = item.categoria

    # Ranking de categorias (por OS únicas)
    cat_data = {}
    for os in ordens:
        dias_atrasado = atrasadas_map.get(os.id, 0)
        is_atrasada = os.id in atrasadas_map
        for item in os.itens:
            cat = item.categoria or "Sem categoria"
            if cat not in cat_data:
                cat_data[cat] = {"os_ids": set(), "atrasadas_os": {}}
            cat_data[cat]["os_ids"].add(os.id)
            if is_atrasada:
                cat_data[cat]["atrasadas_os"][os.id] = dias_atrasado

    ranking_categorias = []
    for cat, data in cat_data.items():
        total_cat = len(data["os_ids"])
        atrasadas_cat = data["atrasadas_os"]
        total_cat_atrasadas = len(atrasadas_cat)
        pct = round(total_cat_atrasadas / total_cat * 100, 1) if total_cat > 0 else 0.0
        media_dias = round(sum(atrasadas_cat.values()) / len(atrasadas_cat), 1) if atrasadas_cat else 0.0
        ranking_categorias.append({
            "nome": cat,
            "total_os": total_cat,
            "total_atrasadas": total_cat_atrasadas,
            "percentual_atraso": pct,
            "media_dias_atraso": media_dias,
        })
    ranking_categorias.sort(key=lambda x: x["percentual_atraso"], reverse=True)

    # Ranking de serviços (por ocorrências, contando quantidade)
    svc_data = {}
    for os in ordens:
        dias_atrasado = atrasadas_map.get(os.id, 0)
        is_atrasada = os.id in atrasadas_map
        for item in os.itens:
            try:
                svcs = json.loads(item.servicos) if isinstance(item.servicos, str) else (item.servicos or [])
            except Exception:
                svcs = []
            qtd = item.quantidade or 1
            for svc in svcs:
                if svc not in svc_data:
                    svc_data[svc] = {"total": 0, "atrasadas": 0, "atrasadas_os": {}}
                svc_data[svc]["total"] += qtd
                if is_atrasada:
                    svc_data[svc]["atrasadas"] += qtd
                    svc_data[svc]["atrasadas_os"][os.id] = dias_atrasado

    ranking_servicos = []
    for svc, data in svc_data.items():
        pct = round(data["atrasadas"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0
        media_dias = round(sum(data["atrasadas_os"].values()) / len(data["atrasadas_os"]), 1) if data["atrasadas_os"] else 0.0
        ranking_servicos.append({
            "nome": svc,
            "total_ocorrencias": data["total"],
            "total_atrasadas": data["atrasadas"],
            "percentual_atraso": pct,
            "media_dias_atraso": media_dias,
        })
    ranking_servicos.sort(key=lambda x: x["percentual_atraso"], reverse=True)

    # Cruzamento retorno x eficiência (valor dividido igualmente entre serviços do item)
    svc_valor = {}
    for os in ordens:
        is_atrasada = os.id in atrasadas_map
        for item in os.itens:
            try:
                svcs = json.loads(item.servicos) if isinstance(item.servicos, str) else (item.servicos or [])
            except Exception:
                svcs = []
            if not svcs:
                continue
            qtd = item.quantidade or 1
            valor_por_svc = item.valor / len(svcs)
            for svc in svcs:
                if svc not in svc_valor:
                    svc_valor[svc] = {"total_valor": 0.0, "total": 0, "atrasadas": 0}
                svc_valor[svc]["total_valor"] += valor_por_svc * qtd
                svc_valor[svc]["total"] += qtd
                if is_atrasada:
                    svc_valor[svc]["atrasadas"] += qtd

    retorno_list = []
    for svc, data in svc_valor.items():
        total_oc = data["total"]
        valor_medio = round(data["total_valor"] / total_oc, 2) if total_oc > 0 else 0.0
        pct = round(data["atrasadas"] / total_oc * 100, 1) if total_oc > 0 else 0.0
        retorno_list.append({"nome": svc, "valor_medio": valor_medio, "percentual_atraso": pct})

    # Mediana dos valores médios para classificação das tags
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
            "total_atrasadas": total_atrasadas,
            "total_os": total_os,
            "taxa_atraso": taxa_atraso,
            "atraso_medio_dias": atraso_medio,
            "pior_atraso_dias": pior_atraso_dias,
            "pior_atraso_servico": pior_atraso_servico,
        },
        "ranking_categorias": ranking_categorias,
        "ranking_servicos": ranking_servicos,
        "retorno_eficiencia": retorno_list,
    }
