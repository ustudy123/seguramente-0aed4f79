# Guia rápido do desenvolvedor — YourEyes

Tudo que você precisa para trabalhar neste projeto sem risco para o sistema
real: os endereços, o prompt para abrir conversas e como criar usuários de
teste. O manual completo (PDF) explica o porquê de cada regra.

---

## 1. Endereços — guarde nos favoritos

### Sistema de teste (pode tudo)

| O quê | Endereço |
|---|---|
| **Site de teste** (telas, login, navegação) | https://ustudy123.github.io/seguramente-0aed4f79/ |
| Banco de dados de teste — painel | https://supabase.com/dashboard/project/bmehdgthciuvdbvutsdv |
| Banco de dados de teste — consultas (SQL Editor) | https://supabase.com/dashboard/project/bmehdgthciuvdbvutsdv/sql/new |
| Banco de dados de teste — usuários | https://supabase.com/dashboard/project/bmehdgthciuvdbvutsdv/auth/users |

No painel do Supabase esse projeto aparece com o nome **“Ambiente Testes –
YourEyes”**. Dados são todos fictícios: pode criar, alterar e apagar à vontade.

**Usuário de teste padrão:** `ambienteteste@youreyes.com`
(senha com o administrador do projeto — ou crie o seu, seção 4)

### Sistema real (só o que foi aprovado)

| O quê | Endereço |
|---|---|
| Site real (clientes) | https://seguramente.lovable.app |
| Banco de dados real — painel | https://supabase.com/dashboard/project/diayjpsrcerycycyaxst |
| Banco de dados real — consultas (SQL Editor) | https://supabase.com/dashboard/project/diayjpsrcerycycyaxst/sql/new |

> **Antes de executar qualquer coisa no SQL Editor, confira o nome do projeto
> no topo da tela.** O Supabase abre sempre no último projeto usado.
> Sugestão: salve os favoritos como 🟢 **SQL TESTE** e 🔴 **SQL REAL**.

---

## 2. Prompt para abrir uma conversa no Claude Code

Uma conversa por demanda. Copie o bloco, preencha as três linhas do final e
cole como primeira mensagem.

```
Você está no projeto YourEyes (repo ustudy123/seguramente-0aed4f79).
Leia o CLAUDE.md e siga as regras da casa à risca — em especial:

1. TODA mudança nasce no banco de dados de TESTE (projeto Supabase
   "Ambiente Testes – YourEyes"). Você registra a mudança no projeto e a
   automação aplica sozinha no ambiente de teste. O sistema real NUNCA é
   tocado por você: ele só muda quando uma pessoa colar o script de
   entrega no SQL Editor do banco real ou clicar Publicar no Lovable.
2. Mudança de banco = migration em supabase/migrations/ (carimbo único!)
   + script de entrega idempotente em docs/script_*.sql com conferência
   SELECT no final.
3. Teste antes de entregar: monte a réplica local das migrations quando
   mexer em banco; ao tocar área coberta por QA, rode a bateria da
   família e diga qual.
4. Nenhum dado real no ambiente de teste, em seeds ou em documentos
   (LGPD). Dados fictícios: Empresa Staging LTDA, CPFs 900.000.0XX.
5. AO TERMINAR, SEMPRE feche a resposta assim:
   - o link do site de teste: https://ustudy123.github.io/seguramente-0aed4f79/
   - o que exatamente eu devo abrir/clicar lá para conferir a mudança
     (tela, caminho no menu, o que deve aparecer);
   - o aviso de que o sistema real continua intacto e só muda depois da
     minha aprovação.
   Depois disso, PARE e espere minha resposta. Quando eu disser
   "aprovado", aí sim me entregue o passo de produção: o script para
   colar no SQL Editor do banco real e/ou o aviso de clicar Publicar no
   Lovable. Nunca antecipe o passo de produção sem a aprovação.

--- MINHA DEMANDA ---
Tipo: [bug / ajuste / funcionalidade nova / investigação]
Módulo: [ponto / saúde / psicossocial / admissões / financeiro / outro]
Descrição: [o que acontece hoje e o que deveria acontecer]
```

### Como funciona na prática

1. Você manda a demanda com o prompt acima.
2. O Claude desenvolve e registra a mudança no projeto.
3. A automação aplica no ambiente de teste em cerca de 5 minutos
   (banco de teste e site de teste, sozinha).
4. **Você abre o site de teste, entra com um usuário de teste e confere.**
5. Não funcionou? Conte o que viu na mesma conversa — o ciclo recomeça,
   e nada disso chegou perto do sistema real.
6. Funcionou? Responda **“aprovado”**. Só então o Claude entrega o passo
   de produção (script para o SQL Editor do banco real e/ou Publicar no
   Lovable), que é sempre executado por uma pessoa.

---

## 3. O que NÃO fazer pelo chat do Lovable

O Lovable está ligado ao **banco de dados real**. Quando o agente dele decide
criar uma tabela, alterar uma função ou mexer em qualquer estrutura do banco,
isso acontece **na hora, no sistema real** — antes mesmo do botão Publicar, e
sem passar pelo ambiente de teste.

