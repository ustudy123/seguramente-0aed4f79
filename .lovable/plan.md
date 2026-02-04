
# Plano: Módulo de Avaliações de Desempenho

## Resumo Executivo

Implementar um módulo completo de **Avaliações de Desempenho** com suporte a:
- **Templates customizáveis** de avaliação com diferentes critérios e competências
- **Ciclos de avaliação 360°** com múltiplos avaliadores (gestor, pares, subordinados, autoavaliação)
- **Gestão de Metas e OKRs** com acompanhamento de progresso
- **Integração com Plano de Ação** para criar ações de desenvolvimento

---

## Arquitetura de Dados

### Diagrama Entidade-Relacionamento

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         TABELAS PRINCIPAIS                              │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│ avaliacao_templates  │       │   avaliacao_ciclos   │
├──────────────────────┤       ├──────────────────────┤
│ id                   │       │ id                   │
│ tenant_id            │       │ tenant_id            │
│ nome                 │       │ nome                 │
│ descricao            │       │ template_id ─────────┼──> avaliacao_templates
│ tipo (360, simples)  │       │ status (ativo, etc)  │
│ categorias (json)    │       │ data_inicio          │
│ criterios (json)     │       │ data_fim             │
│ escala_min/max       │       │ participantes (json) │
│ ativo                │       │ config_360 (json)    │
└──────────────────────┘       └──────────────────────┘
           │                              │
           │                              │
           ▼                              ▼
┌──────────────────────┐       ┌──────────────────────┐
│ avaliacao_respostas  │       │ avaliacao_feedbacks  │
├──────────────────────┤       ├──────────────────────┤
│ id                   │       │ id                   │
│ ciclo_id ────────────┼──>    │ resposta_id ─────────┼──> avaliacao_respostas
│ avaliado_id          │       │ autor_id             │
│ avaliador_id         │       │ tipo (ponto_forte,   │
│ tipo_avaliacao       │       │      desenvolvimento)│
│ notas_criterios(json)│       │ competencia          │
│ nota_geral           │       │ descricao            │
│ status               │       │ visivel_avaliado     │
│ data_conclusao       │       └──────────────────────┘
└──────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│       metas          │       │     meta_okrs        │
├──────────────────────┤       ├──────────────────────┤
│ id                   │       │ id                   │
│ tenant_id            │       │ tenant_id            │
│ colaborador_id       │       │ meta_id ─────────────┼──> metas
│ titulo               │       │ key_result           │
│ descricao            │       │ tipo (percentual,    │
│ tipo (individual,    │       │       quantidade)    │
│       equipe)        │       │ valor_atual          │
│ periodo (Q1, anual)  │       │ valor_alvo           │
│ prazo                │       │ progresso            │
│ peso                 │       │ status               │
│ status               │       │ updated_at           │
│ progresso            │       └──────────────────────┘
│ vinculo_ciclo_id     │
└──────────────────────┘

