# Rate Limiting - Express Rate Limit

## 📋 Visão Geral

A implementação de rate limiting protege o backend contra ataques de força bruta, DoS (Denial of Service) e abuso de API. O sistema usa `express-rate-limit` com estratégias diferenciadas por tipo de endpoint.

## 🔐 Estratégia Implementada

### 1. **Login Limiter** (Mais Restritivo)
- **Janela**: 15 minutos
- **Limite**: 5 tentativas por IP
- **Endpoints Protegidos**:
  - `POST /api/auth/google` - Login com Google
- **Objetivo**: Prevenir ataques de força bruta em credentials

```typescript
// Máximo 5 tentativas de login a cada 15 minutos
// Após exceder: "Muitas tentativas de login. Tente novamente em 15 minutos."
```

### 2. **Refresh Limiter** (Moderado)
- **Janela**: 5 minutos
- **Limite**: 10 tentativas por IP
- **Endpoints Protegidos**:
  - `POST /api/auth/refresh` - Renovação de tokens
- **Objetivo**: Prevenir abuso de renovação de tokens

```typescript
// Máximo 10 renovações de token a cada 5 minutos
// Após exceder: "Muitas solicitações de renovação. Tente novamente em 5 minutos."
```

### 3. **Admin Limiter** (Moderado)
- **Janela**: 10 minutos
- **Limite**: 20 operações por IP
- **Endpoints Protegidos**:
  - `GET /api/admin/pending-users` - Listar usuários pendentes
  - `POST /api/admin/approve/:userId` - Aprovar usuário
  - `POST /api/admin/revoke/:userId` - Revogar acesso
  - `POST /api/admin/promote/:userId` - Promover a admin
- **Objetivo**: Prevenir abuso de operações administrativas

```typescript
// Máximo 20 operações de admin a cada 10 minutos
// Após exceder: "Muitas operações de admin. Tente novamente em 10 minutos."
```

### 4. **API Global Limiter** (Permissivo)
- **Janela**: 15 minutos
- **Limite**: 100 requisições por IP
- **Endpoints Protegidos**: Todos os endpoints em `/api/*`
- **Objetivo**: Proteção geral contra abuso massivo

```typescript
// Máximo 100 requisições a cada 15 minutos por IP
// Após exceder: "Muitas requisições. Tente novamente mais tarde."
```

## 📊 Hierarquia de Rate Limits

```
Global (100/15min)
├── Login (5/15min) - MAIS RESTRITIVO
├── Refresh (10/5min)
├── Admin (20/10min)
└── Outras rotas (submetidas apenas ao global)
```

## 🛠️ Implementação Técnica

### Arquivo: `backend/src/middleware/rateLimiter.ts`

```typescript
import rateLimit from 'express-rate-limit';

// Definição dos limitadores
export const loginLimiter = rateLimit({...});
export const refreshLimiter = rateLimit({...});
export const apiLimiter = rateLimit({...});
export const adminLimiter = rateLimit({...});
```

### Integração nas Rotas

**Authentication Routes** (`src/routes/auth.ts`):
```typescript
router.post('/google', loginLimiter, async (req, res) => {...});
router.post('/refresh', refreshLimiter, (req, res) => {...});
```

**Admin Routes** (`src/routes/admin.ts`):
```typescript
router.use(adminLimiter); // Aplica a TODAS as rotas admin
```

**Global** (`src/app.ts`):
```typescript
app.use('/api/', apiLimiter); // Proteção geral
```

## 📈 Comportamento em Excesso

Quando um cliente excede o limite:
1. Retorna status **429 (Too Many Requests)**
2. Headers incluem informações de limite:
   - `RateLimit-Limit`: limite máximo
   - `RateLimit-Remaining`: requisições restantes
   - `RateLimit-Reset`: timestamp quando reseta
3. Mensagem de erro em JSON:
   ```json
   {
     "error": "Muitas tentativas de login. Tente novamente em 15 minutos.",
     "code": "RATE_LIMIT_EXCEEDED"
   }
   ```

## 🔍 Monitoramento

### Headers de Resposta Inclusos

```
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 1639567890
```

### Logs Recomendados

Adicionar logging para monitorar abusos:

```typescript
// Em produção, registrar tentativas bloqueadas
const loginLimiter = rateLimit({
  // ... config
  onLimitReached: (req, res, options) => {
    console.warn(`⚠️ Rate limit atingido: ${req.ip} - ${req.path}`);
  }
});
```

## ⚙️ Configuração por Ambiente

### Desenvolvimento (`NODE_ENV=development`)

**Skip para localhost:**
```typescript
// loginLimiter pula para localhost (::1)
// Permite desenvolvimento sem limitações
```

### Produção (`NODE_ENV=production`)

- Todos os limitadores ativos
- Cookies com `secure: true`
- Recomenda-se proxy reverso (Nginx/CloudFlare) adicional

## 🛡️ Casos de Uso Protegidos

| Cenário | Proteção |
|---------|----------|
| Brute force de login | ✅ 5 tentativas/15min |
| Ataque de token renewal | ✅ 10 tentativas/5min |
| Abuso de operações admin | ✅ 20 operações/10min |
| Scraping de dados | ✅ 100 requisições/15min |
| DDoS básico | ✅ Rejeita > 100 req/15min |

## 🚀 Melhorias Futuras

1. **Store de Persistência**: Usar Redis em produção
   ```typescript
   import RedisStore from "rate-limit-redis";
   
   const redisClient = redis.createClient();
   const limiter = rateLimit({
     store: new RedisStore({client: redisClient})
   });
   ```

2. **Whitelist Dinâmica**: Adicionar IPs confiáveis
   ```typescript
   skip: (req) => trustedIPs.includes(req.ip)
   ```

3. **Rate Limit por User**: Após autenticação
   ```typescript
   keyGenerator: (req) => {
     return req.user?.id || req.ip;
   }
   ```

4. **Alertas**: Notificar admins de padrões suspeitos
   ```typescript
   onLimitReached: async (req) => {
     await emailAdmin(`⚠️ Limite atingido: ${req.ip}`);
   }
   ```

## 📝 Testes Recomendados

### Teste de Login Limiter

```bash
# Fazer 6 requisições em sequência
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/google \
    -H "Content-Type: application/json" \
    -d '{"credential": "test"}'
  echo "Tentativa $i"
done

# Esperado: 6ª requisição retorna 429
```

### Teste de Global Limiter

```bash
# Fazer 101 requisições
for i in {1..101}; do
  curl http://localhost:3001/api/assets
done

# Esperado: ~101ª requisição retorna 429
```

## ✅ Verificação de Implementação

```bash
# Verificar se express-rate-limit está instalado
npm list express-rate-limit

# Deve retornar:
# └── express-rate-limit@8.2.1
```

## 🔒 Comparação com Vulnerabilidades Anteriores

| Vulnerabilidade | Antes | Depois |
|-----------------|-------|--------|
| Brute force no login | ⚠️ Possível | ✅ Bloqueado |
| Abuso de renovação | ⚠️ Possível | ✅ Bloqueado |
| Abuso de admin | ⚠️ Possível | ✅ Bloqueado |
| DDoS básico | ⚠️ Possível | ✅ Reduzido |
| Taxa limite comunicada | ❌ Não | ✅ Sim (headers) |

## 📚 Referências

- [express-rate-limit Documentation](https://github.com/nfriedly/express-rate-limit)
- [MDN: HTTP Status 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [OWASP: Brute Force Protection](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#brute-force-protection)

---

**Versão**: 1.0  
**Data**: 16 de dezembro de 2025  
**Status**: ✅ Implementado e Funcional
