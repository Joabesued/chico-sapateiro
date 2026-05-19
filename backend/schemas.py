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


class CategoriaResponse(BaseModel):
    id: int
    nome: str

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
    descricao: Optional[str] = ""
    qtd_rodas: Optional[int] = None
    valor: float = 0.0
    foto_url: Optional[str] = ""


class ItemOSResponse(BaseModel):
    id: int
    categoria: str
    subcategoria: Optional[str] = ""
    lado: Optional[str] = ""
    servicos: List[str]
    servicos_concluidos: List[str] = []
    observacao_servico: Optional[str] = ""
    cor: Optional[str] = ""
    descricao: Optional[str] = ""
    qtd_rodas: Optional[int] = None
    valor: float
    foto_url: Optional[str] = ""

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
    itens: List[ItemOSCreate]


class OSUpdate(BaseModel):
    prazo_entrega: Optional[str] = None
    entrada: Optional[float] = None
    status: Optional[str] = None
    itens: Optional[List[ItemOSCreate]] = None


class ChecklistUpdate(BaseModel):
    servicos_concluidos: List[str]


class OSResponse(BaseModel):
    id: int
    numero: int
    status: str
    status_pagamento: str
    prazo_entrega: Optional[str] = None
    entrada: float
    cliente_id: int
    cliente: ClienteResponse
    itens: List[ItemOSResponse]
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    @computed_field
    @property
    def total(self) -> float:
        return round(sum(item.valor for item in self.itens), 2)

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


# --- Relatório ---
class OSPendente(BaseModel):
    numero: int
    cliente_nome: str
    total: float
    entrada: float
    resta: float


class RelatorioResumo(BaseModel):
    total_os: int
    total_faturado: float       # soma de todos os valores dos itens
    total_recebido: float       # soma de todas as entradas pagas
    total_pendente: float       # soma de todos os "resta" das OS não quitadas
    os_por_status: dict
    os_por_pagamento: dict
    os_pendentes: List[OSPendente]
