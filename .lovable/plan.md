
# Plano: AEP Multi-Setor com Coleta de Evidências por Função

## Resumo Executivo

Transformar o gerador de AEP para suportar a análise ergonômica de **múltiplos setores, funções e colaboradores** em uma única sessão, permitindo que cada evidência (foto/vídeo/áudio) seja vinculada a um contexto específico (setor + função + colaborador) antes da análise pela IA.

## Arquitetura Proposta

### Fluxo do Novo Processo

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    1. CONFIGURAÇÃO INICIAL                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Dados Empresa│  │ Selecionar   │  │ Opção: Todos os Setores  │   │
│  │ (CNPJ, Nome) │  │ Setores      │  │ ou Seleção Individual    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    2. COLETA DE EVIDÊNCIAS                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Para cada Evidência (foto/vídeo/áudio):                        │ │
│  │   • Setor*      [Dropdown dos cadastros]                       │ │
│  │   • Função*     [Dropdown filtrado pelo setor]                 │ │
│  │   • Colaborador [Opcional - Dropdown filtrado]                 │ │
│  │   • Arquivo     [Upload foto/vídeo]                            │ │
│  │   • Contexto    [Texto/Áudio adicional]                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Lista de evidências coletadas com preview e tags de identificação  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    3. ANÁLISE COM IA                                │
│  • Processa todas as evidências agrupadas por setor/função          │
│  • Gera riscos e recomendações específicas por contexto             │
│  • Consolida em relatório único ou individual por função            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    4. GERAÇÃO DE DOCUMENTO(S)                       │
│  Opções:                                                            │
│  • AEP Consolidada (empresa inteira, todos setores/funções)         │
│  • AEPs Individuais (uma por função avaliada)                       │
│  • AEP por Setor (agrupando funções do mesmo setor)                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Novos Tipos e Interfaces

### 1. Evidência Contextualizada
```typescript
interface EvidenciaAEP {
  id: string;
  setor: string;           // Obrigatório
  funcao: string;          // Obrigatório  
  colaboradorId?: string;  // Opcional
  colaboradorNome?: string;
  tipo: 'foto' | 'video' | 'audio';
  arquivoBase64: string;
  videoFrames?: string[];  // Se for vídeo
  contextoTexto?: string;
  audioBase64?: string;    // Contexto em áudio
  transcricaoAudio?: string;
  analisadaPorIA: boolean;
  resultadoIA?: AnaliseResultado;
  createdAt: string;
}
```

### 2. Documento AEP Multi-Função
```typescript
interface AEPDocumentoMulti {
  id?: string;
  tenant_id?: string;
  
  // Identificação da Empresa (comum)
  empresa: {
    nome: string;
    cnpj: string;
    unidade: string;
    dataAvaliacao: string;
    responsavelLevantamento: string;
    profissionalValidador?: string;
    versao: string;
  };
  
  // Avaliações por função
  avaliacoes: AEPAvaliacaoFuncao[];
  
  // Síntese consolidada
  sinteseGeral?: AEPSinteseAvaliacao;
  
  // Ações consolidadas
  acoesConsolidadas: AEPAcaoRecomendada[];
  
  assinaturas: AEPAssinatura;
  created_at?: string;
  updated_at?: string;
}

interface AEPAvaliacaoFuncao {
  id: string;
  setor: string;
  funcao: string;
  colaboradoresAvaliados: string[]; // Nomes
  evidencias: EvidenciaAEP[];
  descricaoAtividade: AEPDescricaoAtividade;
  riscosFisicos: AEPRiscosFisicos;
  riscosCognitivos: AEPRiscosCognitivos;
  classificacaoRisco: ClassificacaoRisco;
  acoesRecomendadas: AEPAcaoRecomendada[];
}
```

## Componentes a Criar/Modificar

### 1. `AEPEvidenciaForm.tsx` (NOVO)
Formulário para adicionar evidências com seletores de setor/função/colaborador:
- Dropdowns integrados com `useDepartamentos` e `useCargos`
- Filtro dinâmico de funções baseado no setor selecionado
- Lista de colaboradores filtrada por setor/função
- Suporte a upload de foto, vídeo ou gravação de áudio
- Preview da mídia antes de confirmar

### 2. `AEPEvidenciasList.tsx` (NOVO)
Lista de evidências coletadas com:
- Cards agrupados por setor/função
- Preview de imagens/frames de vídeo
- Indicador de status (analisada/pendente)
- Botão para remover evidência
- Contador de evidências por função

