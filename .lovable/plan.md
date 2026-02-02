
# Plano: Auto-preenchimento do campo "Por quê" ao selecionar sugestão de ação

## Objetivo
Quando o usuário clicar em uma sugestão de ação nos radares de Burnout, Boreout ou Energia, o campo "POR QUÊ (Why)" será automaticamente preenchido com uma justificativa contextual e coerente com a ação selecionada.

---

## Alterações Necessárias

### 1. Atualizar Configuração dos Fatores (`radarConfig.ts`)

Transformar o array de `sugestoes` (strings simples) em um array de objetos contendo:
- `titulo`: O título da ação (o que já existe hoje)
- `porque`: A justificativa automática para aquela ação

**Exemplo da estrutura atual:**
```typescript
sugestoes: [
  'Implementar rodízio de tarefas complexas',
  'Criar pausas programadas para recuperação mental',
]
```

**Nova estrutura:**
```typescript
sugestoes: [
  { 
    titulo: 'Implementar rodízio de tarefas complexas',
    porque: 'Reduzir a sobrecarga mental causada pela exposição prolongada a tarefas de alta complexidade cognitiva'
  },
  { 
    titulo: 'Criar pausas programadas para recuperação mental',
    porque: 'Permitir recuperação cognitiva adequada e prevenir fadiga mental acumulada'
  },
]
```

Isso será aplicado a todos os fatores dos três radares:
- **Burnout** (6 fatores × 4 sugestões = 24 pares título/porquê)
- **Boreout** (5 fatores × 4 sugestões = 20 pares título/porquê)
- **Energia** (4 fatores × 4 sugestões = 16 pares título/porquê)

---

### 2. Atualizar o Componente de Formulário (`FatorActionForm.tsx`)

Modificar a interface e lógica para:

1. **Atualizar a prop `sugestoes`** para aceitar objetos em vez de strings
2. **Modificar `handleSugestaoSelect`** para preencher tanto o `titulo` quanto o `porque`:

```typescript
const handleSugestaoSelect = (sugestao: { titulo: string; porque: string }) => {
  setSelectedSugestao(sugestao.titulo);
  setFormData(prev => ({
    ...prev,
    titulo: sugestao.titulo,
    porque: sugestao.porque,  // <-- Novo auto-preenchimento
  }));
};
```

3. **Atualizar o estado `selectedSugestao`** para armazenar apenas o título (para comparação visual)

---

### 3. Atualizar Tipagem

Criar um tipo para as sugestões estruturadas:

```typescript
interface SugestaoAcao {
  titulo: string;
  porque: string;
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ergonomia/radar/radarConfig.ts` | Converter sugestões de string[] para objeto[] com título e porquê |
| `src/components/ergonomia/radar/FatorActionForm.tsx` | Atualizar interface e lógica de seleção |

---

## Justificativas Contextuais (Exemplos)

### Radar de Burnout - Sobrecarga Cognitiva
| Sugestão | Justificativa (Porquê) |
|----------|------------------------|
| Implementar rodízio de tarefas complexas | Reduzir a sobrecarga mental causada pela exposição prolongada a tarefas de alta complexidade cognitiva |
| Criar pausas programadas para recuperação mental | Permitir recuperação cognitiva adequada e prevenir fadiga mental acumulada |

### Radar de Boreout - Baixo Desafio
| Sugestão | Justificativa (Porquê) |
|----------|------------------------|
| Mapear competências e realocá-las | Aproveitar melhor o potencial dos colaboradores e reduzir a subutilização de habilidades |
| Criar projetos especiais desafiadores | Estimular o engajamento através de desafios que correspondam às capacidades do colaborador |

### Radar de Energia - Vitalidade
| Sugestão | Justificativa (Porquê) |
|----------|------------------------|
| Promover atividades físicas | Aumentar os níveis de energia física e mental através do exercício regular |
| Melhorar qualidade do ambiente | Criar condições ambientais que favoreçam o bem-estar e a disposição dos colaboradores |

---

## Comportamento Esperado

1. Usuário clica em um fator do radar (ex: "Sobrecarga Cognitiva")
2. Abre o formulário de ação com sugestões em badges
3. Ao clicar em uma sugestão (ex: "Implementar rodízio de tarefas"):
   - Campo "O QUÊ" é preenchido com: "Implementar rodízio de tarefas complexas"
   - Campo "POR QUÊ" é preenchido com: "Reduzir a sobrecarga mental causada pela exposição prolongada a tarefas de alta complexidade cognitiva"
4. O usuário pode editar ambos os campos se desejar personalizar
5. Demais campos 5W2H continuam disponíveis para preenchimento manual
