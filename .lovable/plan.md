## Escopo

Adicionar gestor titular e substituto ao cadastro de departamento, e usar esse vínculo como fonte única para organograma, aprovação de ajustes de ponto e provisionamento de login.

## 1. Banco de dados

Migração na tabela `departamentos`:
- `gestor_colaborador_id uuid` → FK lógica para `colaboradores.id`
- `gestor_substituto_colaborador_id uuid` (opcional)
- `substituto_ativo boolean default false` (toggle manual do RH)

Migração na tabela `colaboradores`:
- `login_interno text unique` (ex: `joao.silva@youreyes.com.br`)
- `senha_resetada_em timestamptz` (controle do fluxo de reset)
- `precisa_redefinir_senha boolean default true`

Migração na tabela `ponto_ajustes`:
- `aprovado_por_gestor_id uuid` (auditoria do gestor que aprovou)
- `aprovado_por_substituto boolean default false`

Função SQL `gerar_login_interno(p_colaborador_id uuid)`:
- Lê `nome_completo`, monta `primeiro.ultimo@youreyes.com.br`
- Se duplicado, tenta `primeiro.meio.ultimo`
- Se ainda duplicado, retorna erro pedindo ajuste manual

Função `is_gestor_departamento(_colaborador_id uuid, _departamento_id uuid)`:
- Retorna true se o auth user é gestor titular OU (gestor substituto E `substituto_ativo = true`)
- SECURITY DEFINER, base para RLS de aprovação

Atualizar RLS de `ponto_ajustes`:
- UPDATE permitido a Owner/RH (como hoje) OU gestor do departamento do colaborador alvo

## 2. UI — Cadastro de Departamentos (`src/pages/cadastros/Departamentos.tsx`)

No modal adicionar dois `Combobox` puxando de `colaboradores` ativos da empresa:
- "Gestor responsável" (obrigatório quando ativo)
- "Substituto do gestor" (opcional)
- Toggle "Substituto está atuando agora" (visível só se substituto definido)

Na tabela, nova coluna "Gestor" mostrando nome do titular (+ chip "Substituto ativo" quando aplicável).

## 3. Organograma

Atualizar `useEstrategia` / `OrganogramaSection` para ler `departamentos.gestor_colaborador_id` em vez de qualquer fonte ad-hoc. Sem mudança visual — apenas trocar a query.

## 4. Aprovação de ajustes de ponto

Hook `usePonto.ts`:
- `useAjustesParaAprovar()` retorna ajustes onde o usuário logado é gestor (titular ou substituto ativo) do departamento do colaborador
- Owner/RH continuam vendo tudo (auditoria), mas a aprovação principal vira do gestor

Tela `Ponto.tsx` aba "Aprovações" passa a usar esse hook; mostra badge "Aguardando gestor" para o RH.

## 5. Provisionamento de login do gestor

Quando um colaborador é marcado como gestor pela primeira vez (trigger AFTER UPDATE em `departamentos`):
- Se `colaboradores.login_interno` é null, chama edge function `provisionar-gestor`
- Edge function:
  - Gera login com `gerar_login_interno`
  - Cria auth user com `supabase.auth.admin.createUser({ email: login, password: cpf_limpo, email_confirm: true })`
  - Salva `login_interno`, `precisa_redefinir_senha = true`
  - Vincula ao perfil "Gestor" (cria se não existir) via `usuario_perfil_vinculos`
- Tela de Departamentos mostra toast com o login gerado

## 6. Reset de senha pelo RH

Botão "Resetar senha" no card do gestor dentro de Departamentos (visível só para Owner/RH):
- Chama edge function `reset-senha-gestor` que:
  - `supabase.auth.admin.generateLink({ type: 'recovery', email: login })`
  - Envia via Resend usando template existente
  - Marca `precisa_redefinir_senha = true`
- No primeiro login após reset, o `AuthContext` redireciona para `/redefinir-senha` enquanto `precisa_redefinir_senha = true`

## 7. Perfil "Gestor de Departamento"

Seed (migração) cria perfil padrão `gestor_departamento` com permissões:
- `ponto:aprovar` (escopo `departamento`)
- `colaboradores:visualizar` (escopo `departamento`)
- `ferias:aprovar` (escopo `departamento`)
- `feedback:gerenciar` (escopo `departamento`)

## Fora de escopo (não vou fazer agora)

- Email funcional real em @youreyes.com.br (só login interno — já confirmado)
- Notificação push para o gestor quando há ajuste pendente (pode vir depois)
- Hierarquia gestor-do-gestor (mantemos só 1 nível depto→gestor)
