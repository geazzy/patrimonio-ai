# PatrimonioView AI

## Visão Geral

O **PatrimonioView AI** é uma aplicação web (SPA) desenvolvida para a gestão, visualização e auditoria de patrimônio físico. O sistema permite a importação de relatórios em PDF (OCR), visualização de dados em dashboards, interação via chat com IA (Google Gemini) e realização de conferências (auditorias) de bens in loco através de uma interface mobile-first.

## Arquitetura

O projeto está dividido em **frontend** e **backend**:

- **Frontend**: React 19 + TypeScript + Vite (porta 3000)
- **Backend**: Node.js + Express + TypeScript + SQLite (porta 3001)

## Stack Tecnológica

### Frontend
- **Framework**: React 19, TypeScript
- **Build Tool**: Vite
- **Estilização**: Tailwind CSS (via CDN)
- **Visualização de Dados**: Recharts
- **Processamento de PDF**: PDF.js (client-side)

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Linguagem**: TypeScript
- **Banco de Dados**: SQLite (better-sqlite3)
- **IA**: Google GenAI SDK (Gemini 2.5 Flash) - chave protegida no servidor

---

## Instalação e Execução

### Pré-requisitos

- Node.js 18+ e npm
- Chave de API do Google Gemini

### Backend

1. Entre na pasta do backend:
```bash
cd backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione sua chave da API Gemini:
```
GEMINI_API_KEY=sua_chave_aqui
PORT=3001
DATABASE_PATH=./database/patrimonio.db
FRONTEND_URL=http://localhost:3000
```

4. Inicie o servidor:
```bash
npm run dev
```

O backend estará rodando em `http://localhost:3001`

### Frontend

1. Entre na pasta do frontend:
```bash
cd frontend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (opcional):
```bash
# Crie um arquivo .env se quiser mudar a URL do backend
VITE_API_URL=http://localhost:3001
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

O frontend estará rodando em `http://localhost:3000`

---

## Estrutura do Projeto

```
patrimonio-ai/
├── frontend/              # Aplicação React
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   │   ├── AIChat.tsx
│   │   │   ├── AssetTable.tsx
│   │   │   ├── Conference.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── ImportPreview.tsx
│   │   ├── services/      # Serviços do frontend
│   │   │   ├── apiService.ts    # Cliente HTTP para backend
│   │   │   └── pdfService.ts    # Processamento de PDF (client-side)
│   │   ├── App.tsx        # Componente principal
│   │   ├── index.tsx      # Entry point
│   │   ├── constants.ts   # Dados iniciais (opcional)
│   │   └── types.ts       # Tipos TypeScript
│   ├── public/            # Arquivos estáticos
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/               # API REST
│   ├── src/
│   │   ├── routes/        # Rotas da API
│   │   │   ├── assets.ts
│   │   │   ├── conferences.ts
│   │   │   └── ai.ts
│   │   ├── services/      # Lógica de negócio
│   │   │   ├── dbService.ts      # Gerenciamento SQLite
│   │   │   ├── geminiService.ts   # Integração com Gemini AI
│   │   │   └── parser.ts          # Parser de OCR
│   │   ├── models/        # Tipos TypeScript
│   │   │   └── types.ts
│   │   ├── app.ts         # Configuração Express
│   │   └── server.ts      # Entry point
│   ├── database/          # Arquivo SQLite será criado aqui automaticamente
│   ├── package.json
│   └── tsconfig.json
├── metadata.json          # Metadados do projeto (AI Studio)
├── .gitignore
└── README.md
```

---

## API Endpoints

### Assets

- `GET /api/assets` - Lista todos os assets
- `GET /api/assets/:id` - Busca asset por ID
- `POST /api/assets` - Cria novo asset
- `PUT /api/assets/:id` - Atualiza asset
- `DELETE /api/assets/:id` - Deleta asset
- `POST /api/assets/import` - Importa assets de texto PDF (detecta conflitos)
- `POST /api/assets/bulk-upsert` - Upsert em massa (após resolução de conflitos)

### Conferences

- `GET /api/conferences` - Lista todas as conferências
- `GET /api/conferences/:id` - Busca conferência por ID
- `POST /api/conferences` - Cria nova conferência
- `POST /api/conferences/:id/commit` - Finaliza conferência e aplica mudanças

### AI

- `POST /api/ai/query` - Consulta ao Gemini com contexto dos assets

---

## Estrutura do Banco de Dados SQLite

### Tabela: assets
- `id` TEXT PRIMARY KEY (Tombo)
- `description` TEXT
- `value` REAL
- `value_formatted` TEXT
- `term_date` TEXT
- `location` TEXT
- `responsible` TEXT
- `sector` TEXT
- `category` TEXT
- `tags` TEXT (JSON array serializado)
- `created_at` DATETIME
- `updated_at` DATETIME

