## Causa raiz

A validação de CNPJ duplicado no cadastro **falhou por diferença de formatação**, não por ausência de checagem.

No banco, as duas empresas estão salvas assim:
- Empresa 1 (criada em 10/03/2026): `cnpj = "38.872.035/0001-93"` (com máscara)
- Empresa 2 (criada em 21/05/2026, pela Kymberly): `cnpj = "38872035000193"` (só números)

A edge function `onboarding-signup` faz a checagem com:
```ts
.from("empresa_cadastro").select("id").eq("cnpj", documento)
```
Isso é **comparação exata de string**. Como o segundo cadastro enviou o CNPJ sem máscara, o `eq` não bateu com o registro antigo (que tinha pontos e barra) e a duplicata passou.

Além disso, **não existe índice único nem constraint no banco** para impedir CNPJs duplicados a nível de dados — a única barreira é a checagem na edge function.

## Plano de correção

### 1. Normalizar o CNPJ/CPF antes de comparar e antes de gravar (edge function)
Arquivo: `supabase/functions/onboarding-signup/index.ts`

- Criar helper `onlyDigits(s)` e aplicar no `documento` recebido logo no início.
- Trocar a checagem de duplicidade por uma consulta que normalize o lado do banco também, usando RPC nova (ver passo 2) ou um filtro com `regexp_replace`. Como PostgREST não suporta `regexp_replace` em `.eq`, usaremos uma RPC.
- Gravar `cnpj` (e `cpf`) **sempre sem máscara** em `empresa_cadastro.cnpj` no insert da linha 451.

### 2. RPC de checagem normalizada
Nova função SQL `public.empresa_existe_por_documento(p_doc text, p_tipo text)`:
- Recebe documento já em dígitos.
- Retorna `id` da empresa existente (ou null) comparando `regexp_replace(cnpj,'[^0-9]','','g') = p_doc` (idem cpf).
- `SECURITY DEFINER`, `search_path = public`.

A edge function passa a chamar essa RPC em vez do `.eq` cru.

### 3. Backfill dos registros existentes
Migration única:
- `UPDATE empresa_cadastro SET cnpj = regexp_replace(cnpj,'[^0-9]','','g') WHERE cnpj ~ '[^0-9]';`
- Mesmo para `cpf`.
- Antes, identificar e listar duplicatas que aparecerem após a normalização (ex.: o caso da Voe Mídia) para o super admin resolver manualmente — **não vou mesclar nem apagar nada automaticamente**; apenas reportar via `SELECT` no resumo da migration.

### 4. Índice único parcial (defesa em profundidade)
Após o backfill:
```sql
CREATE UNIQUE INDEX empresa_cadastro_cnpj_unique
  ON public.empresa_cadastro (cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';
```
Assim, mesmo que uma futura edge function esqueça a normalização, o banco rejeita.

> Observação: se o backfill detectar a duplicata já existente da Voe Mídia, o índice único vai falhar. Nesse caso a migration será dividida em duas etapas e a criação do índice ficará pendente até o super admin escolher qual registro manter (via fluxo de migração de empresas já existente ou exclusão manual). Vou avisar no chat com a lista de duplicatas encontradas.

### 5. Frontend (opcional, mas recomendado)
No formulário de signup (`src/pages/Signup*` / componentes do onboarding):
- Já enviar `cnpj.replace(/\D/g,'')` no payload para a edge function.
- Manter a máscara só na exibição.

## Resultado esperado
- Tentativa futura de cadastrar CNPJ `38872035000193` em qualquer formato (`388.720.350/0001-93`, `38872035000193`, etc.) retorna `409 CNPJ já cadastrado`.
- Banco passa a ter garantia física de unicidade.
- O caso atual (2 empresas com mesmo CNPJ) é reportado para resolução manual via o módulo de migração de empresas, sem perda de dados.
