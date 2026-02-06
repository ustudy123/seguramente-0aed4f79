
# Plano: Sincronização Automática de Documentos da Admissão

## Objetivo
Quando documentos forem anexados na Etapa 6 (Documentos) do processo de admissão, eles devem ser automaticamente registrados na pasta do respectivo colaborador no módulo de Documentos.

---

## Análise do Fluxo Atual

O sistema atualmente:
1. **Etapa 6 - Upload**: Documentos são enviados via `uploadDocumento()` no hook `useAdmissoes.ts`
2. **Armazenamento**: Arquivos salvos em `documentos/{tenant_id}/admissoes/{admissao_id}/{documento_id}-{arquivo}`
3. **Registro**: Metadados salvos apenas na tabela `admissao_documentos`
4. **Problema**: Os documentos NÃO aparecem no módulo de Documentos, pois não são inseridos na tabela `documentos`

---

## Solução Proposta

### Estratégia: Sincronização no Momento do Upload

Ao fazer upload de um documento na admissão, automaticamente:
1. Fazer upload para o storage (já existe)
2. Atualizar `admissao_documentos` (já existe)
3. **NOVO**: Inserir registro na tabela `documentos` vinculando ao CPF do colaborador

### Vantagens desta abordagem
- Documentos aparecem imediatamente no módulo Documentos
- Não precisa esperar a admissão ser concluída
- Mantém rastreabilidade (origem = admissão)
- Evita duplicação de arquivos no storage

---

## Implementação Técnica

### Arquivo: `src/hooks/useAdmissoes.ts`

**Mudanças na função `uploadDocumento`:**

1. Buscar dados da admissão (nome_completo, cpf) antes do upload
2. Após salvar no `admissao_documentos`, inserir também na tabela `documentos`:

```typescript
// Após atualizar admissao_documentos, sincronizar com módulo documentos
const admissao = await supabase
  .from('admissoes')
  .select('nome_completo, cpf')
  .eq('id', admissaoId)
  .single();

const documentoAdmissao = await supabase
  .from('admissao_documentos')
  .select('nome, tipo')
  .eq('id', documentoId)
  .single();

// Inserir na tabela documentos
await supabase.from('documentos').insert({
  tenant_id: tenantId,
  colaborador_id: null, // Não existe profile ainda
  colaborador_nome: admissao.data.nome_completo,
  colaborador_cpf: admissao.data.cpf,
  nome_arquivo: filePath,
  nome_original: file.name,
  tipo: documentoAdmissao.data.nome, // Ex: "RG", "CPF", "CTPS"
  tamanho: file.size,
  mime_type: file.type,
  storage_path: filePath,
  data_validade: null,
  status: 'valido',
  observacoes: `Documento da admissão`,
  criado_por: user.id,
  criado_por_nome: profile?.nome_completo,
});
```

### Considerações Importantes

**1. Identificação do Colaborador**
- Na admissão, o colaborador ainda não tem um `colaborador_id` (não é um profile ainda)
- Usaremos o CPF como identificador único
- Quando a admissão for concluída e o colaborador virar um profile, os documentos já estarão disponíveis

**2. Estrutura do Storage Path**
- Documentos ficarão em: `{tenant_id}/admissoes/{admissao_id}/...`
- Quando a admissão for concluída, podemos opcionalmente mover para a pasta do colaborador

**3. Evitar Duplicação**
- Adicionar verificação para não inserir se já existir registro com o mesmo `storage_path`

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAdmissoes.ts` | Adicionar lógica de sincronização no `uploadDocumento` |

---

## Fluxo Final

```text
┌─────────────────────────────────────────────────────────────┐
│                    ETAPA 6 - DOCUMENTOS                     │
│                                                             │
│  Usuário seleciona arquivo → Upload iniciado                │
│                       ↓                                     │
│  1. Upload para storage/documentos/{tenant}/admissoes/...   │
│                       ↓                                     │
│  2. Atualiza admissao_documentos (status: enviado)          │
│                       ↓                                     │
│  3. NOVO: Insere na tabela documentos                       │
│     - colaborador_nome: nome da admissão                    │
│     - colaborador_cpf: cpf da admissão                      │
│     - tipo: nome do documento (RG, CPF, etc)                │
│                       ↓                                     │
│  Documento aparece automaticamente no módulo Documentos     │
│  Agrupado pelo CPF/nome do colaborador                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Visualização no Módulo Documentos

O colaborador aparecerá na aba "Por Colaborador" mesmo durante o processo de admissão:

```text
┌──────────────────────────────────────────────────────┐
│  Por Colaborador                                     │
├──────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │    📁      │  │    📁      │  │    📁      │     │
│  │ João Silva │  │ Maria (*)  │  │ Pedro      │     │
│  │ 12 docs    │  │ 3 docs     │  │ 5 docs     │     │
│  └────────────┘  └────────────┘  └────────────┘     │
│                                                      │
│  (*) Colaborador em processo de admissão             │
└──────────────────────────────────────────────────────┘
```

---

## Tratamento de Remoção de Documentos

Quando um documento for removido da admissão, também será removido do módulo Documentos:

- Ao chamar `handleDocumentRemove`, adicionar lógica para deletar da tabela `documentos` usando o `storage_path` como referência
