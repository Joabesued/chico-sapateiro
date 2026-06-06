from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from datetime import datetime, timezone
import enum


def _agora():
    """Default Python-side para criado_em — garante valor mesmo sem server_default."""
    return datetime.now(timezone.utc)


class StatusOS(str, enum.Enum):
    em_andamento = "Em andamento"
    pronto = "Pronto para retirada"
    entregue = "Entregue"


class StatusPagamento(str, enum.Enum):
    nao_pago = "Não pago"
    pago_parcial = "Pago parcial"
    pago_total = "Pago total"


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nome = Column(String, nullable=False)
    criado_em = Column(DateTime(timezone=True), default=_agora, server_default=func.now())


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, index=True)
    telefone = Column(String, nullable=True)
    criado_em = Column(DateTime(timezone=True), default=_agora, server_default=func.now())

    ordens = relationship("OrdemServico", back_populates="cliente")


class OrdemServico(Base):
    __tablename__ = "ordens_servico"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer, unique=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    prazo_entrega = Column(String, nullable=True)
    entrada = Column(Float, nullable=False, default=0.0)
    desconto = Column(Float, nullable=False, default=0.0)
    status_pagamento = Column(String, nullable=False, default=StatusPagamento.nao_pago)
    status = Column(String, nullable=False, default=StatusOS.em_andamento)
    criado_em = Column(DateTime(timezone=True), default=_agora, server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())

    cliente = relationship("Cliente", back_populates="ordens")
    itens = relationship("ItemOS", back_populates="ordem", cascade="all, delete-orphan")
    vendas_produtos = relationship("VendaProduto", back_populates="ordem")


class ItemOS(Base):
    """
    categoria           — ex: "Sapato social", "Tênis", "Bolsa", "Mala"
    subcategoria        — apenas para Sandália: "Rasteira" ou "Com salto"
    lado                — apenas para calçados: "Par", "Pé esquerdo", "Pé direito"
    servicos            — JSON array, ex: '["Solado", "Costura"]'
    servicos_concluidos — JSON array com nomes dos serviços já concluídos
    observacao_servico  — texto livre sobre o que deve ser feito no item
    cor                 — ex: "Preto"
    descricao           — anotação livre opcional
    qtd_rodas           — apenas quando "Trocar roda" está nos serviços
    valor               — valor cobrado pelo item
    """
    __tablename__ = "itens_os"

    id = Column(Integer, primary_key=True, index=True)
    ordem_id = Column(Integer, ForeignKey("ordens_servico.id"), nullable=False)
    categoria = Column(String, nullable=False, default="Par")
    subcategoria = Column(String, nullable=True, default="")
    lado = Column(String, nullable=True, default="")
    servicos = Column(String, nullable=False, default="[]")   # JSON
    servicos_concluidos = Column(String, nullable=False, default="[]")  # JSON
    observacao_servico = Column(String, nullable=True, default="")
    cor = Column(String, nullable=True, default="")
    descricao = Column(String, nullable=True, default="")
    qtd_rodas = Column(Integer, nullable=True)
    valor = Column(Float, nullable=False, default=0.0)
    foto_url = Column(String, nullable=True, default="")
    quantidade = Column(Integer, nullable=False, default=1)
    revisao = Column(Boolean, nullable=False, default=False)
    entregue = Column(Boolean, nullable=False, default=False)

    ordem = relationship("OrdemServico", back_populates="itens")


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, unique=True, index=True)
    tipo = Column(String, nullable=False, default="diverso")  # 'calcado' | 'diverso'


class ServicoCustom(Base):
    __tablename__ = "servicos_custom"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, unique=True, index=True)


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, index=True)
    descricao = Column(String, nullable=True, default="")
    quantidade_estoque = Column(Integer, nullable=False, default=0)
    quantidade_minima = Column(Integer, nullable=False, default=1)
    preco_custo = Column(Float, nullable=False, default=0.0)
    preco_venda = Column(Float, nullable=False, default=0.0)
    criado_em = Column(DateTime(timezone=True), default=_agora, server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())

    vendas = relationship("VendaProduto", back_populates="produto")


class VendaProduto(Base):
    __tablename__ = "vendas_produtos"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)
    preco_unitario = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False, default=0.0)
    os_id = Column(Integer, ForeignKey("ordens_servico.id"), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=_agora, server_default=func.now())

    produto = relationship("Produto", back_populates="vendas")
    ordem = relationship("OrdemServico", back_populates="vendas_produtos")
