# Diagrama do Banco de Dados - Patrimônio AI

## Visão Geral

Sistema de gestão de patrimônio com auditoria, conferências e controle de usuários.

```
┌─────────────────────────────────────────────────────────────────┐
│                     BANCO DE DADOS SQLITE                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│       ASSETS         │         │      USERS           │
├──────────────────────┤         ├──────────────────────┤
│ id (PK)              │         │ id (PK)              │
│ description          │         │ email (UNIQUE)       │
│ value                │         │ name                 │
│ value_formatted      │         │ google_id (UNIQUE)   │
│ term_date            │         │ is_admin             │
│ location             │◄─────┐  │ is_approved          │
│ responsible          │      │  │ created_at           │
│ sector               │      │  │ last_login           │
│ category             │      │  └──────────────────────┘
│ tags (JSON)          │      │_
│ created_at           │       │  ┌──────────────────────┐
│ updated_at           │       │  │   REFRESH_TOKENS     │
└──────────────────────┘       │  ├──────────────────────┤
          │                    │  │ id (PK)              │
          │                    │  │ user_id (FK)         │
          │                    │  │ token_hash           │
          │                    └──│ expires_at           │
          │                       │ created_at           │
          │                       │ last_used_at         │
    ┌─────┴───────────────────────┴──────────────────────┘
    │
    │  (1:N)
    │
    ▼
┌──────────────────────────────────────────┐
│     MOVEMENT_HISTORY                     │
├──────────────────────────────────────────┤
│ id (PK)                                  │
│ asset_id (FK) ────┐                      │
│ date              │                      │
│ from_location     │                      │
│ to_location       │                      │
│ authorized_by     │                      │
│ conference_id (FK)├──┐                   │
│ action            │  │                   │
│ decided_by        │  │                   │
│ decision_date     │  │                   │
│ reason            │  │                   │
│ created_at        │  │                   │
└──────────────────────────────────────────┘
                    │  │
                    │  └────┐
                    │       │ (1:N)
                    │       │
                    │       ▼
                    │  ┌──────────────────────────────────────┐
                    │  │   CONFERENCE_RECORDS                 │
                    │  ├──────────────────────────────────────┤
                    │  │ id (PK)                              │
                    │  │ date                                 │
                    │  │ location                             │
                    │  │ notes                                │
                    │  │ stats_matches                        │
                    │  │ stats_aliens                         │
                    │  │ stats_new_items                      │
                    │  │ stats_missing                        │
                    │  │ scanned_items_snapshot (JSON)        │
                    │  │ decisions_snapshot (JSON)            │
                    │  │ status (DRAFT/PENDING_APPROVAL/...)  │
                    │  │ created_by                           │
                    │  │ approved_by                          │
                    │  │ approved_at                          │
                    │  │ rejected_by                          │
                    │  │ rejection_reason                     │
                    │  │ rejected_at                          │
                    │  │ last_modified_by                     │
                    │  │ last_modified_at                     │
                    │  │ created_at                           │
                    │  └──────────────────────────────────────┘
                    │
                    └────────────────────────────────────────────┤
                                                                  │
                                                         (1:N)    │
                                                          |       │
                                   Asset Locations ─────┘        │
                                                          ┌───────┘
```

---

## Descrição das Tabelas

### 1. **ASSETS** (Patrimônios)
Armazena informações de bens patrimoniais da instituição.

| Campo | Tipo | Constraints | Descrição |
|-------|------|-----------|-----------|
| `id` | TEXT | PRIMARY KEY | Tombo/ID do bem |
| `description` | TEXT | NOT NULL | Descrição do bem |
| `value` | REAL | NOT NULL | Valor do bem em reais |
| `value_formatted` | TEXT | | Valor formatado (ex: "R$ 1.000,00") |
| `term_date` | TEXT | | Data de término/depreciação |
| `location` | TEXT | NOT NULL | Local atual do bem (ex: "E-101") |
| `responsible` | TEXT | | Responsável pelo bem |
| `sector` | TEXT | | Setor/departamento |
| `category` | TEXT | | Categoria do bem |
| `tags` | TEXT (JSON) | | Tags/etiquetas (armazenado como JSON) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Data da última atualização |

**Índices:**
- `idx_assets_location` - Otimiza buscas por local
- `idx_assets_category` - Otimiza buscas por categoria

---

### 2. **MOVEMENT_HISTORY** (Histórico de Movimentação)
Registra todos os movimentos de bens entre locais e decisões de conferências.

| Campo | Tipo | Constraints | Descrição |
|-------|------|-----------|-----------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID sequencial |
| `asset_id` | TEXT | FK → ASSETS(id) | ID do bem movimentado |
| `date` | TEXT | NOT NULL | Data do movimento |
| `from_location` | TEXT | NOT NULL | Local de origem |
| `to_location` | TEXT | NOT NULL | Local de destino |
| `authorized_by` | TEXT | | Usuário que autorizou |
| `conference_id` | TEXT | FK → CONFERENCE_RECORDS(id) | Conferência origem (opcional) |
| `action` | TEXT | | Tipo de ação (APPROVE/REJECT) |
| `decided_by` | TEXT | | Usuário que decidiu |
| `decision_date` | DATETIME | | Data da decisão |
| `reason` | TEXT | | Motivo/observação |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Data de criação |

**Índices:**
- `idx_movement_asset_id` - Otimiza buscas por bem

---

### 3. **CONFERENCE_RECORDS** (Registros de Conferências)
Armazena conferências realizadas com estatísticas e snapshot dos dados.

