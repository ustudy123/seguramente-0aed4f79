
## Por que está vindo e-mail automático?

No hook `src/hooks/useImportacaoPlanilha.ts`, linha **916**, existe esta lógica no momento de inserir cada colaborador na tabela `admissoes`:

```ts
email: dado.email || `${dado.cpf}@importado.temp`
```

Ou seja: se a planilha **não tem coluna de e-mail** (ou a célula está vazia), o sistema **gera um e-mail falso** no formato `12345678900@importado.temp` para conseguir inserir o registro.

**Motivo técnico:** a coluna `admissoes.email` no banco está definida como **NOT NULL** (verifiquei no schema). Por isso o código nunca pode mandar `null` — daí o "truque" do e-mail temporário.

**Boa notícia:** a coluna **não é UNIQUE** (não existe índice único em `email`), então não há risco de colisão ao permitir vazios — basta tornar a coluna nullable.

---

## Solução proposta (alinhada com sua preferência)

Concordo com sua sugestão: **deixar o e-mail em branco** quando a planilha não trouxer essa informação, e o admin completa depois manualmente na ficha do colaborador. É a abordagem mais limpa e evita poluir a base com endereços fictícios que podem vazar para módulos de envio (Resend, convites, recuperação de senha) e gerar bounces ou comportamento estranho.

### Mudanças necessárias

**1. Banco de dados (migração)**
- Tornar `admissoes.email` **nullable** (`ALTER COLUMN email DROP NOT NULL`).
- Rodar um **UPDATE de limpeza** para zerar e-mails fictícios já existentes, gerados por importações anteriores:
  ```sql
  UPDATE admissoes SET email = NULL 
  WHERE email LIKE '%@importado.temp' OR email LIKE '%@placeholder.com';
  ```
  Isso devolve o estado correto aos registros antigos para que o admin possa preencher.

**2. Hook de importação (`src/hooks/useImportacaoPlanilha.ts`, linha 916)**
- Trocar `email: dado.email || \`${dado.cpf}@importado.temp\`` por `email: dado.email?.trim() || null`.
- Adicionar validação leve: se houver valor preenchido, validar formato básico de e-mail; se inválido, marcar como erro de linha (não bloquear toda a importação) — mantém o padrão atual de pré-validação visual.

**3. Hook secundário (`src/utils/onboardingImport.ts`, linha similar)**
- Existe **outro caminho de importação** (`importCollaborators`) que faz o mesmo truque: `email: row.email || \`${normalizeCPF(row.cpf)}@placeholder.com\``. Aplicar a mesma correção: enviar `null` quando vazio.

**4. UI da listagem de colaboradores**
- Onde a coluna "E-mail" é exibida (página Colaboradores e ficha individual), exibir um placeholder discreto tipo **"— não informado —"** ou um badge clicável **"Adicionar e-mail"** quando o valor for `null`. Isso reforça visualmente para o admin que aquele cadastro precisa de complemento.

**5. Módulos que dependem de e-mail (proteção)**
Verificar e proteger os fluxos que disparam para o e-mail do colaborador, para que **não tentem enviar** se o e-mail estiver vazio:
- Convites de acesso (ativação de conta / `invite-tenant-user`)
- Notificações de OS, ASO, Férias, Advertência, PDI, Avaliações
- Recuperação de senha do portal do colaborador

A regra fica: **sem e-mail cadastrado → botão de envio desabilitado** com tooltip "Cadastre o e-mail do colaborador para liberar este envio". Isso evita erros silenciosos e orienta o admin a completar o dado quando for necessário.

---

## Alternativa que descartei (e por quê)

Poderíamos **manter o e-mail temporário mas marcá-lo com flag** `email_pendente = true` para filtrar nos disparos. Funciona, mas:
- Polui relatórios e exports (planilhas exportadas teriam `cpf@importado.temp`).
- Risco de o admin "esquecer" o e-mail fake e ele vazar em integrações (Resend, eSocial, etc.).
- Adiciona complexidade (flag nova + filtros em todos os pontos de leitura).

Sua proposta original (campo vazio) é mais segura e direta.

---

## Arquivos afetados

- **Migração SQL** (nova): tornar `admissoes.email` nullable + limpar registros antigos com domínios `@importado.temp` e `@placeholder.com`.
- `src/hooks/useImportacaoPlanilha.ts` — linha 916.
- `src/utils/onboardingImport.ts` — função `importCollaborators`.
- Componente da listagem/ficha de Colaboradores — placeholder visual para e-mail vazio.
- Pontos de envio de e-mail (convite, notificações) — guard `if (!colaborador.email) bloquear`.

## Riscos e mitigações

- **Risco:** algum código legado pode assumir `email` sempre preenchido. **Mitigação:** durante a implementação, fazer busca global por usos de `colaborador.email` / `admissao.email` e adicionar fallback (`?? ""`) ou guard onde necessário.
- **Risco:** registros antigos com e-mail fake já podem ter sido usados em convites. **Mitigação:** o UPDATE de limpeza só afeta os domínios `@importado.temp` e `@placeholder.com`, que comprovadamente são os fakes gerados pelo sistema — e-mails reais permanecem intactos.
