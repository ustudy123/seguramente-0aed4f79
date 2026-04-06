

## Diagnóstico: Inconsistência nas Faixas de Classificação do IRP-S

### O que está acontecendo

O sistema tem dois índices complementares:

```text
IPS  (Índice Psicossocial)         → maior = melhor (saúde)
IRP-S (Índice de Risco Psicossocial) → maior = pior  (risco)

Relação: IRP-S = 100 - IPS
```

O texto "Score 0–100: quanto maior, maior o risco organizacional" **está correto** para o IRP-S. Não precisa inverter.

**O problema real** é que as faixas de classificação do IRP-S não espelham as do IPS:

```text
FAIXAS IPS (atuais — corretas):
  80-100 → Saudável
  65-79  → Estável
  50-64  → Atenção
  35-49  → Risco
   0-34  → Crítico

FAIXAS IRP-S (atuais — ERRADAS):
   0-24  → Saudável     ← deveria ser 0-20
  25-49  → Atenção      ← deveria ser Estável até 35
  50-74  → Risco
  75-100 → Risco Elevado

FAIXAS IRP-S CORRIGIDAS (espelhando IPS):
   0-20  → Saudável      (= IPS 80-100)
  21-35  → Estável        (= IPS 65-79)
  36-50  → Atenção        (= IPS 50-64)
  51-65  → Risco          (= IPS 35-49)
  66-100 → Risco Crítico  (= IPS 0-34)
```

Com as faixas atuais, IRP-S **31** = "Atenção", mas o IPS equivalente seria **69** = "Estável". Isso gera a confusão que você está vendo.

### Plano de Correção

**Arquivo 1: `src/types/psicossocial.ts`**
- Atualizar o tipo `IRPSClassificacao` para incluir 5 níveis (espelhando IPS): `saudavel | estavel | atencao | risco | critico`
- Corrigir a função `calcularIRPSClassificacao` com as faixas espelhadas
- Atualizar `getIRPSColor`, `getIRPSBgColor` e `getIRPSLabel` para os 5 níveis

**Arquivo 2: `src/components/avaliacoes/psicossocial/ResultadosModal.tsx`**
- Atualizar a função `getNivelScore` (linha 139) para usar as mesmas faixas corrigidas

**Arquivo 3: `src/data/instrumentos/index.ts`**
- Alinhar o tipo `NivelIRPS` e funções auxiliares (`getLabelNivelIRPS`, `getCorNivelIRPS`, `getBgNivelIRPS`) com os novos 5 níveis

**Arquivo 4: `src/test/psicossocial-types.test.ts`**
- Atualizar testes para refletir os novos thresholds

### Resultado esperado

Com IRP-S = 31 → classificação **"Estável"** (verde-azul), coerente com IPS = 69 que também é "Estável".

