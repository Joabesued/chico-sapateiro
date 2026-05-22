"""
Migração incremental do banco de dados. Executado automaticamente ao iniciar o servidor.
Cada bloco verifica se já foi aplicado antes de agir — idempotente.
"""
import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "chico_sapateiro.db")

CATEGORIAS_PADRAO = [
    "Sapato social", "Tênis", "Sapatênis", "Mocassins", "Sandália",
    "Mala", "Cinto", "Bolsa", "Capa de prancha", "Carteira",
]

# Categorias antigas que devem ser removidas se ninguém estiver usando.
CATEGORIAS_LEGADAS = [
    "Par", "Pé esquerdo", "Pé direito",
]


def _colunas(cursor, tabela: str) -> set:
    return {row[1] for row in cursor.execute(f"PRAGMA table_info({tabela})").fetchall()}


def _recriar_ordens_servico(c):
    """
    Remove colunas legadas (tipo_servico NOT NULL, numero_sapato, descricao, valor)
    que bloqueiam INSERT no modelo novo. Preserva todos os dados existentes.
    """
    print("[migrate] Recriando tabela ordens_servico sem colunas legadas...")
    c.executescript("""
        PRAGMA foreign_keys = OFF;

        CREATE TABLE ordens_servico_v3 (
            id               INTEGER  PRIMARY KEY AUTOINCREMENT,
            numero           INTEGER  UNIQUE,
            cliente_id       INTEGER  NOT NULL REFERENCES clientes(id),
            prazo_entrega    TEXT,
            entrada          REAL     NOT NULL DEFAULT 0.0,
            status_pagamento TEXT     NOT NULL DEFAULT 'Não pago',
            status           TEXT     NOT NULL DEFAULT 'Em andamento',
            criado_em        DATETIME,
            atualizado_em    DATETIME
        );

        INSERT INTO ordens_servico_v3
            (id, numero, cliente_id, prazo_entrega, entrada, status_pagamento, status, criado_em, atualizado_em)
        SELECT
            id, numero, cliente_id, prazo_entrega,
            COALESCE(entrada, 0.0),
            COALESCE(status_pagamento, 'Não pago'),
            CASE
                WHEN status IN ('Em andamento','Pronto para retirada','Entregue') THEN status
                WHEN status = 'Aguardando' THEN 'Em andamento'
                WHEN status = 'Pago'       THEN 'Entregue'
                ELSE 'Em andamento'
            END,
            criado_em, atualizado_em
        FROM ordens_servico;

        DROP TABLE ordens_servico;
        ALTER TABLE ordens_servico_v3 RENAME TO ordens_servico;

        PRAGMA foreign_keys = ON;
    """)
    print("[migrate] ordens_servico recriada OK.")


def _recriar_itens_os(c):
    """
    Remove colunas legadas (tipo_servico NOT NULL, descricao NOT NULL antigo)
    que bloqueiam INSERT no modelo novo. Preserva dados existentes.
    """
    print("[migrate] Recriando tabela itens_os sem colunas legadas...")
    c.executescript("""
        PRAGMA foreign_keys = OFF;

        CREATE TABLE itens_os_v3 (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            ordem_id  INTEGER NOT NULL REFERENCES ordens_servico(id),
            categoria TEXT    NOT NULL DEFAULT 'Par',
            servicos  TEXT    NOT NULL DEFAULT '[]',
            cor       TEXT    DEFAULT '',
            descricao TEXT    DEFAULT '',
            qtd_rodas INTEGER,
            valor     REAL    NOT NULL DEFAULT 0.0
        );

        INSERT INTO itens_os_v3
            (id, ordem_id, categoria, servicos, cor, descricao, qtd_rodas, valor)
        SELECT
            id, ordem_id,
            COALESCE(NULLIF(categoria,''), descricao, 'Par'),
            COALESCE(NULLIF(servicos,''), '[]'),
            COALESCE(cor, ''),
            '',
            qtd_rodas,
            COALESCE(valor, 0.0)
        FROM itens_os;

        DROP TABLE itens_os;
        ALTER TABLE itens_os_v3 RENAME TO itens_os;

        PRAGMA foreign_keys = ON;
    """)
    print("[migrate] itens_os recriada OK.")


