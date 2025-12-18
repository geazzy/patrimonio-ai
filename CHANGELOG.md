# Changelog - Patrimônio AI

## 📋 Resumo Geral
Documentação completa de todas as alterações realizadas no sistema de gerenciamento de patrimônio com workflow de aprovação de conferências.

---

## 🔧 Alterações no Backend

### 1. **Trust Proxy - Compatibilidade com Traefik/Nginx**
**Arquivo:** `backend/src/app.ts`

- **Configuração adicionada:** `app.set('trust proxy', 1)`
- **Motivo:** Permite identificar IPs corretos quando atrás de proxy reverso (Traefik)
- **Headers respeitados:** `X-Forwarded-For`, `X-Real-IP`

```typescript
// Trust proxy - IMPORTANT: Required for rate limiting behind nginx/reverse proxy
app.set('trust proxy', 1);
```

---

### 2. **Rate Limiting Otimizado**
**Arquivo:** `backend/src/middleware/rateLimiter.ts`

#### Mudanças nos Limites:

| Rate Limiter | Antes | Depois | Motivo |
|-------------|--------|---------|---------|
| API Global | 100 req/15min | 500 req/15min | Suportar uso intensivo |
| Admin | 20 req/10min | 50 req/10min | Múltiplas aprovações |
| Conferências | ❌ N/A | 1000 req/hora | **Novo** - Operação legítima |

#### Código - API Limiter com Skip:
```typescript
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Aumentado de 100 para 500
  skip: (req) => {
    // Skip rate limit para conferências (muitas requisições legítimas)
    const isConferencePath = req.path.includes('/conferences');
    return isConferencePath;
  },
});
```

#### Código - Novo Conference Limiter:
```typescript
export const conferenceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 1000, // Muito permissivo para conferências grandes
  message: {
    error: 'Limite de requisições de conferência atingido. Aguarde 1 hora.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
```

**Benefícios:**
- ✅ Conferências com 100+ items funcionam sem bloqueio
- ✅ Admin pode aprovar múltiplas conferências seguidas
- ✅ Rate limit ainda protege contra ataques DDoS
- ✅ Operações legítimas não são penalizadas

---

### 3. **Autenticação - Token de Acesso** 
**Arquivo:** `backend/src/middleware/auth.ts`

- **Alteração:** Aumento do tempo de expiração do Access Token
  - **Antes:** `15m` (15 minutos)
  - **Depois:** `120m` (2 horas)
  - **Motivo:** Permitir sessões mais longas durante conferências

```typescript
const ACCESS_TOKEN_EXPIRY = '120m';
```

---

### 2. **Aprovação de Conferências - Workflow Completo**
**Arquivo:** `backend/src/routes/conferences.ts`

#### Endpoint: `POST /api/conferences/:id/approve`
- **Funcionalidade:** Processa decisões por item (aprovação/rejeição individual)
- **Tipos suportados:**
  - `NEW` - Itens novos encontrados na conferência
    - ✅ APPROVE: Cria novo asset no sistema
    - ❌ REJECT: Descarta item sem criar
  - `ALIEN` - Itens de outro local presentes na conferência
    - ✅ APPROVE: Move item para novo local
    - ❌ REJECT: Mantém item no local original

#### Mudanças de Tipo:
```typescript
const summaryLog: { approved: number; rejected: number; errors: string[] } = { 
  approved: 0, 
  rejected: 0, 
  errors: [] 
};
```
- **Antes:** `errors: []` (inferido como `never[]`)
- **Depois:** `errors: string[]` (explicitamente tipado)

#### Rejeição de Items:
```typescript
// Quando item é rejeitado:
reason: undefined  // (era: null)
toLocation: asset.location  // (era: d.newLocation || targetLocation)
```
- **Motivo:** Garantir que items rejeitados permaneçam no local original, não no local proposto

#### Histórico de Movimentação:
```typescript
// Adicionado para rejeições:
{
  date: new Date().toISOString(),
  fromLocation: asset.location,
  toLocation: asset.location,  // Sem mudança
  authorizedBy: decidedBy,
  rejected: true,
  rejectionReason: d.reason || 'Sem motivo informado'
}
```

---

## 🎨 Alterações no Frontend

