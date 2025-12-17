# Plan: Fluxo de aprovação admin para divergências de conferência (Revisado)

Usuários comuns podem iniciar conferências e criar novos locais conforme necessário. As conferências ficam pendentes de aprovação admin que revisa via dashboard. Aprovações são rastreadas; rejeições permitem user corrigir e retentar sem perder o histórico.

## Steps

1. **Estender `ConferenceRecord` com campos de auditoria e status**: Adicionar em `backend/src/models/types.ts` e schema do banco: `status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'`, `createdBy`, `approvedBy`, `approvedAt`, `rejectedBy`, `rejectionReason`, `rejectedAt`, `lastModifiedBy`, `lastModifiedAt`.

2. **Permitir criar novo local no início da conferência**: Modificar tela de SETUP em `frontend/src/components/Conference.tsx` e endpoint em `backend/src/routes/conferences.ts` para permitir usuário comum inserir novo local (com validação: máx 50 caracteres, formato "ANDAR-SETOR"). Novo local é criado no banco antes de iniciar SCANNING.

3. **Modificar fluxo de finalização**: Ao usuário comum terminar SCANNING e gerar REPORT, status fica `PENDING_APPROVAL` ao invés de aplicar mudanças direto. Snapshot de ALIENs e NEWs fica persistido mas não-aplicado no banco.

4. **Criar endpoint de aprovação admin**: `POST /api/conferences/:id/approve` recebe array `{ itemId, action: 'APPROVE' | 'REJECT', rejectionReason? }`. Aplica apenas items aprovados: insere NEWs, atualiza locais de ALIENs, registra em `movement_history` com `conference_id`, `approved_by`, `approval_date`.

5. **Criar dashboard de aprovação pendente para admin**: Componente `frontend/src/components/AdminApprovalPanel.tsx` mostrando badge com contagem de conferências `PENDING_APPROVAL`. Admin vê: ALIENs com antes/depois, NEWs com descrição, checkbox para aceitar/rejeitar cada item, campo de motivo obrigatório para rejeições.

6. **Fluxo de rejeição e retry**: Se conferência rejeitada, muda para `DRAFT` e usuário comum recebe notificação no dashboard. Pode visualizar motivos de rejeição, corrigir scans e resubmeter a mesma conferência (aproveita snapshot anterior, permite reeditar).

7. **Registrar auditoria completa**: Todo approve/reject registra em `movement_history`: `conference_id`, `action`, `decided_by`, `decision_date`, `reason` (se rejeitado). Nunca expira; histórico permanente.

## Decisões de Negócio

- **Quem pode iniciar conferência**: Usuários comuns podem iniciar e criar novo local antes de começar a conferência
- **Notificação ao admin**: Badge no dashboard mostrando quantidade de conferências pendentes de aprovação
- **Timeout de aprovação**: Conferências não expiram; ficam indefinidamente aguardando aprovação
- **Fluxo de rejeição**: Conferência rejeitada volta para estado `DRAFT`, permitindo usuário repetir ou corrigir scans e resubmeter

## Considerações

1. **Validação de novo local**: Formato obrigatório padrão "ANDAR-SETOR", ex "E-101", maiúsculas, 5-10 caracteres

2. **Fluxo visual para usuário rejeitado**: Mostrar na tela de relatório quais items foram rejeitados e por quê, com motivo expandível em tooltip/modal

3. **Admin pode editar motivo de rejeição**: Motivo é imutável uma vez definido para manter auditoria. Se admin mudar de ideia, cria novo reject com novo motivo
