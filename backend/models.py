from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
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
    status_pagamento = Column(String, nullable=False, default=StatusPagamento.nao_pago)
    status = Column(String, nullable=False, default=StatusOS.em_andamento)
    criado_em = Column(DateTime(timezone=True), default=_agora, server_default=func.now())
    atualizado_em = Column(DateTime(timezone=True), onupdate=func.now())

    cliente = relationship("Cliente", back_populates="ordens")
    itens = relationship("ItemOS", back_populates="ordem", cascade="all, delete-orphan")


class ItemOS(Base):
    """
    categoria  — ex: "Par", "Bolsa", "Mala"
    servicos   — JSON array, ex: '["Solado", "Costura"]'
    cor        — ex: "Preto"
    descricao  — anotação livre opcional
    qtd_rodas  — apenas quando "Trocar roda" está nos serviços
    valor      — valor cobrado pelo item
    """
    __tablename__ = "itens_os"

    id = Column(Integer, primary_key=True, index=True)
    ordem_id = Column(Integer, ForeignKey("ordens_servico.id"), nullable=False)
    categoria = Column(String, nullable=False, default="Par")
    servicos = Column(String, nullable=False, default="[]")   # JSON
    cor = Column(String, nullable=True, default="")
    descricao = Column(String, nullable=True, default="")
    qtd_rodas = Column(Integer, nullable=True)
    valor = Column(Float, nullable=False, default=0.0)

    ordem = relationship("OrdemServico", back_populates="itens")


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False, unique=True, index=True)