| Campo | Tipo | Constraints | Descrição |
|-------|------|-----------|-----------|
| `id` | TEXT | PRIMARY KEY | UUID da conferência |
| `date` | TEXT | NOT NULL | Data/hora da conferência |
| `location` | TEXT | NOT NULL | Local da conferência |
| `notes` | TEXT | | Notas/observações |
| `stats_matches` | INTEGER | DEFAULT 0 | Quantidade de itens encontrados |
| `stats_aliens` | INTEGER | DEFAULT 0 | Quantidade de itens divergentes (outro local) |
| `stats_new_items` | INTEGER | DEFAULT 0 | Quantidade de itens novos/não cadastrados |
| `stats_missing` | INTEGER | DEFAULT 0 | Quantidade de itens não encontrados |
| `scanned_items_snapshot` | TEXT (JSON) | | Snapshot dos itens escaneados |
| `decisions_snapshot` | TEXT (JSON) | | Decisões de aprovação/rejeição |
| `status` | TEXT | DEFAULT 'DRAFT' | Status (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED) |
| `created_by` | TEXT | NOT NULL | Email do usuário criador |
| `approved_by` | TEXT | | Email do aprovador |
| `approved_at` | DATETIME | | Data de aprovação |
| `rejected_by` | TEXT | | Email de quem rejeitou |
| `rejection_reason` | TEXT | | Motivo da rejeição |
| `rejected_at` | DATETIME | | Data de rejeição |
| `last_modified_by` | TEXT | NOT NULL | Último usuário a modificar |
| `last_modified_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Última modificação |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Data de criação |

---

### 4. **USERS** (Usuários)
Armazena informações de usuários autenticados via Google OAuth.

| Campo | Tipo | Constraints | Descrição |
|-------|------|-----------|-----------|
| `id` | TEXT | PRIMARY KEY | UUID do usuário |
| `email` | TEXT | UNIQUE NOT NULL | Email único |
| `name` | TEXT | NOT NULL | Nome do usuário |
| `google_id` | TEXT | UNIQUE NOT NULL | ID do Google OAuth |
| `is_admin` | INTEGER | DEFAULT 0 | Flag de administrador |
| `is_approved` | INTEGER | DEFAULT 0 | Flag de aprovação (admin approval) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `last_login` | DATETIME | | Último acesso |

---

### 5. **REFRESH_TOKENS** (Tokens de Renovação)
Armazena tokens para renovação de sessão sem requerer novo login.

| Campo | Tipo | Constraints | Descrição |
|-------|------|-----------|-----------|
| `id` | TEXT | PRIMARY KEY | UUID do token |
| `user_id` | TEXT | FK → USERS(id) | Usuário dono do token |
| `token_hash` | TEXT | NOT NULL | Hash SHA-256 do token |
| `expires_at` | DATETIME | NOT NULL | Data de expiração |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Data de criação |
| `last_used_at` | DATETIME | | Último uso do token |

**Índices:**
- `idx_users_email` - Busca por email
- `idx_users_google_id` - Busca por Google ID
- `idx_refresh_tokens_user_id` - Tokens por usuário
- `idx_refresh_tokens_hash` - Busca por hash do token

---

## Relacionamentos

```
ASSETS (1) ─────< (N) MOVEMENT_HISTORY
                      ↓
                   (referencia)
                      ↓
             CONFERENCE_RECORDS (1) ─────< (N) MOVEMENT_HISTORY

USERS (1) ─────< (N) REFRESH_TOKENS
```

### Fluxos Principais

**1. Conferência de Patrimônio:**
- Usuário inicia conferência em um local
- Sistema captura items (scans QR codes)
- Items classificados: MATCH, ALIEN (outro local), NEW (não cadastrado)
- Snapshot armazenado em CONFERENCE_RECORDS
- Admin aprova/rejeita decisões
- MOVEMENT_HISTORY atualizado com movimentos aprovados
- ASSETS atualizados com novas localizações

**2. Autenticação:**
- Usuário faz login via Google OAuth
- Registro criado em USERS
- Admin aprova em USERS.is_approved
- REFRESH_TOKENS usados para renovação de sessão

---

## Exemplo de Query Common

```sql
-- Listar conferências pendentes de aprovação
SELECT id, date, location, stats_matches, stats_missing, status
FROM conference_records
WHERE status = 'PENDING_APPROVAL'
ORDER BY created_at DESC;

-- Histórico de movimentação de um bem
SELECT ch.date, ch.from_location, ch.to_location, ch.authorized_by, ch.action
FROM movement_history ch
WHERE ch.asset_id = ?
ORDER BY ch.date DESC;

-- Bens em um local específico
SELECT id, description, location, value_formatted
FROM assets
WHERE location = ?
ORDER BY id;

-- Usuários não aprovados
SELECT id, email, name, created_at
FROM users
WHERE is_approved = 0
ORDER BY created_at DESC;
```

---

## Notas Importantes

- **JSON Storage:** `scanned_items_snapshot` e `decisions_snapshot` armazenam dados complexos como JSON text
- **ON DELETE Behavior:**
  - ASSET deletado → MOVEMENT_HISTORY associados deletados (CASCADE)
  - CONFERENCE_RECORDS deletada → MOVEMENT_HISTORY.conference_id fica NULL (SET NULL)
  - USER deletado → REFRESH_TOKENS deletados (CASCADE)
- **Status de Conferência:** Fluxo: DRAFT → PENDING_APPROVAL → APPROVED ou REJECTED
- **Aprovação de Usuário:** Novo usuário começa com `is_approved = 0`, admin altera para 1
