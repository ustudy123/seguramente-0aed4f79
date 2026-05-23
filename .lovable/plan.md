## Promoção de Empresa a Conta-Raiz (Spin-off de Tenant)

Função no Super Admin que pega uma `empresa_cadastro` dentro de um Tenant A (consultoria) e a promove a um novo Tenant B independente, transferindo todos os dados operacionais e o ownership. Migração **definitiva**, sem rollback. Tenant A perde acesso completo após a operação.

---

### Fluxo do usuário (Super Admin)

1. Em `/admin` → aba **Empresas**, no menu de ações de cada empresa-tenant, novo item: **"Promover empresa a Conta-Raiz"**.
2. Wizard `PromoverContaRaizModal` em 4 passos:
   - **Passo 1 — Empresa a promover**: lista as `empresa_cadastro` do Tenant A selecionado. Mostra contadores (colaboradores, documentos, OS) que serão transferidos.
   - **Passo 2 — Dono do novo Tenant**: e-mail + nome completo + slug do novo tenant + plano. Sistema verifica se o e-mail já tem `auth.users`:
     - Se **não existe**: cria via `onboarding-signup` (invite ou senha definida pelo admin).
     - Se **já existe**: reaproveita o `auth.users.id`, cria novo `profiles`/`usuarios_base` vinculado ao novo tenant (sem travar). Avisa visualmente "Este e-mail já tem conta em outro tenant — será criado vínculo adicional".
   - **Passo 3 — Dry-run / Pré-visualização**: edge function retorna contagem de registros que serão migrados por tabela. Sem efeito colateral.
   - **Passo 4 — Confirmação**: digitar nome da empresa para confirmar + checkbox "Entendo que esta operação é definitiva e o tenant de origem perderá acesso".

3. Execução chama edge function `tenant-spinoff` que faz tudo em uma transação. Sucesso → toast + invalidação das queries.

---

### Edge function `tenant-spinoff`

Recebe `{ empresaId, tenantOrigemId, novoTenant: { nome, slug, plano }, owner: { email, nome, password?, inviteMode } }`. Valida que o caller é super admin. Em transação única:

1. **Cria novo tenant** (`tenants` insert).
2. **Cria/reaproveita usuário owner**:
   - Se e-mail novo → `admin.createUser` (ou `inviteUserByEmail`).
   - Se e-mail existente → busca `auth.users.id` e segue.
   - Cria `profiles` (tenant_id = B), `usuarios_base` (tipo `proprietario`), `user_roles` (admin), vínculo total.
3. **Migra todos os registros operacionais** com `empresa_id = X` para `tenant_id = B`:
   - Lista enumerada de ~60 tabelas operacionais (colaboradores, terceiros, gro_riscos, plano_acoes, documentos, atestados, ordens_servico, contratos_aceite, epi_*, ponto_*, ferias_*, pdi_*, avaliacoes_*, incidentes_*, psicossocial_*, ouvidoria_*, feedback_*, metas_*, hub_contabil_*, financeiro_*, trilhas_*, etc.). Script gera a lista a partir do schema (todas as tabelas que têm tanto `tenant_id` quanto `empresa_id`).
   - `UPDATE <tabela> SET tenant_id = B WHERE tenant_id = A AND empresa_id = X`.
4. **Migra a própria `empresa_cadastro`** (`tenant_id` → B, limpa `grupo_economico_id` herdado de A).
5. **Migra arquivos no Storage**: lista objetos em buckets com prefixo `{tenantA}/{empresaX}/...` e move para `{tenantB}/{empresaX}/...` (ou registra no log para job assíncrono se >500 arquivos).
6. **Remove acesso do Tenant A**:
   - Deleta `usuario_vinculos` de usuários de A apontando para `empresa_id = X`.
   - **Não** cria vínculo de consultor (conforme decisão do usuário — acesso futuro só se nova conta-raiz conceder).
7. **Registra auditoria** em nova tabela `tenant_spinoffs` (origem, destino, empresa, executor, contadores migrados, timestamp). Apenas registro histórico, sem snapshot para rollback.

Retorna `{ novoTenantId, ownerUserId, inviteSent, contadores }`.

---

### Mudanças técnicas

**Migração de schema:**
- Nova tabela `tenant_spinoffs` (tenant_origem_id, tenant_destino_id, empresa_id, executado_por, contadores jsonb, status, created_at). RLS: só super admin lê.
- Função SQL `superadmin_spinoff_dry_run(empresa_id uuid)` retorna contagem por tabela.
- Função SQL `superadmin_spinoff_execute(...)` faz os UPDATEs em massa, chamada pela edge function via service role.

**Frontend:**
- `src/components/admin/PromoverContaRaizModal.tsx` — wizard de 4 passos.
- `src/hooks/useSuperAdmin.ts` — adicionar `promoverContaRaiz` mutation + `spinoffDryRun` query.
- `src/pages/admin/SuperAdminDashboard.tsx` — adicionar item no DropdownMenu da aba Empresas (lista de tenants já existe, mas a promoção é por empresa-cadastro dentro do tenant; precisa subview ou novo botão "Ver empresas" no tenant). Mais simples: novo card `PromoverEmpresaPanel` que lista todas as `empresa_cadastro` cross-tenant com filtro por tenant.

**Backend:**
- `supabase/functions/tenant-spinoff/index.ts` — orquestra tudo, valida super admin, chama RPC.

---

### Pontos de atenção

- **Idempotência**: se a edge function falhar no meio, o registro `tenant_spinoffs.status` fica `em_andamento` e impede nova tentativa duplicada. Recuperação manual.
- **E-mail já existente em outro tenant**: criamos um segundo `profiles` para o mesmo `auth.users.id`. O login direciona pelo tenant ativo (já é assim hoje para usuários multi-tenant).
- **Arquivos no Storage**: se a empresa tem muitos atestados/documentos, o move pode demorar. Fazemos síncrono se <500, senão enfileiramos em background e marcamos `migracao_storage_pendente`.
- **`grupos_economicos`**: não migra. A empresa sai do grupo do Tenant A. Se a nova conta-raiz quiser criar seu próprio grupo, faz no fluxo normal.
- **`auth.users`**: não duplicamos. Sempre 1 user = 1 e-mail global. Vínculo com tenant é via `profiles`/`usuarios_base`.