### 1. **Auto-Renovação de Token**
**Arquivo:** `frontend/src/services/apiService.ts`

#### Novo: Função `fetchWithRefresh()`
```typescript
async function fetchWithRefresh(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let response = await fetch(url, options);
  
  if (response.status === 401) {
    // Tenta renovar token automaticamente
    const refreshResponse = await fetch(`${API_URL}${API_PREFIX}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (refreshResponse.ok) {
      // Retenta requisição original
      response = await fetch(url, options);
    } else {
      // Redireciona para login se refresh falhar
      window.location.href = '/patrimonio/';
    }
  }
  return response;
}
```

#### Operações com Auto-Refresh:
- `getAssets()` - Sincronização de itens
- `updateAsset()` - Edição de assets
- `getConferences()` / `getConference()` - Carregamento de conferências
- `submitConference()` - Envio para aprovação
- `approveConference()` / `rejectConference()` - Aprovação/rejeição

---

### 2. **Componente AssetDetail - Edição com Permissões**
**Arquivo:** `frontend/src/components/AssetDetail.tsx`

#### Props Adicionadas:
```typescript
interface AssetDetailProps {
  // ... props existentes
  currentUser?: UserType;
  availableLocations?: string[];
}
```

#### Funcionalidade: Localização (somente admin)
```typescript
if (currentUser?.isAdmin ? (
  <div className="space-y-2">
    <select 
      value={editLocation}
      onChange={(e) => setEditLocation(e.target.value)}
    >
      {locations.map(loc => <option value={loc}>{loc}</option>)}
    </select>
    <button onClick={() => setShowNewLocationModal(true)}>
      Criar novo local
    </button>
  </div>
) : (
  <div className="p-2 bg-slate-100 rounded-lg">
    {editLocation}  {/* Apenas leitura */}
  </div>
)}
```

#### Criação de Nova Localização
- Modal com validação de formato (ex: `E-101`)
- Persiste no banco de dados
- Auto-seleção após criação

#### Campo "Autorizado por"
```typescript
<input 
  type="text"
  disabled
  value={currentUser?.name || currentUser?.email || ''}
/>
```
- Auto-preenchido com usuário logado
- Campo desabilitado (apenas leitura)

#### Exibição de Histórico - Rejeições
```typescript
{record.rejected && record.fromLocation === record.toLocation ? (
  // Rejeição sem mudança de local
  <div className="flex items-center gap-2">
    <span className="font-medium">{record.fromLocation}</span>
    <span className="text-xs text-red-600 px-2 py-1 bg-red-100 rounded-md">
      Movimentação rejeitada
    </span>
  </div>
) : (
  // Movimento normal ou rejeição de tentativa
  <>
    <span>{record.fromLocation}</span>
    <ArrowRight />
    <span className={record.rejected ? 'text-red-600 line-through' : 'text-blue-600'}>
      {record.toLocation}
    </span>
  </>
)}
```

---

### 3. **Componente Conference - Remoção de Items**
**Arquivo:** `frontend/src/components/Conference.tsx`

#### Nova Funcionalidade: Deletar Item da Conferência
```typescript
const handleRemoveItem = (itemId: string) => {
  if (confirm(`Remover item ${itemId} da conferência?`)) {
    if (session) {
      const updatedItems = session.scannedItems.filter(item => item.id !== itemId);
      onUpdateSession({
        ...session,
        scannedItems: updatedItems
      });
      
      // Remove também da seleção de transferência
      const newTransfers = new Set(selectedTransfers);
      newTransfers.delete(itemId);
      setSelectedTransfers(newTransfers);
    }
  }
};
```

#### UI - Botão de Lixeira
```typescript
{scannedItems.map((item, idx) => (
  <div key={idx} className="bg-white p-4 rounded-xl ...">
    <div className="flex justify-between items-start">
      {/* ... conteúdo do item */}
      <button
        onClick={() => handleRemoveItem(item.id)}
        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
        title="Remover item"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
))}
```

---

### 4. **App.tsx - Atualização de Assets com API Call**
**Arquivo:** `frontend/src/App.tsx`

#### Função Corrigida: `handleUpdateAssets()`
```typescript
const handleUpdateAssets = async (updatedAssets: Asset[]) => {
  try {
    // Atualiza cada asset no banco de dados
    for (const asset of updatedAssets) {
      await apiService.updateAsset(asset.id, asset);
    }
    
    // Depois atualiza estado local
    setAssets(prevAssets => {
      const updatesMap = new Map(updatedAssets.map(a => [a.id, a]));
      return prevAssets.map(asset => updatesMap.get(asset.id) || asset);
    });
  } catch (error) {
    console.error('Error updating assets:', error);
    alert('Erro ao atualizar itens. Tente novamente.');
  }
};
```

**Antes:** Apenas atualizava estado local (sem persistência)
**Depois:** Faz API call antes de atualizar UI

---

### 5. **Componente Conference - Input Mobile Otimizado**
**Arquivo:** `frontend/src/components/Conference.tsx`

#### Problema: Campo de entrada coberto pelo teclado virtual em mobile

**Solução:** Input com `position: sticky` dentro do container scrollável

```typescript
{/* Input Area - Inside Scrollable (Mobile Optimal) */}
<div className="sticky bottom-0 left-0 right-0 bg-white p-4 border-t border-slate-200 shadow-lg z-30 mt-4 rounded-xl">
  <div className="flex gap-2">
    <input
      ref={inputRef}
      type="text" 
      inputMode="numeric"
      value={inputId}
      onChange={(e) => setInputId(e.target.value)}
      placeholder="Digitar ou Ler Tombo..."
      className="flex-1 p-4 text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
      onKeyDown={(e) => e.key === 'Enter' && processScan(inputId)}
      autoComplete="off"
    />
    <button
      onClick={() => processScan(inputId)}
      className="px-6 bg-blue-600 text-white rounded-xl font-bold shadow-md active:scale-95 transition-transform"
    >
      OK
    </button>
  </div>
