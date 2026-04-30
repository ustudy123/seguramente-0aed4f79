## Correção: Onboarding aparecendo para usuários novos em tenants já configurados

### Problema confirmado
Usuários convidados para um tenant já configurado recebem `onboarding_concluido = false` por padrão, fazendo aparecer o modal de onboarding e o banner em Configurações — mesmo que a empresa já esteja totalmente cadastrada.

### Mudanças

**1. `supabase/functions/invite-tenant-user/index.ts`**
- Antes de inserir o `profile`, verificar se o `tenant_id` já possui registro em `empresa_cadastro`.
- Se sim, criar o profile com `onboarding_concluido: true`.
- Se não (primeiro usuário do tenant), manter `false`.

**2. `src/pages/Configuracoes.tsx`**
- Substituir a checagem `needsOnboarding` (que olha só o flag do profile) por uma query que também valida se o tenant já tem `empresa_cadastro`.
- Banner "Configuração inicial pendente" só aparece quando o profile está incompleto **E** o tenant não tem dados.
- Se o tenant já tem dados mas o profile está marcado como incompleto, auto-atualizar `onboarding_concluido = true` (self-heal).

**3. `src/components/auth/OnboardingGate.tsx`**
- Já tem a lógica correta de checar `empresa_cadastro` e fazer self-heal, mas o estado inicial `tenantHasData = null` permite que o timer de 20s não dispare antes da checagem. Adicionar guarda explícita: não iniciar o timer enquanto `tenantHasData === null` (loading).
- Pequeno ajuste para garantir que `localStorage[ONBOARDING_SHOWN_KEY]` seja limpo assim que detectar que o tenant tem dados.

**4. Migration de backfill (data update via insert tool)**
- `UPDATE profiles SET onboarding_concluido = true WHERE onboarding_concluido = false AND tenant_id IN (SELECT DISTINCT tenant_id FROM empresa_cadastro);`
- Corrige todos os usuários hoje afetados sem precisar esperar o self-heal individual.

### Resultado esperado
- Novo usuário em tenant já configurado: entra direto no sistema, sem modal e sem banner.
- Primeiro usuário de um tenant novo: continua vendo onboarding normalmente.
- Usuários atualmente afetados: corrigidos pelo backfill no próximo login (ou imediatamente).
