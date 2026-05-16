## Objetivo
Adicionar ações de **Editar** e **Excluir** em cada linha da tabela "Leads da Landing Page" no painel `/admin` (aba Landing).

## Escopo
- Arquivo principal: `src/components/admin/LandingLeadsTable.tsx`
- Tabela `landing_leads` no Supabase
- Exclusão restrita a Super Admin (`useSuperAdmin`)

## O que será feito

**1. Nova coluna "Ações" na tabela**
- Botão **Editar** (ícone `Edit`) — visível para qualquer admin que já acessa `/admin`
- Botão **Excluir** (ícone `Trash2`, vermelho) — visível apenas se `isSuperAdmin === true`

**2. Modal de edição (campos básicos de contato)**
Dialog do shadcn com os campos:
- Nome, E-mail, Telefone
- Empresa, Cargo, Setor, Nº de funcionários

Salvar dispara `UPDATE landing_leads SET ... WHERE id = ?` e invalida a query `landing-leads` do React Query.

**3. Exclusão com confirmação**
- Usa o `ConfirmDialog` global (padrão do projeto, conforme memória)
- Texto: "Excluir permanentemente o lead {nome}? Esta ação não pode ser desfeita."
- Dispara `DELETE FROM landing_leads WHERE id = ?` e invalida a query

**4. Segurança (RLS)**
Verificar/garantir políticas em `landing_leads`:
- `UPDATE`: permitido para usuários com role `admin` ou `owner`
- `DELETE`: permitido **apenas** para Super Admin (via `has_role(auth.uid(), 'super_admin')` ou função equivalente já existente)

Se as policies atuais não cobrirem isso, adicionar via migration.

## Detalhes técnicos
- Reaproveitar `useSuperAdmin()` para mostrar/esconder o botão de excluir no frontend (defesa em profundidade — RLS é a barreira real)
- Mutations com `useMutation` + `queryClient.invalidateQueries(['landing-leads'])`
- Toasts de sucesso/erro via `sonner`
- Sem mexer em outras abas (Empresas, Usuários, CRM Kanban)

## Fora do escopo
- Edição de campos de diagnóstico (perfil, score, urgência, respostas IA)
- Soft delete / arquivamento
- Bulk actions
