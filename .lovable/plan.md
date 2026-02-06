
# Plano: Pastas de Documentos por Colaborador

## Objetivo
Criar automaticamente uma pasta virtual para cada colaborador no módulo de Documentos quando ele for cadastrado, organizando todos os arquivos por colaborador.

---

## Visão Geral da Solução

A abordagem recomendada é **organizar por colaborador** (não por departamento) pelos seguintes motivos:

- **Prontuário individual**: Cada colaborador terá sua "pasta pessoal" com todos os documentos
- **Mudanças organizacionais**: Se o colaborador mudar de departamento, seus documentos permanecem intactos
- **Privacidade (LGPD)**: Facilita atender solicitações de acesso/portabilidade de dados
- **Desligamento**: Pasta completa pronta para arquivamento
- **Busca eficiente**: Fácil encontrar "todos os documentos de João Silva"

---

## Estrutura de Storage

```text
storage/documentos/
└── {tenant_id}/
    └── colaboradores/
        └── {colaborador_id}/
            ├── atestado_2024-01-15.pdf
            ├── ASO_admissional.pdf
            ├── contrato_trabalho.pdf
            └── certificado_NR35.pdf
```

---

## Implementação em 4 Etapas

### Etapa 1: Atualizar Hook useDocumentos

**Arquivo:** `src/hooks/useDocumentos.ts`

**Mudanças:**
- Alterar a função de upload para salvar arquivos na pasta do colaborador: `{tenant_id}/colaboradores/{colaborador_id}/`
- Adicionar função para buscar documentos agrupados por colaborador
- Incluir estatísticas por colaborador

### Etapa 2: Vincular Admissão ao Módulo de Documentos

**Arquivo:** `src/hooks/useAdmissoes.ts`

**Mudanças:**
- Ao concluir uma admissão (status = 'concluido'), migrar os documentos da admissão para a pasta do colaborador no módulo de documentos
- Registrar cada documento do processo admissional na tabela `documentos` automaticamente

### Etapa 3: Criar Visualização por Pastas no Módulo Documentos

**Arquivo:** `src/pages/Documentos.tsx`

**Mudanças:**
- Adicionar nova aba "Por Colaborador" com navegação em pastas
- Exibir lista de colaboradores como pastas clicáveis
- Ao clicar em uma pasta, mostrar os documentos daquele colaborador
- Manter visualizações existentes (Todos, Por Categoria)

**Novo componente:** `src/components/documentos/ColaboradorFolderView.tsx`
- Grid de "pastas" mostrando cada colaborador
- Contador de documentos por colaborador
- Indicador de documentos vencendo/vencidos por colaborador

### Etapa 4: Integração com Cadastro de Colaboradores

**Arquivo:** `src/pages/Colaboradores.tsx`

**Mudanças:**
- Alterar item de menu "Documentos" para navegar diretamente à pasta do colaborador
- Adicionar ação rápida para visualizar/gerenciar documentos do colaborador

---

## Detalhes Técnicos

### Mudança no storage_path dos documentos

De: `{tenant_id}/{timestamp}_{arquivo}`

Para: `{tenant_id}/colaboradores/{colaborador_id}/{timestamp}_{arquivo}`

### Nova função: getDocumentosPorColaborador

```typescript
const documentosPorColaborador = useMemo(() => {
  const agrupados = new Map<string, { nome: string; documentos: Documento[] }>();
  
  documentos.forEach(doc => {
    const key = doc.colaborador_id || 'sem-colaborador';
    if (!agrupados.has(key)) {
      agrupados.set(key, { nome: doc.colaborador_nome, documentos: [] });
    }
    agrupados.get(key)!.documentos.push(doc);
  });
  
  return agrupados;
}, [documentos]);
```

### Migração de documentos da admissão

Quando admissão atingir status "concluido":
1. Buscar todos os documentos em `admissao_documentos` com `arquivo_url` preenchido
2. Para cada documento, copiar o arquivo no storage para a nova pasta
3. Inserir registro na tabela `documentos` com os metadados apropriados

---

## Interface do Usuário

### Aba "Por Colaborador" no módulo Documentos

```text
┌─────────────────────────────────────────────────────────┐
│  Documentos                                             │
│  [Todos] [Por Categoria] [Por Colaborador]              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    📁        │  │    📁        │  │    📁        │  │
│  │ João Silva   │  │ Maria Santos │  │ Pedro Costa  │  │
│  │ 12 docs      │  │ 8 docs       │  │ 5 docs       │  │
│  │ 1 vencendo   │  │              │  │ 2 vencidos   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Visualização interna da pasta

```text
┌─────────────────────────────────────────────────────────┐
│  ← Voltar  │  📁 João Silva                             │
│            │  Cargo: Analista | Depto: TI               │
├─────────────────────────────────────────────────────────┤
│  [+ Upload para esta pasta]                             │
│                                                         │
│  📄 Contrato de Trabalho         │ 15/01/2024 │ Válido │
│  📄 ASO Admissional              │ 15/01/2024 │ Válido │
│  📄 Certificado NR-35            │ 10/02/2024 │ Vencendo │
│  📄 Atestado Médico              │ 05/02/2025 │ Válido │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useDocumentos.ts` | Modificar estrutura de storage e adicionar agrupamento |
| `src/pages/Documentos.tsx` | Adicionar aba "Por Colaborador" |
| `src/components/documentos/ColaboradorFolderView.tsx` | Criar novo componente |
| `src/components/documentos/DocumentoUploadForm.tsx` | Ajustar path de upload |
| `src/hooks/useAdmissoes.ts` | Migrar docs ao concluir admissão |
| `src/pages/Colaboradores.tsx` | Link direto para pasta de documentos |

---

## Consideracoes Finais

- **Retrocompatibilidade**: Documentos existentes continuam funcionando (paths antigos serão mantidos)
- **Performance**: Agrupamento feito em memória, sem queries adicionais
- **Segurança**: Mantém RLS existente, documentos isolados por tenant
