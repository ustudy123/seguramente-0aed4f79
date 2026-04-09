

## Análise da Redundância no Dashboard

### Problema identificado

O dashboard atual tem **5 seções**:
1. **PilaresSummaryLive** — resumo compacto dos 4 pilares (Maturidade + Score geral)
2. **QuickActions** — 6 botões de ação rápida
3. **DashboardPilares** — cards coloridos detalhados dos mesmos 4 pilares (repete Maturidade, métricas)
4. **RecentActivity** — sempre vazio ("Nenhuma atividade registrada")
5. **PendingTasks** — pendências (já existe módulo dedicado /pendencias)

A seção 3 (DashboardPilares) é **completamente redundante** com a seção 1 (PilaresSummaryLive) — ambas mostram os mesmos 4 pilares, mesmos scores de maturidade, mesmos dados. A seção 4 (RecentActivity) está sempre vazia e não agrega valor.

### Proposta de Reestruturação

Remover as seções redundantes e substituí-las por informações operacionais realmente úteis:

```text
┌──────────────────────────────────────────────┐
│  Header (Dashboard + data)                   │
├──────────────────────────────────────────────┤
│  Governança do Trabalho Humano               │
│  (PilaresSummaryLive - MANTÉM como está)     │
├──────────────────────────────────────────────┤
│  KPIs Operacionais (NOVO)                    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │Colab│ │Admis│ │EPIs │ │Docs │ │Aval │ │Metas│
│  │ ativos│ pend│ baixo│ pend│ pend│ ativas│  │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘  │
├──────────────────────────────────────────────┤
│  Ações Rápidas (MANTÉM)                      │
├───────────────────────┬──────────────────────┤
│  Pendências (2/3)     │ Alertas Críticos(1/3)│
│  (MANTÉM)             │ (NOVO - EPIs vencidos│
│                       │  docs expirados, etc)│
└───────────────────────┴──────────────────────┘
```

### Mudanças detalhadas

**1. Remover: DashboardPilares (seção "Detalhamento por Pilar")**
- Totalmente redundante com PilaresSummaryLive
- Os dados detalhados já são acessíveis clicando nos pilares do resumo (abre modal IndicatorDetailModal)

**2. Remover: RecentActivity**
- Componente sempre vazio, sem integração real com dados

**3. Novo: KPIs Operacionais**
- Linha de cards compactos com números-chave do dia-a-dia:
  - **Colaboradores Ativos** (total da empresa ativa)
  - **Admissões Pendentes** (já disponível em `useDashboardData`)
  - **EPIs Estoque Baixo** (já disponível)
  - **Documentos Pendentes** (do `usePendencias`)
  - **Avaliações Pendentes** (do `usePendencias`)
  - **Metas Ativas** (query ao `metas_module`)
- Cada card é clicável e leva ao módulo correspondente

**4. Novo: Alertas Críticos (substituindo RecentActivity)**
- Card compacto listando itens que requerem atenção imediata:
  - EPIs vencidos ou em estoque crítico
  - Documentos próximos do vencimento
  - Ouvidoria pendente
  - Riscos ergonômicos ativos
- Dados já disponíveis via `useDashboardData` e `usePendencias`

### Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `src/pages/Dashboard.tsx` | Reestruturar layout: remover DashboardPilares e RecentActivity, adicionar novos componentes |
| `src/components/dashboard/DashboardKPIs.tsx` | **Criar** — cards de KPIs operacionais |
| `src/components/dashboard/AlertasCriticos.tsx` | **Criar** — lista de alertas que precisam de ação |
| `src/hooks/useDashboardData.ts` | Adicionar query para metas ativas e colaboradores |
| `src/components/dashboard/DashboardPilares.tsx` | Pode ser mantido no código mas removido do Dashboard |
| `src/components/dashboard/RecentActivity.tsx` | Sem uso, removido do Dashboard |

### Resultado

- Dashboard mais enxuto e focado no que importa operacionalmente
- Sem duplicação de informação
- KPIs acionáveis com navegação direta
- Alertas que demandam ação imediata em destaque