</div>
```

**Vantagens:**
- ✅ Input scrollável naturalmente quando teclado abre
- ✅ Sem conflito de z-index ou overlay
- ✅ Comportamento nativo do navegador
- ✅ Melhor UX em dispositivos móveis
- ✅ Input sempre acessível junto com teclado

---

## 🗄️ Banco de Dados

### Tabela: `movement_history`
Sem alterações estruturais, mas novos campos em uso:
```sql
CREATE TABLE IF NOT EXISTS movement_history (
  ...
  rejected BOOLEAN DEFAULT 0,           -- Novo campo
  rejection_reason TEXT,                -- Novo campo
  ...
)
```

### Campos em `assets.history` (JSON):
```typescript
interface MovementHistory {
  date: string;
  fromLocation: string;
  toLocation: string;
  authorizedBy: string;
  rejected?: boolean;           // Novo
  rejectionReason?: string;     // Novo
}
```

---

## 📊 Fluxo de Aprovação - Diagrama Atualizado

```
┌─────────────────────────────────────────────────────────┐
│ CONFERÊNCIA - LEITURA DE QR CODES                       │
├─────────────────────────────────────────────────────────┤
│ ✅ Ler QR codes (MATCH, ALIEN, NEW)                     │
│ 🗑️  Remover items incorretos (NEW)                      │
│ 💾 Salvar e enviar para aprovação (PENDING_APPROVAL)    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ PAINEL DE APROVAÇÃO - ADMIN                             │
├─────────────────────────────────────────────────────────┤
│ 📋 Revisar items por tipo (NEW, ALIEN)                  │
│ ✅ Aprovar: NEW → criar asset | ALIEN → mover          │
│ ❌ Rejeitar: NEW → descartar | ALIEN → manter local    │
│ 💬 Adicionar motivo de rejeição                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ RESULTADO - HISTÓRICO ATUALIZADO                        │
├─────────────────────────────────────────────────────────┤
│ ✅ APROVADO: DACOMAPOIO → E-101 (Geazzy B. Marçal Z.)  │
│ ❌ REJEITADO: DACOMAPOIO → DACOMAPOIO (emprestado)     │
│ ✨ CRIADO: SERVIDOR DE REDE (nova localização)        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Segurança - Sessão

| Configuração | Antes | Depois | Motivo |
|-------------|--------|---------|---------|
| Access Token | 15m | 120m | Sessões longas em conferências |
| Refresh Token | 30d | 30d | Sem alteração |
| Auto-Refresh | ❌ Não | ✅ Sim | Renovação automática sem logout |