- **Mudança de banco:** sempre pelo Claude Code. Nunca pelo chat do Lovable.
- **Ajuste visual simples:** pode ser pelo Lovable, mas confira antes no site
  de teste (a automação atualiza o site de teste a cada mudança salva) e só
  então clique em Publicar.

---

## 4. Criar um usuário de teste

Cada pessoa da equipe pode ter o seu, e vale criar usuários de tipos
diferentes (gestor, colaborador) para conferir o que cada um enxerga.

### Passo 1 — criar o acesso (painel)

1. Abra https://supabase.com/dashboard/project/bmehdgthciuvdbvutsdv/auth/users
   (confira: projeto **Ambiente Testes – YourEyes**).
2. Clique em **Add user → Create new user**.
3. Preencha um e-mail fictício (ex.: `gestor@teste.youreyes.com`) e uma senha.
4. Marque **Auto Confirm User** — sem isso a conta fica esperando uma
   confirmação de e-mail que nunca chega.
5. Clique no usuário criado e **copie o UUID** (código longo).

### Passo 2 — dar identidade e permissão (SQL Editor do teste)

Só criar o acesso não basta: sem cadastro interno, a pessoa entra num sistema
vazio. Abra o SQL Editor do banco de **teste**, cole o script abaixo, ajuste as
sete linhas do topo e execute.

```sql
DO $$
DECLARE
  -- >>> AJUSTE AS LINHAS ABAIXO <<<
  v_uid    uuid := '00000000-0000-0000-0000-000000000000'; -- UUID copiado no passo 1
  v_nome   text := 'Gestor de Testes';
  v_email  text := 'gestor@teste.youreyes.com';
  v_cpf    text := '90000010138';   -- use um CPF da lista abaixo (não repita)
  v_tipo   text := 'gestor';        -- administrador | gestor | colaborador
  v_papel  text := 'manager';       -- owner | admin | manager | user
  v_tenant uuid := '11111111-1111-1111-1111-111111111111'; -- Empresa Staging (não mude)
BEGIN
  INSERT INTO public.profiles (user_id, tenant_id, nome_completo, onboarding_concluido)
  VALUES (v_uid, v_tenant, v_nome, true)
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, v_papel::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.usuarios_base
    (tenant_id, auth_user_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_tenant, v_uid, v_nome, v_email, v_cpf,
          v_tipo::public.usuario_tipo, 'ativo'::public.usuario_status)
  ON CONFLICT (auth_user_id) DO NOTHING;

  RAISE NOTICE 'Usuario de teste pronto: % (%)', v_nome, v_email;
END $$;

-- Conferência: deve listar o usuário criado
SELECT ub.nome_completo, ub.email_principal, ub.tipo_usuario::text AS tipo,
       r.role::text AS papel, COALESCE(pa.nome, '(sem perfil de acesso)') AS perfil
FROM public.usuarios_base ub
LEFT JOIN public.user_roles r ON r.user_id = ub.auth_user_id
LEFT JOIN public.usuario_perfil_vinculos v ON v.usuario_id = ub.id AND COALESCE(v.ativo, true)
LEFT JOIN public.perfis_acesso pa ON pa.id = v.perfil_id
WHERE ub.email_principal = 'gestor@teste.youreyes.com';
```

**Combinações que fazem sentido**

| Quero testar a visão de... | `v_tipo` | `v_papel` |
|---|---|---|
| Dono / administrador | `administrador` | `owner` ou `admin` |
| Gestor (aprovações, equipe) | `gestor` | `manager` |
| Colaborador comum (auto-serviço) | `colaborador` | `user` |

O colaborador comum recebe automaticamente o perfil **“Colaborador (padrão)”**
— auto-serviço puro: enxerga apenas os próprios dados. É o mesmo comportamento
do sistema real para cadastros novos, e é a melhor forma de conferir se a
camada de permissões está protegendo o dado dos colegas.

**CPFs fictícios prontos** (com dígito verificador válido; use um por usuário e
não repita): `90000010138`, `90000010219`, `90000010308`, `90000010480`,
`90000010561`, `90000010642`.

### Passo 3 — entrar

Abra https://ustudy123.github.io/seguramente-0aed4f79/ e faça login com o
e-mail e a senha que você definiu no passo 1.

---

## 5. Lembretes rápidos

- **Nunca** copie dados reais (CPF, nome, atestado) para o ambiente de teste,
  nem para “facilitar a reprodução” de um problema. Recrie a situação com os
  dados fictícios (LGPD).
- Bagunçou os dados de teste? Sem problema — o administrador recria os dados
  fictícios em minutos.
- O site de teste não atualizou? A automação leva cerca de 5 minutos; recarregue
  com Ctrl+F5. Se persistir, avise o administrador (há um painel de execuções
  no GitHub que mostra falhas).
- O banco de teste hiberna depois de cerca de uma semana sem uso: religa-se em
  um clique no painel do Supabase, sem perder nada.
