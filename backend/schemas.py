from pydantic import BaseModel, computed_field, field_validator
from typing import Optional, List
from datetime import datetime
import json


# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    nome_usuario: str


# --- Cliente ---
class ClienteBase(BaseModel):
    nome: str
    telefone: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteResponse(ClienteBase):
    id: int
    criado_em: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClienteComOS(ClienteResponse):
    total_os: int = 0
    ultima_os: Optional[datetime] = None


# --- Categoria ---
class CategoriaCreate(BaseModel):
    nome: str
    tipo: str = "diverso"  # 'calcado' | 'diverso'


class CategoriaResponse(BaseModel):
    id: int
    nome: str
    tipo: str = "diverso"

    model_config = {"from_attributes": True}


# --- Item de OS ---
class ItemOSCreate(BaseModel):
    categoria: str
    subcategoria: Optional[str] = ""
    lado: Optional[str] = ""
    servicos: List[str]
    servicos_concluidos: Optional[List[str]] = []
    observacao_servico: Optional[str] = ""
    cor: Optional[str] = ""
    qtd_rodas: Optional[int] = None
    valor: float = 0.0
    foto_url: Optional[str] = ""
    quantidade: int = 1
    revisao: bool = False
    entregue: bool = False


class ItemOSResponse(BaseModel):
    id: int
    categoria: str
    subcategoria: Optional[str] = ""
    lado: Optional[str] = ""
    servicos: List[str]
    servicos_concluidos: List[str] = []
    observacao_servico: Optional[str] = ""
    cor: Optional[str] = ""
    qtd_rodas: Optional[int] = None
    valor: float
    foto_url: Optional[str] = ""
    quantidade: int = 1
    revisao: bool = False
    entregue: bool = False

    @field_validator("servicos", "servicos_concluidos", mode="before")
    @classmethod
    def parse_lista_json(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []

    model_config = {"from_attributes": True}


# --- Ordem de Serviço ---
class OSCreate(BaseModel):
    cliente_nome: str
    cliente_telefone: Optional[str] = None
    prazo_entrega: Optional[str] = None
    entrada: float = 0.0
    desconto: float = 0.0
    itens: List[ItemOSCreate]


class OSUpdate(BaseModel):
    prazo_entrega: Optional[str] = None
    entrada: Optional[float] = None
    desconto: Optional[float] = None
    status: Optional[str] = None
    itens: Optional[List[ItemOSCreate]] = None


class ChecklistUpdate(BaseModel):
    servicos_concluidos: List[str]


class EntregarItemUpdate(BaseModel):
    entregue: bool


class OSResponse(BaseModel):
    id: int
    numero: int
    status: str
    status_pagamento: str
    prazo_entrega: Optional[str] = None
    entrada: float
    desconto: float = 0.0
    cliente_id: int
    cliente: ClienteResponse
    itens: List[ItemOSResponse]
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    @computed_field
    @property
    def subtotal(self) -> float:
        return round(sum(item.valor * (item.quantidade or 1) for item in self.itens), 2)

    @computed_field
    @property
    def total(self) -> float:
        return round(max(0.0, self.subtotal - self.desconto), 2)

    @computed_field
    @property
    def resta(self) -> float:
        return round(max(0.0, self.total - self.entrada), 2)

    model_config = {"from_attributes": True}


# --- Ranking ---
class RankingItem(BaseModel):
    servico: str
    quantidade: int
    total: float


class RankingResumo(BaseModel):
    ranking_quantidade: List[RankingItem]
    ranking_valor: List[RankingItem]


class DashboardResumo(BaseModel):
    os_abertas_hoje: int
    faturado_mes: float
    recebido_mes: float
    pendente_total: float
    os_em_atraso: int
    os_prazo_hoje: int = 0
    os_prazo_amanha: int = 0
    os_prazo_semana: int = 0


# --- Relatório ---
class OSPendente(BaseModel):
    numero: int
    cliente_nome: str
    total: float
    entrada: float
    resta: float


class OSResumoDiario(BaseModel):
    numero: int
    cliente_nome: str
    total: float
    entrada: float
    resta: float
    status_pagamento: str
    status: str
    qtd_itens: int


class RelatorioDiario(BaseModel):
    data: str
    os_abertas: int
    os_finalizadas: int
    total_faturado: float
    total_recebido: float
    ordens: List[OSResumoDiario]


class RelatorioResumo(BaseModel):
    total_os: int
    total_faturado: float       # soma de todos os valores dos itens
    total_recebido: float       # soma de todas as entradas pagas
    total_pendente: float       # soma de todos os "resta" das OS não quitadas
    os_por_status: dict
    os_por_pagamento: dict
    os_pendentes: List[OSPendente]


# --- ServicoCustom ---
class ServicoCustomCreate(BaseModel):
    nome: str


class ServicoCustomResponse(BaseModel):
    id: int
    nome: str

    model_config = {"from_attributes": True}


# --- Ranking de Categorias ---
class RankingCategoria(BaseModel):
    categoria: str
    quantidade: int


class RankingCategorias(BaseModel):
    ranking: List[RankingCategoria]


# --- Produtividade ---
class HistoricoDia(BaseModel):
    data: str
    qtd: int


class ProdutividadeResumo(BaseModel):
    media_notas_dia: float
    dias_em_operacao: int
    dia_mais_produtivo: Optional[str] = None
    dia_mais_produtivo_qtd: int = 0
    tendencia_semana: float
    os_semana_atual: int
    os_semana_passada: int
    historico_14dias: List[HistoricoDia]


# --- Previsão de Serviços ---
class OSPrevisaoDia(BaseModel):
    id: int
    numero: int
    cliente_nome: str
    status: str


class ServicoPrevisao(BaseModel):
    servico: str
    quantidade: int


class CategoriaPrevisao(BaseModel):
    categoria: str
    total_itens: int
    servicos: List[ServicoPrevisao]


class PrevisaoDia(BaseModel):
    data: str
    dia_semana: str
    qtd_os: int
    ordens: List[OSPrevisaoDia]
    categorias: List[CategoriaPrevisao] = []
    resumo_servicos: List[ServicoPrevisao] = []
    destaque: bool = False


class PrevisaoResumo(BaseModel):
    dias: List[PrevisaoDia]
    ranking_servicos: List[ServicoPrevisao]


# --- Produto ---
class ProdutoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = ""
    quantidade_estoque: int = 0
    quantidade_minima: int = 1
    preco_custo: float = 0.0
    preco_venda: float = 0.0


class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    quantidade_estoque: Optional[int] = None
    quantidade_minima: Optional[int] = None
    preco_custo: Optional[float] = None
    preco_venda: Optional[float] = None


class ProdutoResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = ""
    quantidade_estoque: int
    quantidade_minima: int
    preco_custo: float
    preco_venda: float
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    @computed_field
    @property
    def estoque_baixo(self) -> bool:
        return self.quantidade_estoque <= self.quantidade_minima

    @computed_field
    @property
    def margem(self) -> float:
        if self.preco_venda <= 0:
            return 0.0
        return round(((self.preco_venda - self.preco_custo) / self.preco_venda) * 100, 1)

    model_config = {"from_attributes": True}


class VendaProdutoCreate(BaseModel):
    quantidade: int = 1
    os_id: Optional[int] = None


class VendaProdutoResponse(BaseModel):
    id: int
    produto_id: int
    produto_nome: str
    quantidade: int
    preco_unitario: float
    total: float
    os_id: Optional[int] = None
    criado_em: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RelatorioProdutosItem(BaseModel):
    produto_id: int
    produto_nome: str
    quantidade_vendida: int
    receita_bruta: float
    receita_liquida: float


class RelatorioProdutos(BaseModel):
    total_vendido_mes: int
    receita_bruta_mes: float
    receita_liquida_mes: float
    margem_media: float
    produto_mais_vendido: Optional[str] = None
    alertas_estoque: List[ProdutoResponse]
    top_produtos: List[RelatorioProdutosItem]
