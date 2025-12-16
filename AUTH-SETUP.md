# Configuração de Autenticação Google + Aprovação Admin

## Variáveis de Ambiente Necessárias

### Backend (.env)
```
# Banco de Dados
DATABASE_PATH=./data/patrimonio.db

# Servidor
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT
APP_JWT_SECRET=sua-chave-secreta-aqui-mude-em-producao

# Google OAuth
GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com

# Admin
ADMIN_EMAIL=seu-email@empresa.com
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=seu-google-client-id.apps.googleusercontent.com
```

## Fluxo de Autenticação Implementado

### 1. **Google OAuth Login**
- Usuário clica em "Fazer login com Google"
- Google Sign-In retorna credencial (ID token)
- Frontend envia para `POST /api/auth/google`
- Backend valida token com Google
- Sistema cria/atualiza usuário no DB

### 2. **Estados de Autenticação**
- **Não autenticado**: Exibe tela de login
- **Pendente aprovação**: Exibe mensagem "Aguardando aprovação do administrador"
- **Aprovado**: Acesso completo ao sistema

### 3. **Sistema de Tokens (Access + Refresh)**
- **Access Token JWT**: 15 minutos, armazenado em cookie HttpOnly
- **Refresh Token**: 30 dias, hash SHA-256 armazenado no DB
- **Rotação automática**: Ao expirar, cliente usa refresh para renovar
- **Revogação real**: Admin pode revogar acesso imediatamente via DB

### 4. **Proteção de Rotas**
- Middleware `requireAuth`: Valida access token, renova se expirado
- Middleware `requireAdmin`: Verifica se usuário é admin
- Todas rotas de API protegidas exceto `/auth/*` e `/health`

### 5. **Gestão de Usuários (Admin)**
Painel Admin permite:
- Listar usuários pendentes de aprovação
- Aprovar usuário individual
- Revogar acesso (invalida todas as sessões)
- Promover usuário a admin

## Banco de Dados

### Tabelas Novas
- **users**: email (unique), name, google_id, is_admin, is_approved, timestamps
- **refresh_tokens**: user_id (FK), token_hash, expires_at, timestamps

### Índices
- `idx_users_email`
- `idx_users_google_id`
- `idx_refresh_tokens_user_id`
- `idx_refresh_tokens_hash`

## API Endpoints

### Autenticação (Público)
- `POST /api/auth/google` - Login com Google (credencial)
- `GET /api/auth/me` - Obter usuário atual (com auto-renovação)
- `POST /api/auth/refresh` - Renovar tokens
- `POST /api/auth/logout` - Logout (invalida refresh atual)
- `POST /api/auth/logout-all` - Logout em todos os dispositivos

### Admin (Requer auth + admin)
- `GET /api/admin/pending-users` - Listar pendentes
- `POST /api/admin/approve/:userId` - Aprovar usuário
- `POST /api/admin/revoke/:userId` - Revogar acesso
- `POST /api/admin/promote/:userId` - Promover a admin

### Dados (Requer auth + approved)
- `GET /api/assets` - Lista de ativos
- `POST/PUT/DELETE /api/assets` - CRUD de ativos
- Demais rotas protegidas...

## Seed Automático

Na inicialização do servidor:
1. Cria tabelas se não existirem
2. Verifica se `ADMIN_EMAIL` está configurado
3. Se não existir usuário com esse email, cria como admin pré-aprovado
4. Se existir, garante que é admin e aprovado

## Frontend Components

### AuthGate (`src/components/AuthGate.tsx`)
- Wrapper que protege toda a aplicação
- Gerencia 3 estados de autenticação
- Google Sign-In button
- Auto-renovação de tokens

### AdminPanel (`src/components/AdminPanel.tsx`)
- Interface para gestão de usuários
- Listar, aprovar, revogar, promover
- Feedback visual do status

### App.tsx Integration
- ViewMode.ADMIN adicionado
- Botão Admin visível apenas para admins
- Menu de usuário com informações e logout
- Chamadas de API com `credentials: 'include'`

## Segurança

✅ Tokens em cookies HttpOnly (proteção contra XSS)
✅ CSRF token automático via SameSite
✅ Hashing de refresh tokens no DB (SHA-256)
✅ Renovação automática de tokens
✅ Revogação real de sessões
✅ Admin seed obrigatório por ENV
✅ Mensagens de erro genéricas

## Próximos Passos Opcionais

1. **Cleanup de tokens**: Job cron para deletar tokens expirados
2. **Auditoria**: Tabela `audit_log` para rastrear ações
3. **Detecção de roubo**: Invalidar todas as sessões se refresh usado 2x
4. **Whitelist de domínios**: Auto-aprovar @empresa.com
5. **2FA**: Adicionar autenticação de dois fatores