### 3. `AEPConfigInicial.tsx` (NOVO)
Configuração inicial do documento:
- Dados da empresa (CNPJ, nome, unidade)
- Checkbox "Avaliar todos os setores"
- Multi-select de setores (se não for todos)
- Auto-carrega funções dos setores selecionados

### 4. `AEPGeneratorMulti.tsx` (NOVO)
Novo wizard com fluxo adaptado:
1. **Configuração** - Dados empresa + seleção de setores
2. **Coleta de Evidências** - Upload com contexto obrigatório
3. **Análise IA** - Processa evidências agrupadas
4. **Revisão por Função** - Editar riscos/ações por função
5. **Síntese Geral** - Consolidação dos resultados
6. **Assinaturas** - Conclusão

### 5. `AEPDocumentoPreviewMulti.tsx` (NOVO)
Preview do documento consolidado ou individual:
- Seções repetidas para cada função avaliada
- Quadro resumo com todas as funções e níveis de risco
- Opção de gerar PDF único ou múltiplos PDFs

### 6. Modificações no Assistente IA
- Adaptar para receber array de evidências
- Retornar análise agrupada por setor/função
- Novo endpoint ou adaptação do `analyze-ergonomia`

## Mudanças na Edge Function

```typescript
// Novo formato de request
interface AnaliseMultiRequest {
  tipo: 'multi';
  evidencias: {
    setor: string;
    funcao: string;
    colaborador?: string;
    imagens?: string[];
    videoFrames?: string[];
    audioBase64?: string;
    contexto?: string;
  }[];
  empresaInfo: {
    nome: string;
    unidade: string;
  };
}

// Resposta agrupada
interface AnaliseMultiResponse {
  avaliacoesPorFuncao: {
    setor: string;
    funcao: string;
    riscosIdentificados: RiscoIdentificado[];
    recomendacoes: string[];
    conformidadeEstimada: number;
    resumo: string;
  }[];
  sinteseGeral: string;
  riscosCriticosGerais: string[];
}
```

## Experiência do Usuário

### Cenário 1: Avaliação Completa da Empresa
1. Usuário seleciona "Avaliar todos os setores"
2. Sistema lista todos os setores/funções cadastrados
3. Para cada função, usuário sobe fotos/vídeos do posto de trabalho
4. Informa qual colaborador está sendo filmado (opcional)
5. IA analisa e gera relatório consolidado

### Cenário 2: Avaliação de Setor Específico
1. Usuário seleciona apenas "Produção" e "Logística"
2. Sistema filtra funções desses setores
3. Usuário coleta evidências apenas das funções desejadas
4. Gera AEP específica desses setores

### Cenário 3: Avaliação de Função Única (Fluxo Atual)
1. Mantém compatibilidade com fluxo existente
2. Usuário pode escolher "Modo simples" (uma função)

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/types/aep-multi.ts` | Novos tipos para AEP multi-função |
| `src/components/ergonomia/aep/AEPEvidenciaForm.tsx` | Formulário de evidência contextualizada |
| `src/components/ergonomia/aep/AEPEvidenciasList.tsx` | Lista de evidências coletadas |
| `src/components/ergonomia/aep/AEPConfigInicial.tsx` | Configuração inicial com seleção de setores |
| `src/components/ergonomia/aep/AEPGeneratorMulti.tsx` | Wizard multi-função |
| `src/components/ergonomia/aep/AEPRevisaoFuncao.tsx` | Edição de riscos/ações por função |
| `src/components/ergonomia/aep/AEPDocumentoPreviewMulti.tsx` | Preview do documento consolidado |
| `src/hooks/useAEPMulti.ts` | Hook para gerenciar estado do AEP multi |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/analyze-ergonomia/index.ts` | Suporte a análise multi-evidência |
| `src/pages/Ergonomia.tsx` | Toggle entre modo simples e multi |
| `src/types/aep.ts` | Exportar tipos compartilhados |

## Integração com Cadastros Existentes

O sistema utilizará os cadastros já existentes:
- **Departamentos** (`useDepartamentos`) → Setores disponíveis
- **Cargos** (`useCargos`) → Funções por departamento
- **Colaboradores** (`useColaboradores`) → Lista de pessoas por cargo/departamento

## Benefícios da Abordagem

1. **Rastreabilidade**: Cada evidência vinculada a setor/função/colaborador específico
2. **Flexibilidade**: Gerar documento único ou múltiplos por função
3. **Conformidade NR-17**: Análise por posto de trabalho/função
4. **Escalabilidade**: Avaliar toda empresa em uma única sessão
5. **Auditoria**: Histórico de evidências por avaliação
6. **Compatibilidade**: Mantém fluxo simples para avaliações pontuais
