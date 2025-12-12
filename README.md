# PatrimonioView AI

## Visão Geral
O **PatrimonioView AI** é uma aplicação web (SPA) desenvolvida para a gestão, visualização e auditoria de patrimônio físico. O sistema permite a importação de relatórios em PDF (OCR), visualização de dados em dashboards, interação via chat com IA (Google Gemini) e realização de conferências (auditorias) de bens in loco através de uma interface mobile-first.

## Stack Tecnológica
- **Frontend**: React 19, TypeScript.
- **Estilização**: Tailwind CSS.
- **Visualização de Dados**: Recharts.
- **IA**: Google GenAI SDK (Gemini 2.5 Flash).
- **Processamento de PDF**: PDF.js (via CDN cdnjs para evitar erros de Worker/CORS).
- **Persistência**: `localStorage` (Simulando um banco de dados relacional).
- **Gerenciamento de Pacotes**: ES Modules via `esm.sh` (no-bundler setup).

---

## Regras de Negócio e Funcionalidades

### 1. Entidade Principal: `Asset` (Bem Patrimonial)
O sistema gira em torno da interface `Asset`. O campo `id` (Tombo) é a chave única.
- **Campos Chave**: ID, Descrição, Valor, Localização, Responsável, Categoria, Histórico de Movimentação.
- **Categorização Automática**: Ao importar, o sistema infere a categoria (Informática, Mobiliário, etc.) baseada em palavras-chave da descrição.

### 2. Importação de Dados (PDF)
O sistema não substitui o banco de dados cegamente; ele utiliza uma estratégia de **"Upsert" com Resolução de Conflitos**:
1.  **Extração**: Texto extraído do PDF mantendo layout visual para parser via Regex.
2.  **Identificação**:
    *   **Novos**: IDs que não existem no banco -> Inserção automática sugerida.
    *   **Conflitos**: IDs existentes onde dados sensíveis (principalmente `Localização` e `Valor`) divergem do banco.
3.  **Interface de Resolução**: O usuário decide se mantém o dado atual ("Manter Original") ou aceita o do PDF ("Atualizar") para os conflitos.

### 3. Conferência (Auditoria Mobile)
Módulo desenhado para uso em tablets/celulares durante a verificação física.
- **Fluxo**:
    1.  Usuário seleciona o **Local Alvo**.
    2.  Escaneia/Digita o Tombo.
- **Estados de Leitura**:
    *   🟢 **MATCH**: O item pertence ao local alvo.
    *   🟠 **ALIEN (Divergente)**: O item é de outro local. Usuário pode optar por **transferir** o item para o local atual ao final da sessão.
    *   🔵 **NEW (Sobras)**: O item não existe no banco. É cadastrado como novo item ao finalizar.
- **Finalização e Histórico**:
    *   Ao salvar, gera um `ConferenceRecord` persistente.
    *   Itens novos são inseridos no banco principal.
    *   Transferências geram registros no histórico individual do bem.

### 4. Inteligência Artificial (Gemini)
- O sistema envia um resumo contextual dos dados (estatísticas e amostra) para o Gemini.
- Permite perguntas em linguagem natural como "Qual o valor total em cadeiras?" ou "Liste os itens do setor X".

---

## Estrutura de Dados e Persistência

O sistema utiliza o `localStorage` para manter os dados. Existem duas "tabelas" principais:

| Chave Storage | Conteúdo | Descrição |
| :--- | :--- | :--- |
| `patrimonio_db_v1` | `Asset[]` | A lista mestre de todos os bens patrimoniais, contendo estado atual e histórico de movimentações. |
| `patrimonio_conferences_v1` | `ConferenceRecord[]` | Log imutável de todas as conferências finalizadas, incluindo data, estatísticas (resumo) e lista de itens lidos. |

---

## Estrutura de Arquivos Relevante

| Arquivo | Função |
| :--- | :--- |
| `types.ts` | Definições de tipos (Asset, MovementHistory, ConferenceSession, ConferenceRecord). |
| `App.tsx` | Controlador principal. Gerencia o `useEffect` que sincroniza o State com o `localStorage`. |
| `services/pdfService.ts` | Configuração do Worker do PDF.js e extração de texto cru. |
| `services/parser.ts` | Regex para transformar texto OCR em objetos JSON. |
| `components/Conference.tsx` | UI de auditoria. Gerencia estados Scan/Report e visualização do Histórico. |
| `components/ImportPreview.tsx` | UI para resolução de conflitos de importação (Diff & Merge). |

## Observações para Desenvolvimento Futuro (LLM Context)

1.  **Migração de Backend**: Para migrar para um banco real (SQL), basta substituir as chamadas de `localStorage.getItem/setItem` em `App.tsx` por chamadas API (`fetch` ou SDK do Supabase/Firebase). A estrutura de dados JSON já está normalizada.
2.  **Worker PDF**: O arquivo `pdf.worker.min.mjs` deve ser carregado de uma fonte confiável (atualmente `cdnjs`) para evitar erros de CORS.
3.  **Histórico**: Toda mudança de local gera um registro em `Asset.history`.

---
*Gerado automaticamente para documentação do projeto.*