┌──────────────────────┐
│ avaliacao_9box       │
├──────────────────────┤
│ id                   │
│ tenant_id            │
│ colaborador_id       │
│ ciclo_id             │
│ desempenho (1-3)     │
│ potencial (1-3)      │
│ quadrante            │
│ data_avaliacao       │
│ avaliador_id         │
│ justificativa        │
└──────────────────────┘
```

---

## Funcionalidades por Módulo

### 1. Templates de Avaliação

**Tela: Gestão de Templates**
- Lista de templates com status (ativo/inativo)
- Criação de templates com:
  - Nome e descrição
  - Tipo: Simples (gestor avalia) ou 360° (múltiplos avaliadores)
  - Categorias de competências (ex: Técnica, Comportamental, Liderança)
  - Critérios dentro de cada categoria com peso
  - Escala de notas configurável (1-5, 1-10, conceitos A-E)
- Templates pré-definidos sugeridos (Competências Básicas, Liderança, Técnico)

### 2. Ciclos de Avaliação

**Tela: Gestão de Ciclos**
- Lista de ciclos com status (rascunho, ativo, encerrado, analisando)
- Criação de ciclo:
  - Seleção do template
  - Período de avaliação (datas início/fim)
  - Seleção de participantes (individual, departamento, todos)
  - Configuração 360°:
    - Autoavaliação (sim/não)
    - Avaliação do gestor (sim/não)
    - Avaliação de pares (quantidade mínima/máxima)
    - Avaliação de subordinados (se aplicável)
- Dashboard do ciclo:
  - Progresso geral (% concluídas)
  - Pendências por avaliador
  - Alertas de prazo

### 3. Avaliação 360°

**Tela: Minha Caixa de Avaliações**
- Lista de avaliações pendentes onde sou avaliador
- Lista de avaliações sobre mim (quando encerradas)
- Interface de resposta:
  - Critérios agrupados por categoria
  - Escala visual (estrelas, slider, radio)
  - Campo de feedback por competência
  - Pontos fortes e áreas de desenvolvimento
  - Comentário geral

**Relatório Individual (pós-ciclo)**
- Radar chart com médias por categoria
- Comparativo: Autoavaliação vs Gestor vs Pares
- Feedbacks consolidados (anônimos se 360°)
- Gap analysis (diferença entre percepções)
- Sugestões de PDI geradas por IA

### 4. Metas e OKRs

**Tela: Gestão de Metas**
- Lista de metas do colaborador/equipe
- Criação de meta:
  - Título e descrição
  - Tipo: Individual, Equipe, Departamento
  - Período: Trimestral, Semestral, Anual
  - Peso na avaliação
  - Key Results (KRs):
    - Descrição do resultado
    - Tipo de medição (%, número, binário)
    - Valor inicial, atual e alvo
- Acompanhamento:
  - Atualização de progresso
  - Histórico de atualizações
  - Check-ins periódicos

**Dashboard de OKRs**
- Árvore de objetivos (empresa > departamento > individual)
- Progresso visual por objetivo
- Alertas de metas atrasadas

### 5. Matriz 9-Box

**Tela: Matriz 9-Box**
- Grid visual 3x3 (Desempenho x Potencial)
- Arrastar e soltar colaboradores
- Filtros por departamento/ciclo
- Justificativa por posicionamento
- Sugestões de ações por quadrante

---

## Componentes a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/types/avaliacao.ts` | Tipos para templates, ciclos, respostas, metas, OKRs |
| `src/hooks/useAvaliacoes.ts` | Hook principal com queries e mutations |
| `src/hooks/useMetas.ts` | Hook para gestão de metas e OKRs |
| `src/pages/Avaliacoes.tsx` | Página principal com tabs |

**Componentes de Templates:**
| Arquivo | Descrição |
|---------|-----------|
| `src/components/avaliacoes/templates/TemplateList.tsx` | Lista de templates |
| `src/components/avaliacoes/templates/TemplateForm.tsx` | Formulário de criação/edição |
| `src/components/avaliacoes/templates/CriterioEditor.tsx` | Editor de critérios por categoria |

**Componentes de Ciclos:**
| Arquivo | Descrição |
|---------|-----------|
| `src/components/avaliacoes/ciclos/CicloList.tsx` | Lista de ciclos |
| `src/components/avaliacoes/ciclos/CicloForm.tsx` | Wizard de criação de ciclo |
| `src/components/avaliacoes/ciclos/CicloDashboard.tsx` | Dashboard de acompanhamento |
| `src/components/avaliacoes/ciclos/CicloParticipantes.tsx` | Seleção de participantes |

**Componentes de Avaliação:**
| Arquivo | Descrição |
|---------|-----------|
| `src/components/avaliacoes/resposta/AvaliacaoInbox.tsx` | Caixa de avaliações pendentes |
| `src/components/avaliacoes/resposta/AvaliacaoForm.tsx` | Formulário de resposta |
| `src/components/avaliacoes/resposta/CriterioRating.tsx` | Componente de rating por critério |
| `src/components/avaliacoes/resposta/FeedbackSection.tsx` | Seção de feedbacks |

**Componentes de Resultados:**
| Arquivo | Descrição |
|---------|-----------|
| `src/components/avaliacoes/resultados/RelatorioIndividual.tsx` | Relatório do avaliado |
| `src/components/avaliacoes/resultados/RadarChart360.tsx` | Gráfico radar comparativo |
| `src/components/avaliacoes/resultados/GapAnalysis.tsx` | Análise de gaps |
| `src/components/avaliacoes/resultados/Matriz9Box.tsx` | Grid interativo 9-Box |