def run_migration():
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url and not db_url.startswith("sqlite"):
        return  # PostgreSQL: create_all cuida de tudo, sem migrações SQLite

    if not os.path.exists(DB_PATH):
        return  # Banco novo — create_all cuida de tudo

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    try:
        # ── 0. Recriar tabelas se ainda tiverem colunas legadas NOT NULL ─────────
        cols_os = _colunas(c, "ordens_servico") if _tabela_existe(c, "ordens_servico") else set()
        if "tipo_servico" in cols_os:
            _recriar_ordens_servico(c)
            conn.commit()

        cols_it = _colunas(c, "itens_os") if _tabela_existe(c, "itens_os") else set()
        if "tipo_servico" in cols_it:
            _recriar_itens_os(c)
            conn.commit()

        # ── 1. Garantir tabela itens_os existe (banco novo não passou pelo 0) ───
        c.execute("""
            CREATE TABLE IF NOT EXISTS itens_os (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ordem_id  INTEGER NOT NULL REFERENCES ordens_servico(id),
                categoria TEXT    NOT NULL DEFAULT 'Par',
                servicos  TEXT    NOT NULL DEFAULT '[]',
                cor       TEXT    DEFAULT '',
                descricao TEXT    DEFAULT '',
                qtd_rodas INTEGER,
                valor     REAL    NOT NULL DEFAULT 0.0
            )
        """)

        # ── 2. Garantir colunas novas em ordens_servico (caso precise) ──────────
        cols_os = _colunas(c, "ordens_servico")
        if "entrada" not in cols_os:
            c.execute("ALTER TABLE ordens_servico ADD COLUMN entrada REAL NOT NULL DEFAULT 0.0")
        if "status_pagamento" not in cols_os:
            c.execute("ALTER TABLE ordens_servico ADD COLUMN status_pagamento TEXT NOT NULL DEFAULT 'Não pago'")
        if "desconto" not in cols_os:
            c.execute("ALTER TABLE ordens_servico ADD COLUMN desconto REAL NOT NULL DEFAULT 0.0")

        # ── 2.1 Garantir colunas novas em itens_os ──────────────────────────────
        cols_it = _colunas(c, "itens_os")
        if "subcategoria" not in cols_it:
            c.execute("ALTER TABLE itens_os ADD COLUMN subcategoria TEXT DEFAULT ''")
        if "lado" not in cols_it:
            c.execute("ALTER TABLE itens_os ADD COLUMN lado TEXT DEFAULT ''")
        if "servicos_concluidos" not in cols_it:
            c.execute("ALTER TABLE itens_os ADD COLUMN servicos_concluidos TEXT NOT NULL DEFAULT '[]'")
        if "observacao_servico" not in cols_it:
            c.execute("ALTER TABLE itens_os ADD COLUMN observacao_servico TEXT DEFAULT ''")
        if "foto_url" not in cols_it:
            c.execute("ALTER TABLE itens_os ADD COLUMN foto_url TEXT DEFAULT ''")

        # Migrar itens antigos com categoria "Par"/"Pé esquerdo"/"Pé direito" para
        # usar o campo "lado" (mantém categoria como vazia para o usuário re-editar).
        for legado, lado in (("Par", "Par"), ("Pé esquerdo", "Pé esquerdo"), ("Pé direito", "Pé direito")):
            c.execute(
                "UPDATE itens_os SET lado = ? WHERE categoria = ? AND (lado IS NULL OR lado = '')",
                (lado, legado),
            )

        # ── 3. Tabela categorias ─────────────────────────────────────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS categorias (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT    NOT NULL UNIQUE
            )
        """)
        for nome in CATEGORIAS_PADRAO:
            c.execute("INSERT OR IGNORE INTO categorias (nome) VALUES (?)", (nome,))

        # Remove categorias legadas se ninguém mais as usa em itens.
        for legada in CATEGORIAS_LEGADAS:
            em_uso = c.execute(
                "SELECT 1 FROM itens_os WHERE categoria = ? LIMIT 1", (legada,)
            ).fetchone()
            if not em_uso:
                c.execute("DELETE FROM categorias WHERE nome = ?", (legada,))

        # ── 4. Corrigir criado_em NULL (tabelas recriadas perderam server_default) ─
        c.execute("""
            UPDATE ordens_servico
            SET criado_em = datetime('now')
            WHERE criado_em IS NULL
        """)
        n = c.rowcount
        if n:
            print(f"[migrate] {n} OS com criado_em NULL corrigidas para agora.")

        # ── 5. Converter status "Aguardando"/"Pago" remanescentes ───────────────
        c.execute("UPDATE ordens_servico SET status='Em andamento' WHERE status='Aguardando'")
        c.execute("UPDATE ordens_servico SET status='Entregue', status_pagamento='Pago total' WHERE status='Pago'")

        # ── 6. Sincronizar categorias personalizadas que existam nos itens ───────
        c.execute("SELECT DISTINCT categoria FROM itens_os WHERE categoria != ''")
        for (cat,) in c.fetchall():
            if cat in CATEGORIAS_LEGADAS:
                continue
            c.execute("INSERT OR IGNORE INTO categorias (nome) VALUES (?)", (cat,))

        conn.commit()
        print("[migrate] OK.")

    except Exception as e:
        conn.rollback()
        print(f"[migrate] ERRO: {e}")
        raise
    finally:
        conn.close()


def _tabela_existe(cursor, nome: str) -> bool:
    return bool(cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (nome,)
    ).fetchone())


if __name__ == "__main__":
    run_migration()
