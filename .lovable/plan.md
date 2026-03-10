

## Recomendacao e Plano: Simplificacao do Fluxo de Registro

### Minha Recomendacao

**Opcao recomendada: Signup direto com verificacao de e-mail do Supabase (sem Resend)**

O Supabase ja envia e-mail de verificacao automaticamente no `signUp`. Nao precisa de Resend para isso. O fluxo ficaria:

```text
/register (com senha) → Email de verificacao (Supabase built-in)
    → Clica no link → Redirecionado para / (auto-logado)
        → 1m30s depois → Popup obrigatorio de Onboarding
            → So libera o sistema apos concluir
```

**Por que nao usar Resend?**
- O Supabase ja tem verificacao de e-mail integrada e gratuita
- Resend adicionaria complexidade desnecessaria (API key, Edge Function, templates)
- Se no futuro quiser customizar os e-mails (dominio proprio, branding), ai sim faz sentido o Resend

---

### O que muda no sistema

#### 1. Pagina `/register` — Vira signup real
- Adicionar campos de **senha** e **confirmar senha**
- Remover o "info banner" que diz "aguarde contato da equipe"
- No submit: chamar `supabase.auth.signUp()` + `onboarding-signup` Edge Function (ja existe e cria tenant + profile + owner role)
- Apos submit: mostrar dialog "Verifique seu e-mail para ativar a conta"
- Remover chamada a `pre-register` Edge Function

#### 2. Popup de Onboarding obrigatorio (novo componente)
- Componente `OnboardingGate` renderizado dentro do `ProtectedRoute` ou `MainLayout`
- Verifica no profile se `onboarding_concluido = true`
- Se nao concluido: apos 1min30s, exibe modal full-screen bloqueante
- Modal redireciona para `/onboarding` (versao simplificada, sem token)
- Ao concluir onboarding, marca `onboarding_concluido = true` no profile

#### 3. Simplificar `/onboarding-cliente`
- Remover dependencia de token (acessar via rota protegida `/onboarding`)
- Remover fases de contrato/ata (simplificar para: estrutura organizacional + diagnostico)
- Usuario ja esta autenticado, nao precisa de token publico

#### 4. Remover/depreciar o que nao sera mais usado
- Edge Function `pre-register` — pode manter para historico mas nao sera chamada
- Pagina `/ativar-conta` — nao sera mais necessaria
- Edge Function `activate-account` — nao sera mais necessaria
- Pipeline do Programa Validador continua existindo mas nao e mais obrigatorio para criar conta

#### 5. Migracao de banco
- Adicionar coluna `onboarding_concluido BOOLEAN DEFAULT false` na tabela `profiles`
- Isso controla se o popup bloqueante aparece ou nao

---

### Fluxo final simplificado

```text
1. Usuario acessa /register
2. Preenche: empresa, CNPJ, nome, e-mail, senha
3. Sistema cria: auth user + tenant + profile + role owner
4. Supabase envia e-mail de verificacao
5. Usuario clica no link → redirecionado para / (logado)
6. Apos 1m30s → popup bloqueante "Complete seu onboarding"
7. Usuario preenche onboarding (estrutura + diagnostico)
8. profile.onboarding_concluido = true → acesso liberado
```

---

### Detalhes tecnicos

- **Arquivos a criar**: `src/components/auth/OnboardingGate.tsx`
- **Arquivos a editar**: `Register.tsx`, `useAuth.ts`, `ProtectedRoute.tsx` ou `MainLayout.tsx`, `OnboardingCliente.tsx`
- **Arquivos a depreciar**: `AtivarConta.tsx`, `activate-account/index.ts`, `pre-register/index.ts`
- **Migracao SQL**: `ALTER TABLE profiles ADD COLUMN onboarding_concluido BOOLEAN DEFAULT false`
- **Edge Function `onboarding-signup`**: ja funciona perfeitamente para este fluxo

