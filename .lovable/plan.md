## Objetivo
Permitir que o gestor/RH exclua permanentemente uma solicitação de ajuste de ponto incorreta (como a da Cacilda) direto da tela `Ponto → Ajustes`.

## Escopo
- Apenas gestor/RH (papéis com permissão de aprovar ajustes).
- Exclusão **permanente** do registro em `ponto_ajustes` (sem soft delete).
- Funciona em qualquer status (pendente, aprovado, rejeitado), permitindo limpar lixo histórico.

## Mudanças

### 1. Banco (`supabase/migrations/...`)
- Ajustar política RLS de `ponto_ajustes` para liberar `DELETE` a usuários do tenant com perfil gestor/RH (mesma regra usada hoje em "aprovar/rejeitar").
- O trigger atual `bloquear_delete_ponto` é em `ponto_marcacoes`/`ponto_diario`, não afeta `ponto_ajustes` — sem conflito.
- Registrar a exclusão em `ponto_audit_log` via trigger `AFTER DELETE` em `ponto_ajustes` para preservar rastreabilidade mesmo com hard delete.

### 2. Hook `src/hooks/usePonto.ts`
- Adicionar mutation `excluirAjuste({ ajusteId })` que faz `DELETE` em `ponto_ajustes` e invalida a query `ponto-ajustes-pendentes`.
- Exportar `excluirAjuste` e `excluindoAjuste` no retorno do hook.

### 3. UI — `src/components/ponto/AjustesAprovacaoPlanilha.tsx`
- Adicionar ícone `Trash2` ao lado dos botões Aprovar/Rejeitar em cada linha de ajuste.
- Clique abre o `ConfirmDialog` global (padrão do projeto) com texto:
  > "Excluir permanentemente a solicitação de ajuste? Esta ação não pode ser desfeita."
- Confirmação chama `excluirAjuste({ ajusteId })`.
- Toast de sucesso: "Ajuste excluído."

### 4. Propagação
- `PontoAjustesTab.tsx` e página `Ponto.tsx` passam a nova função `excluirAjuste` para baixo via props.

## Como a Cacilda resolve o caso atual
Após o deploy, o gestor entra em **Ponto → Ajustes**, localiza a linha da Cacilda do dia 08/06, clica no ícone de lixeira vermelho, confirma e o ajuste some.

## Validação
- Excluir um ajuste pendente, conferir que desaparece da lista e que o contador "Pendentes (Dias)" atualiza.
- Conferir entrada em `ponto_audit_log` com `acao = 'EXCLUSAO_AJUSTE'`.
- Garantir que colaborador comum (sem permissão de aprovação) não vê o botão.
