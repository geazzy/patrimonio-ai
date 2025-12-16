# Guia de Configuração: JWT Secret, Google OAuth e Gemini API

Este guia descreve como obter as três credenciais necessárias para rodar o **Patrimonio AI**.

---

## 1️⃣ APP_JWT_SECRET (Chave de Assinatura de Tokens)

O `APP_JWT_SECRET` é uma chave criptográfica que assina e valida tokens JWT de autenticação.

### Gerar a Chave

Escolha uma das opções:

#### Opção A: Node.js (Recomendado)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Opção B: OpenSSL
```bash
openssl rand -hex 32
```

#### Opção C: Python
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Resultado
Você receberá uma string de 64 caracteres hexadecimais:
```
918213a0957eb8b12707a7d0c393e39089627dffec00c883160c14b5b2047224
```

### Configurar no .env
```env
APP_JWT_SECRET=918213a0957eb8b12707a7d0c393e39089627dffec00c883160c14b5b2047224
```

### ⚠️ Segurança
- **Desenvolvimento**: Use a chave gerada acima
- **Produção**: Gere uma **nova** chave única com `randomBytes(64)` (128 caracteres)
- **Nunca** commit no Git
- **Mude** em cada ambiente (dev, staging, prod)

---

## 2️⃣ GOOGLE_CLIENT_ID (Autenticação Google)

Permite login via Google OAuth 2.0 no sistema.

### Passo 1: Acessar Google Cloud Console

1. Abra [https://console.cloud.google.com](https://console.cloud.google.com)
2. Faça login com sua conta Google (será o ADMIN_EMAIL)

### Passo 2: Criar Novo Projeto

1. No topo, clique no **seletor de projetos**
2. Clique **"NEW PROJECT"**
3. Digite: `PatrimonioAI`
4. Clique **"CREATE"**
5. Espere a criação completar

### Passo 3: Criar Credenciais OAuth 2.0

1. No menu lateral, vá para **APIs & Services > Credentials**
2. Clique **"+ CREATE CREDENTIALS"** no topo
3. Selecione **"OAuth client ID"**
4. Se pedir para configurar "OAuth consent screen":
   - Selecione **"External"**
   - Clique **"CREATE"**
   - Preencha:
     - **App name**: PatrimonioAI
     - **User support email**: seu-email@gmail.com
     - **Developer contact**: seu-email@gmail.com
   - Clique **"SAVE AND CONTINUE"**
   - Pule as próximas seções (padrão ok)
   - Clique **"BACK TO DASHBOARD"**

### Passo 4: Configurar Web Application

1. Volte para **APIs & Services > Credentials**
2. Clique **"+ CREATE CREDENTIALS"**
3. Selecione **"OAuth client ID"**
4. **Application type**: `Web application`
5. **Name**: `PatrimonioAI Web Client`

### Passo 5: Adicionar URIs Autorizados

**Authorized JavaScript origins:**
```
http://localhost:3000
http://localhost
```

**Authorized redirect URIs:**
```
http://localhost:3000
```

6. Clique **"CREATE"**

### Resultado

Uma modal aparecerá com:
```
Client ID: 731147353712-0ucib01oneduciscsnjta7rbka04ibqa.apps.googleusercontent.com
Client secret: (você não precisa deste para o frontend)
```

### Configurar no .env

**Backend (.env):**
```env
GOOGLE_CLIENT_ID=731147353712-0ucib01oneduciscsnjta7rbka04ibqa.apps.googleusercontent.com
```

**Frontend (.env.local):**
```env
VITE_GOOGLE_CLIENT_ID=731147353712-0ucib01oneduciscsnjta7rbka04ibqa.apps.googleusercontent.com
```

### ⚠️ Segurança
- Client ID **é público** (ok expor no frontend)
- **Nunca** exponha Client Secret
- Altere URIs ao fazer deploy (prod, staging)

---

## 3️⃣ GEMINI_API_KEY (Google Gemini AI)

Permite usar a IA generativa do Google para consultas no sistema.

### Passo 1: Acessar Google AI Studio

1. Abra [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Faça login com sua conta Google

### Passo 2: Criar API Key

1. Clique **"Create API key"** ou **"Get API key"**
2. Selecione o projeto criado anteriormente (PatrimonioAI)
3. Clique **"Create API key in new project"** se necessário
4. Uma chave será gerada automaticamente

### Resultado

Você receberá algo como:
```
AIzaSyBKQSqHjr3Z7pmgw8dmrVOzItTxlRh6cC4
```

### Configurar no .env

**Backend (.env):**
```env
GEMINI_API_KEY=AIzaSyBKQSqHjr3Z7pmgw8dmrVOzItTxlRh6cC4
```

### ⚠️ Segurança
- **Nunca** commit no Git
- **Nunca** compartilhe a chave
- Você pode **revogar** a chave a qualquer momento em Google AI Studio
- Para produção, use **credenciais de serviço** (mais seguro)

### Limite de Uso
- Google oferece uso **gratuito** limitado
- Monitore seu uso em [Google Cloud Console > Billing](https://console.cloud.google.com/billing)

---

## 📋 Resumo: Arquivo .env Completo

Após seguir todos os passos, seu `backend/.env` deverá ter:

```env
# API Configuration
PORT=3001
GEMINI_API_KEY=AIzaSyBKQSqHjr3Z7pmgw8dmrVOzItTxlRh6cC4

# Database Configuration
DATABASE_PATH=./database/patrimonio.db

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# JWT
APP_JWT_SECRET=918213a0957eb8b12707a7d0c393e39089627dffec00c883160c14b5b2047224

# Google OAuth
GOOGLE_CLIENT_ID=731147353712-0ucib01oneduciscsnjta7rbka04ibqa.apps.googleusercontent.com

# Admin
ADMIN_EMAIL=zanonigb@gmail.com
```

E seu `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_CLIENT_ID=731147353712-0ucib01oneduciscsnjta7rbka04ibqa.apps.googleusercontent.com
```

---

## ✅ Checklist Final

- [ ] APP_JWT_SECRET gerado e configurado
- [ ] Google Cloud Project criado
- [ ] OAuth 2.0 Client ID criado
- [ ] URIs autorizadas configuradas
- [ ] GOOGLE_CLIENT_ID copiado para backend e frontend
- [ ] GEMINI_API_KEY obtida do Google AI Studio
- [ ] GEMINI_API_KEY configurada no backend
- [ ] ADMIN_EMAIL configurado
- [ ] Nenhuma chave foi commitada no Git
- [ ] .env está no .gitignore

---

## 🚀 Próximo Passo

Após configurar tudo, execute:

```bash
# Backend
cd backend
npm start

# Frontend (nova aba do terminal)
cd frontend
npm run dev
```

Acesse `http://localhost:3000` e faça login com sua conta Google!

---

## 🔗 Referências

- [Google Cloud Console](https://console.cloud.google.com)
- [Google AI Studio (Gemini)](https://makersuite.google.com/app/apikey)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [JWT.io - Decodificar tokens](https://jwt.io)

---

## ❓ Troubleshooting

| Problema | Solução |
|----------|---------|
| "GOOGLE_CLIENT_ID not configured" | Verificar `.env` e `.env.local` |
| "Credencial do Google não recebida" | Verificar VITE_GOOGLE_CLIENT_ID no frontend |
| "API key has not been activated" | Habilitar Gemini API em Google Cloud Console |
| Login falha com erro 403 | Verificar URIs autorizadas no OAuth consent screen |
| Token expirado rapidamente | Verificar APP_JWT_SECRET está configurado |

