# Guia de Teste - Autenticação Google + Aprovação Admin

## Pré-requisitos

1. **Google OAuth Setup**
   - Criar projeto no [Google Cloud Console](https://console.cloud.google.com)
   - Habilitar Google+ API
   - Criar credenciais OAuth 2.0 (Web Application)
   - Adicionar `http://localhost:3000` às origens autorizadas
   - Adicionar `http://localhost:3000/api/auth/google` aos URIs de redirecionamento

2. **Variáveis de Ambiente**
   ```bash
   # Backend/.env
   ADMIN_EMAIL=seu-email-pessoal@gmail.com
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   APP_JWT_SECRET=dev-secret-change-in-prod
   
   # Frontend/.env.local
   VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   ```

## Cenários de Teste

### 1. **Teste de Login Inicial (Admin)**
- [ ] Parar os servidores anteriores
- [ ] Deletar `data/patrimonio.db` (reset do banco)
- [ ] Iniciar backend: `cd backend && npm start`
- [ ] Verificar logs: "✅ Admin user created: seu-email-pessoal@gmail.com"
- [ ] Iniciar frontend: `cd frontend && npm run dev`
- [ ] Página deve mostrar tela de login
- [ ] Clicar no botão "Sign in with Google"
- [ ] Fazer login com `ADMIN_EMAIL`
- [ ] Deve ir direto para o app (approved)
- [ ] Menu lateral deve mostrar "Gerenciar Usuários" (admin)

### 2. **Teste de Login de Novo Usuário (Pendente)**
- [ ] Nova aba/janela incógnita
- [ ] Fazer login com outro email Google diferente
- [ ] Deve mostrar "Aguardando aprovação do administrador"
- [ ] Não deve ter acesso ao app

### 3. **Teste de Aprovação**
- [ ] Voltar à aba do admin
- [ ] Clicar em "Gerenciar Usuários"
- [ ] Deve ver o novo usuário na lista com status "Pendente"
- [ ] Clicar "Aprovar"
- [ ] Volta à aba do novo usuário
- [ ] Fazer refresh (F5) na página "Aguardando aprovação"
- [ ] Deve agora estar no app com acesso total
- [ ] Menu NOT deve mostrar "Gerenciar Usuários" (não é admin)

### 4. **Teste de Promoção a Admin**
- [ ] Voltar ao admin
- [ ] Ir para "Gerenciar Usuários"
- [ ] Clicar "Admin" no usuário aprovado
- [ ] Volta à aba do usuário
- [ ] Fazer refresh
- [ ] Deve agora ver "Gerenciar Usuários" no menu

### 5. **Teste de Revogação**
- [ ] Admin revoga acesso do segundo usuário
- [ ] Segunda aba fica com erro ao tentar fazer requisição
- [ ] Fazer logout/login tenta ir para "Aguardando aprovação"
- [ ] Refresh tokens do usuário foram deletados

### 6. **Teste de Logout**
- [ ] Admin clica em botão "Sair" (rodapé do menu)
- [ ] Volta à tela de login
- [ ] Fazer login novamente deve funcionar normalmente

### 7. **Teste de Logout-All**
- [ ] Admin faz login em 2 abas diferentes
- [ ] Em uma aba, clica "Sair" (logout simples)
- [ ] Outra aba deve continuar funcionando
- [ ] (Funcionalidade Logout-All é endpoint, não há botão UI por padrão)

### 8. **Teste de Auto-renovação**
- [ ] Admin faz login
- [ ] Espera 15+ minutos (ou simule editar cookie access_token para expirado)
- [ ] Tenta fazer uma requisição (ex: carregar assets)
- [ ] Deve funcionar (renovado automaticamente)

### 9. **Teste de Persistência**
- [ ] Admin faz login
- [ ] Fecha navegador completamente
- [ ] Reabre: `localhost:3000`
- [ ] Deve ir direto para o app (refresh token válido)

### 10. **Teste de Erro 403 sem Aprovação**
- [ ] Usuário não aprovado tenta acessar `/api/assets` diretamente (via console)
- [ ] Deve retornar: `{ "error": "Aguardando aprovação do administrador" }`

## Verificações de Banco de Dados

```bash
# Abrir SQLite
sqlite3 data/patrimonio.db

# Verificar tabelas
.tables

# Ver usuários
SELECT id, email, name, is_admin, is_approved FROM users;

# Ver tokens de refresh (não verifica valor, hash está armazenado)
SELECT user_id, expires_at FROM refresh_tokens LIMIT 5;

# Contar registros
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM refresh_tokens;
```

## Logs Esperados

### Backend Startup
```
Database initialized successfully
Database connection verified
✅ Admin user created: seu-email-pessoal@gmail.com
Server running on http://localhost:3001
```

### Login bem-sucedido
```
# No navegador - Network tab:
POST /patrimonio/api/auth/google → 200 OK
Set-Cookie: access_token=...; HttpOnly
Set-Cookie: refresh_token=...; HttpOnly
```

### Acesso a rota protegida
```
GET /patrimonio/api/assets
→ 200 OK com lista de ativos
```

### Acesso sem aprovação
```
POST /patrimonio/api/auth/google → 403
{
  "error": "Aguardando aprovação do administrador",
  "user": {
    "id": "...",
    "email": "...",
    "isApproved": false
  }
}
```

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| "GOOGLE_CLIENT_ID not configured" | Variável não setada | Configurar `.env` |
| "Credencial do Google não recebida" | Campo credential vazio | Configurar VITE_GOOGLE_CLIENT_ID correto |
| Token expirou e não renova | Refresh token inválido | Fazer logout e login novamente |
| Admin user não criado | ADMIN_EMAIL não setado | Adicionar ao `.env` e restart |
| Usuário aprovado mas bloqueado | Cache do navegador | Limpar cookies e fazer logout/login |

## Checklist Final

- [ ] Backend compila sem erros
- [ ] Frontend compila sem erros
- [ ] Google OAuth configurado
- [ ] `.env` do backend com todas as variáveis
- [ ] `.env.local` do frontend com Google Client ID
- [ ] Banco de dados resetado
- [ ] Servidor rodando na porta 3001
- [ ] Frontend rodando na porta 3000
- [ ] Botão "Sign in with Google" aparece
- [ ] Login com ADMIN_EMAIL funciona
- [ ] Admin vê menu "Gerenciar Usuários"
- [ ] Novo usuário fica pendente
- [ ] Admin consegue aprovar usuário
