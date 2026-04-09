

## Análise Multi-Tenant: Status Atual e Correções Necessárias

### Diagnóstico Geral

O sistema **já está funcionando em multi-tenant** na maior parte. A arquitetura base é sólida:
- 277 tabelas, todas com RLS habilitado
- Coluna `tenant_id` presente em praticamente todas as tabelas operacionais
- Função `get_user_tenant_id()` (SECURITY DEFINER) usada nas políticas RLS
- Código filtra por `tenant_id` em todas as queries dos hooks

No entanto, a auditoria de segurança identificou **8 vulnerabilidades** que comprometem o isolamento multi-tenant.

---

### Vulnerabilidades Encontradas (por prioridade)

#### 1. CRÍTICO — Storage sem isolamento de tenant
**Problema:** 8 buckets de storage permitem que qualquer usuário autenticado acesse arquivos de **qualquer tenant**:
- `documentos` (policy ampla anula a policy com tenant)
- `sst-documentos`, `pdi-evidencias`, `esocial-certificados`, `hub-contabil`, `jornada-documentos`, `eventos-sst`, `ergonomia-evidencias`

**Correção:** Remover policies permissivas e manter apenas policies com `(storage.foldername(name))[1] = (get_user_tenant_id())::text`

#### 2. CRÍTICO — OTPs do Psicossocial expostos publicamente
**Problema:** Tabela `psicossocial_otp_verificacao` permite leitura anônima de códigos OTP, permitindo que qualquer pessoa veja códigos de verificação.

**Correção:** Restringir policy SELECT para exigir match de `campanha_id` + `telefone_hash`

#### 3. CRÍTICO — Convites do Questionário com CPF/Nome públicos
**Problema:** Tabela `questionario_psicossocial_convites` tem policy `USING (true)` que expõe CPFs e nomes de colaboradores.

**Correção:** Criar RPC SECURITY DEFINER para busca por token, remover SELECT público

#### 4. MODERADO — 2 policies com `WITH CHECK (true)` 
**Problema:** Existem policies INSERT/UPDATE permissivas demais em 2 tabelas (provavelmente marketplace_avaliacoes e outra).

**Correção:** Adicionar condição de tenant_id ou user_id

#### 5. MODERADO — Proteção contra senhas vazadas desabilitada
**Problema:** Recurso do Supabase Auth não está ativado.

**Correção:** Ativar manualmente no painel Supabase (Auth > Settings)

---

### Plano de Implementação

#### Migração SQL 1 — Corrigir Storage (8 buckets)
- DROP das policies permissivas sem tenant check no bucket `documentos`
- Criar/atualizar policies nos 7 buckets restantes adicionando `(storage.foldername(name))[1] = (get_user_tenant_id())::text`

#### Migração SQL 2 — Corrigir Psicossocial OTP
- DROP da policy anon SELECT atual em `psicossocial_otp_verificacao`
- Criar RPC `verificar_otp(p_campanha_id, p_telefone_hash, p_codigo)` SECURITY DEFINER
- Atualizar código frontend para usar a RPC

#### Migração SQL 3 — Corrigir Convites Questionário
- DROP da policy `USING (true)` em `questionario_psicossocial_convites`
- Criar RPC `buscar_convite_por_token(p_token)` SECURITY DEFINER
- Atualizar código frontend

#### Migração SQL 4 — Corrigir policies `WITH CHECK (true)`
- Identificar as 2 tabelas exatas e adicionar condições de tenant

#### Passo Manual (usuário)
- Ativar "Leaked Password Protection" no painel Supabase Auth

---

### Detalhes Técnicos

**Arquivos a editar no código:**
- Componentes/hooks que fazem queries em `psicossocial_otp_verificacao` — migrar para RPC
- Componentes/hooks que buscam `questionario_psicossocial_convites` por token — migrar para RPC
- Hooks de upload de storage — garantir que o path inclui `tenantId/` como primeiro segmento

**Estimativa:** 4 migrações SQL + ~4-6 arquivos de código

