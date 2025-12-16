Obrigado! Vou propor um plano claro para adicionar login Google, proteger todas as rotas e introduzir aprovação por admin.

## Plan: Autenticação Google + Aprovação Admin

Implementar Google Sign-In no frontend e validação de ID Token no backend, emitindo sessão JWT em cookie HttpOnly. Criar tabela `users` (admin/approved), seedar um admin inicial por ENV, bloquear todas as rotas por um `requireAuth` global e permitir acesso apenas a usuários aprovados. No frontend, um `AuthGate` controla o fluxo (login, pendente, aprovado) e todas as chamadas passam a incluir cookies.

### Steps
1. Criar rotas de auth e sessão: adicionar `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` em backend/src/app.ts montando um router `auth` antes das rotas protegidas; usar `google-auth-library` e `APP_JWT_SECRET`.
2. Adicionar middleware `requireAuth`: criar `requireAuth()` (novo arquivo backend/src/middleware/auth.ts) que valida cookie `session` (JWT), injeta `req.user`, e bloqueia `!is_approved`; aplicar em backend/src/app.ts para `/patrimonio/api/*` exceto `/patrimonio/api/auth/*` e `/patrimonio/health`.
3. Estender camada de dados: em backend/src/services/dbService.ts criar tabela `users` e métodos `getUserByEmail()`, `createOrUpdateUser()`, `approveUser()`, `listPendingUsers()`; tipar `User` em backend/src/models/types.ts.
4. Seed do admin: após init do DB em backend/src/server.ts ou em backend/src/services/dbService.ts, criar/atualizar admin com `ADMIN_EMAIL` (flags `is_admin=1`, `is_approved=1`).
5. Proteger rotas existentes: garantir que routers de backend/src/routes/assets.ts, backend/src/routes/conferences.ts e backend/src/routes/ai.ts passem por `requireAuth()` via aplicação global em backend/src/app.ts.
6. Frontend AuthGate + API: criar `AuthGate` em frontend/src/components/AuthGate.tsx para GSI (usa `VITE_GOOGLE_CLIENT_ID`), estado (logado/aprovado/pendente), e envolver em frontend/src/App.tsx; ajustar frontend/src/services/apiService.ts para `credentials: 'include'` e incluir `loginWithGoogle()`, `getMe()`, `logout()`.

### Further Considerations
1. Sessão: Cookie HttpOnly (`session`) é ok? Alternativa: header `Authorization` (menos seguro no browser).
2. Bootstrap admin: Confirmar `ADMIN_EMAIL` por `.env` backend; outra opção é primeiro usuário vira admin.
3. UX de aprovação: Exibir “Aguardando aprovação” (bloquear chamadas) ou liberar modo somente leitura?