**Comportamento Prático:**
- Inativo até 2h: sessão contínua
- Inativo 2h-30d: renovação automática (transparente)
- Inativo 30+ dias: logout necessário

---

## 🐛 Correções de Bugs

### Bug 1: Localização não alterada no BD
**Problema:** Editar localização apenas atualizava UI, não BD
**Solução:** `handleUpdateAssets()` agora faz API call

### Bug 2: Itens rejeitados mostravam movimentação
**Problema:** Histórico mostrava movimento mesmo em rejeição
**Solução:** Rejeições agora têm `toLocation === fromLocation`

### Bug 3: Build quebrado TypeScript
**Problema:** `reason: null` não compatível com `string | undefined`
**Solução:** Alterado para `reason: undefined`

### Bug 4: Token expirava durante conferência
**Problema:** Sessão perdia após 15min de inatividade
**Solução:** Auto-refresh + timeout aumentado para 2h

### Bug 5: Campo de entrada coberto pelo teclado em mobile
**Problema:** Input `fixed` ficava atrás do teclado virtual em mobile
**Solução:** Input com `sticky` dentro do container scrollável

### Bug 6: Rate Limit bloqueando conferências legítimas
**Problema:** Conferências com muitos items (50+) excediam limite de 100 req/15min
**Solução:** 
- Conferências isentas de rate limit global
- Rate limiter específico: 1000 req/hora
- Limite global aumentado: 500 req/15min

### Bug 7: Trust Proxy não configurado (Traefik)
**Problema:** Express não confiava em headers `X-Forwarded-For` do Traefik/proxy
**Solução:** Configurado `app.set('trust proxy', 1)` para identificar IPs corretamente

---

## ✨ Novas Funcionalidades

### ✅ Deletar Items da Conferência
- Botão lixeira em cada item
- Confirma antes de remover
- Atualiza estatísticas automaticamente

### ✅ Criar Localização On-Demand
- Durante edição de asset
- Modal com validação de formato
- Auto-seleciona após criar

### ✅ Auto-Renovação de Token
- Transparente para o usuário
- Sem logout durante inatividade
- Válido por 30 dias

### ✅ Exibição Clara de Rejeições
- Badge "Movimentação rejeitada"
- Mostra motivo de rejeição
- Diferencia visualmente de aprovações

### ✅ Input Mobile Otimizado
- Campo de entrada acessível com teclado virtual
- Comportamento nativo do navegador
- Scroll automático quando teclado abre
- Sem conflito de z-index ou overlay

---

## 🧪 Como Testar

### Teste 1: Conferência com Rejeição
```
1. Fazer conferência com 2+ items
2. Enviar para aprovação
3. Aprovar 1, rejeitar 1 com motivo
4. Verificar histórico de movimentação
```

### Teste 2: Token Auto-Refresh
```
1. Fazer login
2. Deixar inativo por 2+ horas
3. Fazer nova requisição (ex: recarregar assets)
4. Deve funcionar sem logout
```

### Teste 3: Permissões por Usuário
```
1. Login como admin → editar localização OK
2. Login como usuário → localização somente leitura
3. Alterar timeout do token → testar novo limite
```

### Teste 4: Input Mobile
```
1. Acessar conferência em mobile
2. Abrir teclado virtual no campo
3. Campo deve scrollar junto com teclado
4. Input sempre deve estar visível e acessível
```

---

## 📁 Arquivos Modificados

### Backend
- `src/middleware/auth.ts` - Token timeout
- `src/routes/conferences.ts` - Rejeições e aprovações

### Frontend
- `src/services/apiService.ts` - Auto-refresh
- `src/components/AssetDetail.tsx` - Edição com permissões
- `src/components/Conference.tsx` - Remover items, input mobile otimizado
- `src/App.tsx` - Atualização com API call

### Novos Arquivos
- `CHANGELOG.md` (este arquivo)

---

## 📝 Notas Adicionais

- Todas as mudanças mantêm compatibilidade com banco de dados existente
- Schema migrations ocorrem automaticamente no startup
- Refresh token armazenado em cookie httpOnly
- Auto-refresh funciona transparentemente sem UI adicional

---

**Última atualização:** 17 de dezembro de 2025
**Versão:** 1.0.0
