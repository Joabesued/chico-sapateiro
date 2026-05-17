# 🥿 Chico Sapateiro — Sistema de Gestão

> *"Cada peça que chega nas nossas mãos, sai melhor do que era."*

Sistema completo de gestão para a sapataria **Chico Sapateiro**, localizada na Barra, Salvador — Bahia. Desenvolvido para modernizar a operação de um negócio familiar com mais de 25 anos de história.

---

## ✨ Sobre o projeto

O Chico Sapateiro é uma sapataria familiar fundada nos anos 2000 por Francisco, um artesão autodidata com mais de 25 anos de ofício. Este sistema foi criado para substituir o controle manual em caderno e trazer organização, agilidade e profissionalismo ao atendimento.

---

## 🚀 Funcionalidades

### Sistema Administrativo
- **Ordens de Serviço** — criação de OS com múltiplos itens por nota
- **Categorias de itens** — calçados, bolsas, malas, cintos e mais
- **Serviços detalhados** — seleção múltipla com opção personalizada
- **Checklist de serviços** — marque cada serviço conforme for concluindo
- **Controle de pagamento** — entrada, resta e status de pagamento
- **Prazo de entrega** — seletor rápido integrado
- **Busca de clientes** — preenche automaticamente dados de clientes já cadastrados
- **Alertas de atraso** — destaque visual para OS com prazo vencido
- **Envio via WhatsApp** — nota formatada enviada diretamente ao cliente
- **Geração de PDF** — nota em PDF para salvar e compartilhar
- **Relatório financeiro** — total faturado, recebido, pendente e por status
- **Histórico de clientes** — todas as OS por cliente

### Site Público
- Página institucional com história e missão
- Seção de serviços
- Blog de dicas de cuidados com couro
- Contato via WhatsApp e telefone

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend (sistema) | React + Tailwind CSS |
| Backend | Python + FastAPI |
| Banco de dados | SQLite |
| Frontend (site) | HTML + CSS + JavaScript puro |
| Versionamento | Git + GitHub |

---

## ⚙️ Como rodar localmente

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- Git

### Passo a passo

**1. Clone o repositório**
```bash
git clone https://github.com/Joabesued/chico-sapateiro.git
cd chico-sapateiro
```

**2. Suba o backend**
```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
pip install bcrypt==4.0.1
python seed.py
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```

**3. Suba o frontend (novo terminal)**
```bash
cd frontend
npm install
npm run dev
```

**4. Acesse o sistema**
```
http://localhost:5173
Usuário: chico
Senha: sapateiro123
```

---

## 📱 Acesso pela rede local

Com o sistema rodando, qualquer dispositivo no mesmo Wi-Fi pode acessar:

```
http://[IP-DO-COMPUTADOR]:5173
```

Para descobrir o IP, rode `ipconfig` no Windows ou `ifconfig` no Linux/Mac.

---

## 🗂️ Estrutura do projeto

```
chico-sapateiro/
├── backend/              # API Python + FastAPI
│   ├── routers/          # Endpoints da API
│   ├── main.py           # Aplicação principal
│   ├── models.py         # Modelos do banco de dados
│   ├── schemas.py        # Schemas Pydantic
│   ├── database.py       # Configuração do banco
│   ├── migrate.py        # Migrações
│   ├── seed.py           # Dados iniciais
│   └── requirements.txt  # Dependências Python
├── frontend/             # Interface React
│   └── src/
│       ├── pages/        # Páginas da aplicação
│       └── components/   # Componentes reutilizáveis
├── frontend-site/        # Site público
│   └── index.html        # Site institucional
└── index.html            # Cópia para GitHub Pages
```

---

## 🔮 Próximos passos

- [ ] Deploy na nuvem (Railway + Hostinger)
- [ ] Migração do banco para PostgreSQL (Supabase)
- [ ] Domínio próprio: chicosapateiro.com.br
- [ ] Impressão de recibo com QR Code
- [ ] Etiqueta automática por item
- [ ] Integração WhatsApp Business com IA
- [ ] PWA — app instalável no celular
- [ ] Lojinha de produtos para cuidado com couro

---

## 📍 Sobre a sapataria

**Chico Sapateiro**
Rua Afonso Celso, 225 — Loja 7
Barra, Salvador · Bahia

📞 (71) 3264-5659
💬 [WhatsApp](https://wa.me/5571932645659)

---

*Desenvolvido com 🤝 entre Joabe e Claude — de um caderno para um sistema completo.*