**Componentes de Metas/OKRs:**
| Arquivo | Descrição |
|---------|-----------|
| `src/components/avaliacoes/metas/MetasList.tsx` | Lista de metas |
| `src/components/avaliacoes/metas/MetaForm.tsx` | Formulário de meta com KRs |
| `src/components/avaliacoes/metas/MetaProgress.tsx` | Atualização de progresso |
| `src/components/avaliacoes/metas/OKRTree.tsx` | Árvore hierárquica de OKRs |
| `src/components/avaliacoes/metas/MetaDashboard.tsx` | Dashboard de OKRs |

---

## Tabelas do Banco de Dados

### Migrações Necessárias

```sql
-- 1. Enum para tipos
CREATE TYPE avaliacao_tipo AS ENUM ('simples', '360');
CREATE TYPE avaliacao_status AS ENUM ('rascunho', 'ativo', 'encerrado', 'analisando');
CREATE TYPE resposta_status AS ENUM ('pendente', 'em_andamento', 'concluida');
CREATE TYPE tipo_avaliador AS ENUM ('auto', 'gestor', 'par', 'subordinado');
CREATE TYPE meta_periodo AS ENUM ('mensal', 'trimestral', 'semestral', 'anual');
CREATE TYPE meta_status AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'cancelada', 'atrasada');
CREATE TYPE okr_tipo AS ENUM ('percentual', 'quantidade', 'binario', 'monetario');

-- 2. Templates de Avaliação
CREATE TABLE avaliacao_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo avaliacao_tipo NOT NULL DEFAULT 'simples',
  categorias JSONB NOT NULL DEFAULT '[]',
  criterios JSONB NOT NULL DEFAULT '[]',
  escala_min INTEGER NOT NULL DEFAULT 1,
  escala_max INTEGER NOT NULL DEFAULT 5,
  escala_labels JSONB,
  permite_comentarios BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ciclos de Avaliação
CREATE TABLE avaliacao_ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_id UUID NOT NULL REFERENCES avaliacao_templates(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  status avaliacao_status NOT NULL DEFAULT 'rascunho',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  config_360 JSONB DEFAULT '{"auto": true, "gestor": true, "pares": 0, "subordinados": false}',
  departamentos_ids UUID[],
  notificacoes_enviadas BOOLEAN DEFAULT false,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Respostas de Avaliação
CREATE TABLE avaliacao_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ciclo_id UUID NOT NULL REFERENCES avaliacao_ciclos(id) ON DELETE CASCADE,
  avaliado_id TEXT NOT NULL,
  avaliado_nome TEXT NOT NULL,
  avaliador_id UUID,
  avaliador_nome TEXT,
  tipo_avaliador tipo_avaliador NOT NULL,
  status resposta_status NOT NULL DEFAULT 'pendente',
  notas_criterios JSONB DEFAULT '{}',
  nota_geral NUMERIC(3,1),
  comentario_geral TEXT,
  pontos_fortes TEXT,
  areas_desenvolvimento TEXT,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Feedbacks por Competência
CREATE TABLE avaliacao_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  resposta_id UUID NOT NULL REFERENCES avaliacao_respostas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  criterio TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Metas
CREATE TABLE metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  colaborador_id TEXT,
  colaborador_nome TEXT,
  departamento_id UUID,
  departamento_nome TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'individual',
  periodo meta_periodo NOT NULL DEFAULT 'trimestral',
  ano INTEGER NOT NULL,
  trimestre INTEGER,
  data_inicio DATE,
  data_fim DATE,
  peso NUMERIC(5,2) DEFAULT 1,
  status meta_status NOT NULL DEFAULT 'nao_iniciada',
  progresso INTEGER NOT NULL DEFAULT 0,
  vinculo_ciclo_id UUID REFERENCES avaliacao_ciclos(id),
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Key Results (OKRs)
CREATE TABLE meta_okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  meta_id UUID NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  key_result TEXT NOT NULL,
  descricao TEXT,
  tipo okr_tipo NOT NULL DEFAULT 'percentual',
  valor_inicial NUMERIC(15,2) DEFAULT 0,
  valor_atual NUMERIC(15,2) DEFAULT 0,
  valor_alvo NUMERIC(15,2) NOT NULL,
  unidade TEXT,
  progresso INTEGER NOT NULL DEFAULT 0,
  status meta_status NOT NULL DEFAULT 'nao_iniciada',
  responsavel_id UUID,
  responsavel_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Check-ins de OKR
CREATE TABLE okr_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  okr_id UUID NOT NULL REFERENCES meta_okrs(id) ON DELETE CASCADE,
  valor_anterior NUMERIC(15,2),
  valor_novo NUMERIC(15,2) NOT NULL,
  observacao TEXT,
  realizado_por UUID,
  realizado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Matriz 9-Box
CREATE TABLE avaliacao_9box (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ciclo_id UUID REFERENCES avaliacao_ciclos(id),
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  desempenho INTEGER NOT NULL CHECK (desempenho BETWEEN 1 AND 3),
  potencial INTEGER NOT NULL CHECK (potencial BETWEEN 1 AND 3),
  quadrante TEXT NOT NULL,
  justificativa TEXT,
  avaliador_id UUID,
  avaliador_nome TEXT,
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Estrutura da Página Principal

```text
┌─────────────────────────────────────────────────────────────────┐
│  Avaliações de Desempenho                                       │
│  Gestão de performance, competências e desenvolvimento          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Stats Cards: Ciclos Ativos | Pendentes | Taxa Conclusão]      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┬───────────┬─────────┬───────────┬─────────┐      │
│  │ Minha    │ Ciclos    │ Metas   │ Templates │ 9-Box   │      │
│  │ Caixa    │           │ & OKRs  │           │         │      │
│  └──────────┴───────────┴─────────┴───────────┴─────────┘      │
│                                                                 │
│  [Conteúdo da Tab Selecionada]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integrações

