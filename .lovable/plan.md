

# Plano: Sistema de Convite para Novos Donos de Empresas

## Objetivo
Implementar duas formas para o dono de uma empresa recém-cadastrada acessar o sistema:
1. **Link de Convite Mágico**: Enviar e-mail com link de acesso direto (sem senha inicial)
2. **Credenciais Fixas**: Criar com e-mail e senha definidos pelo Super Admin (como está hoje)

---

## Visão Geral da Solução

O formulário de criação de empresa será expandido para incluir os dados do owner e permitir escolher o método de acesso. Ao criar a empresa, o sistema já configura o primeiro usuário automaticamente.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Nova Empresa                             │
├─────────────────────────────────────────────────────────────┤
│  Nome da Empresa: [___________________]                     │
│  Slug:            [___________________]                     │
│  Plano:           [Starter ▼]                               │
├─────────────────────────────────────────────────────────────┤
│  ADMINISTRADOR PRINCIPAL                                    │
│  Nome Completo:   [___________________]                     │
│  Email:           [___________________]                     │
│                                                             │
│  Método de Acesso:                                          │
│  ○ Enviar link de convite por e-mail                        │
│  ○ Definir senha manualmente                                │
│                                                             │
│  [Se senha manual]                                          │
│  Senha:           [___________________]                     │
├─────────────────────────────────────────────────────────────┤
│            [Cancelar]    [Criar Empresa]                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapas de Implementação

### 1. Configurar Serviço de E-mail (Resend)

Será necessário configurar o Resend para envio de e-mails de convite:
- Adicionar secret `RESEND_API_KEY` no projeto
- Configurar domínio verificado no Resend

### 2. Atualizar TenantForm

Modificar o formulário de criação de empresa para incluir:
- Campos do administrador principal (nome, e-mail)
- Seletor de método de acesso (convite ou senha)
- Campo de senha (condicional)

### 3. Atualizar Edge Function `onboarding-signup`

Adicionar um terceiro modo de operação:
- **Modo 3 - Convite**: Criar usuário + enviar e-mail de convite mágico

A lógica será:
- Se `inviteMode: true`, usar `admin.auth.admin.inviteUserByEmail()` 
- Isso cria o usuário e envia automaticamente um link para definir senha

### 4. Criar Edge Function para Envio de E-mail Personalizado (Opcional)

Se quiser e-mails mais personalizados com a marca, criar função usando Resend:
- Template com logo e informações da empresa
- Link de primeiro acesso

### 5. Atualizar SuperAdminDashboard

- Remover modal separado "Criar usuário owner"
- Integrar criação do owner no fluxo de criação da empresa
- Opcionalmente manter botão para adicionar owners adicionais

---

## Detalhes Técnicos

### Edge Function Atualizada

A função `onboarding-signup` será modificada para aceitar:

```typescript
type Payload = {
  // ... campos existentes
  inviteMode?: boolean; // true = enviar convite, false = usar senha
};
```

Quando `inviteMode: true`:
```typescript
const { data: newUser, error } = await admin.auth.admin.inviteUserByEmail(email, {
  data: { 
    tenant_id: tenantId,
    nome_completo: nomeCompleto 
  },
  redirectTo: `${SITE_URL}/login`
});
```

### Componente TenantForm Atualizado

Novos campos no formulário:
- `ownerNome`: Nome do administrador
- `ownerEmail`: E-mail do administrador
- `accessMethod`: "invite" | "password"
- `ownerPassword`: Senha (apenas se accessMethod = "password")

### Fluxo do Usuário Convidado

1. Super Admin cria empresa com método "convite"
2. Owner recebe e-mail com link mágico
3. Owner clica no link → é autenticado automaticamente
4. Sistema redireciona para tela de definir nova senha
5. Owner está pronto para usar o sistema

---

## Pré-requisitos

Antes de implementar, será necessário:

1. **Configurar Resend** (se quiser e-mails personalizados):
   - Criar conta em resend.com
   - Validar domínio de e-mail
   - Gerar API key

2. **Configurar URL do Site**:
   - Definir `SITE_URL` ou usar URL de produção para redirecionamento

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/TenantForm.tsx` | Adicionar campos do owner e seletor de método |
| `supabase/functions/onboarding-signup/index.ts` | Adicionar modo convite com `inviteUserByEmail` |
| `src/hooks/useSuperAdmin.ts` | Atualizar mutation para aceitar novos parâmetros |
| `src/pages/admin/SuperAdminDashboard.tsx` | Ajustar fluxo para criar tenant + owner juntos |

---

## Resultado Esperado

Após implementação:
- Super Admin pode criar empresa e owner em um único passo
- Pode escolher enviar convite por e-mail OU definir senha
- Owner convidado recebe e-mail e acessa diretamente
- Credenciais mostradas ao Super Admin se optar por senha fixa