### Tabela: movement_history
- `id` INTEGER PRIMARY KEY
- `asset_id` TEXT (FK)
- `date` TEXT
- `from_location` TEXT
- `to_location` TEXT
- `authorized_by` TEXT
- `created_at` DATETIME

### Tabela: conference_records
- `id` TEXT PRIMARY KEY
- `date` TEXT
- `location` TEXT
- `stats_matches` INTEGER
- `stats_aliens` INTEGER
- `stats_new_items` INTEGER
- `stats_missing` INTEGER
- `scanned_items_snapshot` TEXT (JSON serializado)
- `created_at` DATETIME

---

## Regras de Negócio e Funcionalidades

### 1. Entidade Principal: `Asset` (Bem Patrimonial)
O sistema gira em torno da interface `Asset`. O campo `id` (Tombo) é a chave única.
- **Campos Chave**: ID, Descrição, Valor, Localização, Responsável, Categoria, Histórico de Movimentação.
- **Categorização Automática**: Ao importar, o sistema infere a categoria (Informática, Mobiliário, etc.) baseada em palavras-chave da descrição.

### 2. Importação de Dados (PDF)
O sistema não substitui o banco de dados cegamente; ele utiliza uma estratégia de **"Upsert" com Resolução de Conflitos**:
1. **Extração**: Texto extraído do PDF no frontend usando PDF.js (client-side), mantendo o layout visual.
2. **Processamento** (no backend):
   - O texto é enviado para o backend via API
   - O parser processa o texto OCR e identifica os assets usando Regex
   - **Novos**: IDs que não existem no banco -> Inserção automática sugerida
   - **Conflitos**: IDs existentes onde dados sensíveis (principalmente `Localização` e `Valor`) divergem do banco
3. **Interface de Resolução**: O usuário decide se mantém o dado atual ("Manter Original") ou aceita o do PDF ("Atualizar") para os conflitos.

### 3. Conferência (Auditoria Mobile)
Módulo desenhado para uso em tablets/celulares durante a verificação física.
- **Fluxo**:
  1. Usuário seleciona o **Local Alvo**.
  2. Escaneia/Digita o Tombo.
- **Estados de Leitura**:
  - 🟢 **MATCH**: O item pertence ao local alvo.
  - 🟠 **ALIEN (Divergente)**: O item é de outro local. Usuário pode optar por **transferir** o item para o local atual ao final da sessão.
  - 🔵 **NEW (Sobras)**: O item não existe no banco. É cadastrado como novo item ao finalizar.
- **Finalização e Histórico**:
  - Ao salvar, gera um `ConferenceRecord` persistente no banco.
  - Itens novos são inseridos no banco principal.
  - Transferências geram registros no histórico individual do bem.

### 4. Inteligência Artificial (Gemini)
- O backend recebe a query do frontend e busca os assets relevantes do banco.
- Envia um resumo contextual dos dados (estatísticas e amostra) para o Gemini.
- Permite perguntas em linguagem natural como "Qual o valor total em cadeiras?" ou "Liste os itens do setor X".
- **Segurança**: A chave da API Gemini nunca é exposta ao frontend.

---

## Desenvolvimento

### Scripts Disponíveis

#### Backend
- `npm run dev` - Inicia servidor em modo desenvolvimento (tsx watch)
- `npm run build` - Compila TypeScript para JavaScript
- `npm start` - Inicia servidor em produção (após build)

#### Frontend
- `npm run dev` - Inicia servidor de desenvolvimento Vite
- `npm run build` - Build para produção
- `npm run preview` - Preview do build de produção

### Variáveis de Ambiente

#### Backend (.env)
- `PORT` - Porta do servidor (padrão: 3001)
- `GEMINI_API_KEY` - Chave da API do Google Gemini (obrigatória)
- `DATABASE_PATH` - Caminho do arquivo SQLite (padrão: ./database/patrimonio.db)
- `FRONTEND_URL` - URL do frontend para CORS (padrão: http://localhost:3000)

#### Frontend (.env)
- `VITE_API_URL` - URL do backend (padrão: http://localhost:3001)

---

## Observações Importantes

1. **CORS**: O backend está configurado para aceitar requisições do frontend em `http://localhost:3000`
2. **Banco de Dados**: O arquivo SQLite é criado automaticamente na primeira execução
3. **Processamento PDF**: Mantido no frontend para melhor UX (não bloqueia servidor)
4. **Segurança**: Chave da API Gemini protegida no backend, nunca exposta ao cliente
5. **Histórico**: Toda mudança de local gera um registro em `movement_history`

---

*Documentação atualizada para arquitetura frontend/backend.*