### 1. Com Plano de Ação
- Ao identificar áreas de desenvolvimento, criar ação de PDI
- Vincular meta não atingida a ação corretiva
- Gerar ações automaticamente para quadrantes críticos do 9-Box

### 2. Com Colaboradores
- Buscar lista de colaboradores via `useColaboradores`
- Buscar gestores e subordinados via hierarquia de departamentos
- Identificar pares do mesmo departamento

### 3. Com Cadastros
- Usar departamentos para filtros e agrupamentos
- Usar cargos para sugerir competências relevantes

---

## Fluxo de Implementação

### Fase 1: Fundação (Este Sprint)
1. Criar tabelas no banco de dados
2. Implementar tipos TypeScript
3. Criar hooks `useAvaliacoes` e `useMetas`
4. Página base com tabs

### Fase 2: Templates e Ciclos
5. Gestão de templates
6. Criação de ciclos com seleção de participantes
7. Dashboard de acompanhamento do ciclo

### Fase 3: Avaliações 360°
8. Caixa de avaliações pendentes
9. Formulário de resposta com critérios
10. Consolidação de resultados

### Fase 4: Metas e OKRs
11. CRUD de metas
12. Key Results com check-ins
13. Dashboard de OKRs

### Fase 5: Resultados e Análises
14. Relatório individual
15. Radar chart comparativo
16. Matriz 9-Box interativa

---

## Experiência do Usuário

### Cenário 1: Gestor Cria Ciclo de Avaliação
1. Acessa Avaliações > Ciclos > Novo Ciclo
2. Seleciona template "Competências Comportamentais"
3. Define período (01/03 a 31/03)
4. Seleciona departamento "Comercial"
5. Configura 360°: Auto + Gestor + 2 Pares
6. Sistema identifica participantes automaticamente
7. Ativa ciclo e dispara notificações

### Cenário 2: Colaborador Responde Avaliação
1. Vê badge de pendência no menu lateral
2. Acessa "Minha Caixa"
3. Seleciona avaliação pendente
4. Responde critérios por categoria
5. Adiciona comentários e feedbacks
6. Submete avaliação

### Cenário 3: RH Analisa Resultados
1. Ciclo encerra automaticamente
2. Sistema consolida notas por avaliador
3. Gera radar chart comparativo
4. Identifica gaps entre autoavaliação e gestores
5. Sugere ações de desenvolvimento via IA
6. Posiciona colaboradores na matriz 9-Box

---

## Observações Técnicas

- Seguir padrão de hooks existente (`usePlanoAcao`, `useErgonomia`)
- Utilizar React Query para cache e invalidação
- RLS policies seguindo o padrão multi-tenant existente
- Integrar com o sidebar via rota `/avaliacoes`
- Remover do PlaceholderPage após implementação
