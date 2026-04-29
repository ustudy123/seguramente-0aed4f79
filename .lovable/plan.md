## Problema

O importador de colaboradores exige **CNPJ de 14 dígitos** para vincular cada linha à empresa cadastrada. Profissionais liberais (PF) que se cadastraram no sistema com **CPF** (`tipo_pessoa = 'pf'`) não conseguem importar planilhas — todas as linhas falham com *"CNPJ Empresa é obrigatório (14 dígitos)"*, mesmo colocando o CPF na coluna CNPJ.

A base já está preparada: `empresa_cadastro` tem colunas separadas `cnpj` e `cpf` + flag `tipo_pessoa`. Falta apenas o importador respeitar isso.

## Solução proposta

Tornar o importador **agnóstico ao tipo de documento da empresa**: aceitar CPF (11 dígitos) ou CNPJ (14 dígitos) na mesma coluna, e fazer o lookup correto conforme o `tipo_pessoa` da empresa.

### 1. Renomear conceitualmente a coluna (sem quebrar planilhas existentes)

- A coluna passa a se chamar **"CNPJ/CPF Empresa"** na UI, modal de upload, templates (CSV e XLSX) e tela de mapeamento "Parametrizar Arquivo".
- Aceitar como aliases de header: `cnpj`, `cpf`, `cnpj empresa`, `cpf empresa`, `cnpj/cpf`, `documento empresa`, `documento`. Garante retrocompatibilidade com planilhas antigas.
- Quando há **uma única empresa** no tenant (caso típico do profissional liberal), a coluna se torna **opcional** — o importador associa automaticamente todas as linhas àquela empresa, eliminando o atrito.

### 2. Validação flexível em `useImportacaoPlanilha.ts`

Substituir o check rígido de 14 dígitos por:

```text
limpar dígitos do campo
se vazio:
  se tenant tem 1 única empresa → usar essa empresa, OK
  senão → erro "Documento da empresa é obrigatório"
se 11 dígitos → procurar empresa com tipo_pessoa='pf' e cpf = valor
se 14 dígitos → procurar empresa com tipo_pessoa='pj' e cnpj = valor
senão → erro "Documento inválido (use CPF 11 dígitos ou CNPJ 14 dígitos)"
```

O `mapaEmpresas` passa a indexar pelo documento limpo (CPF ou CNPJ), construído a partir de `select id, cnpj, cpf, tipo_pessoa, razao_social from empresa_cadastro`.

Mensagens de erro formatam corretamente:
- CNPJ → `XX.XXX.XXX/XXXX-XX`
- CPF → `XXX.XXX.XXX-XX`

### 3. Templates atualizados

- **CSV** e **XLSX** baixáveis: cabeçalho da coluna vira "CNPJ/CPF Empresa".
- Linha de exemplo no template inclui um CPF e um CNPJ para deixar claro que ambos são aceitos.
- Texto de instrução no modal: *"Inclua o CNPJ (PJ) ou CPF (PF) da empresa em cada linha. Se você é profissional liberal e tem apenas uma empresa cadastrada, pode deixar a coluna em branco."*

### 4. Pré-validação visual no preview

Na tela de preview (a da imagem 3), os badges de erro mostram:
- "CPF da empresa não encontrado no sistema" quando 11 dígitos não batem
- "CNPJ da empresa não encontrado no sistema" quando 14 dígitos não batem
- "Documento inválido" quando não tem 11 nem 14 dígitos

E o card-resumo conta corretamente como **válidos** os registros que casam com qualquer empresa do tenant (PF ou PJ).

## Arquivos afetados

- `src/hooks/useImportacaoPlanilha.ts` — lookup por CPF/CNPJ, alias de headers, fallback empresa única, mensagens.
- Componente do modal "Importar Colaboradores" e tela "Parametrizar Arquivo" — labels e textos.
- Geradores de template CSV/XLSX — cabeçalho e linha-exemplo.

## Limitações

- Nenhuma alteração de schema necessária — `empresa_cadastro.cpf` e `tipo_pessoa` já existem.
- Planilhas antigas com header "CNPJ Empresa" continuam funcionando (alias mantido).
- Não altera a lógica de importação de empresas (`EmpresaImportExport`), apenas a de colaboradores.
