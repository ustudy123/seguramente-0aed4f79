## Diagnóstico

Arquivo: `src/components/ponto/PontoBancoHorasTab.tsx` (linhas ~269-297) e cálculo equivalente em `horas_trabalhadas` (campo cru vindo de `ponto_diario`).

Hoje o cálculo do saldo do dia é:

```
saldo = horas_trabalhadas - jornada_esperada
if (|saldo| <= tolerancia_por_batida) saldo = 0
```

Isso gera os dois defeitos do print:

1. **01/06, 02/06, 03/06** — Entrou 07:58 (jornada 07:52, atraso 6 min = fora da tolerância de 5 min) e saiu 18:00. Como saiu "no horário", `horas_trabalhadas` = 8h32 e `esperado` também = 8h32 (a jornada esperada está sendo derivada do `horas_trabalhadas` cru quando não há bloco). Resultado: saldo 0 = "—". **Correto seria −6 min por dia** (atraso fora da tolerância deve debitar, e a saída pontual não compensa).

2. **08/06** — Entrou 07:54 (dentro dos 5 min de tolerância → deveria valer 07:52) e saiu 18:30 (30 min após o fim da jornada). Sistema mostra **+28 min** em vez de **+30 min**, porque calcula `9h06 (trabalhado bruto) − 8h38 (esperado)` em vez de aplicar a tolerância *na batida* (arredondar entrada para 07:52) e comparar contra a jornada oficial.

**Causa raiz:** a tolerância está sendo aplicada ao **saldo consolidado**, não à **batida individual**. Além disso o cálculo compara `horas_trabalhadas` (tempo cru bater–bater) contra `jornada_esperada` derivada da própria batida — o que "auto-anula" atrasos quando a saída é pontual.

## Plano de correção

Reescrever a apuração diária para trabalhar com **horário oficial ajustado por tolerância**, tanto na UI (`PontoBancoHorasTab`) quanto na RPC SQL usada por Espelho/Fechamento, para manter os números idênticos entre tela e relatório.

### 1. Nova função utilitária `calcularSaldoDia`

Criar `src/lib/ponto/calcularSaldoDia.ts` recebendo:
- `entradaReal`, `saidaReal` (HH:MM da marcação)
- `entradaEscala`, `saidaEscala`, `intervaloMin` (blocos da escala do dia)
- `toleranciaBatidaMin` (default 5)
- `jornadaEsperadaMin`

Regras:
- Se `entradaReal ≤ entradaEscala + tol` → entrada considerada = `entradaEscala`; caso contrário, `entradaReal` (atraso vira débito integral, não só o excedente da tolerância — a tolerância só "perdoa" quem está dentro dela).
- Se `saidaReal ≥ saidaEscala − tol` e `< saidaEscala` → saída considerada = `saidaEscala`. Se `saidaReal ≥ saidaEscala` → saída considerada = `saidaReal` (extras contam integralmente).
- `trabalhadoAjustado = (saidaConsiderada − entradaConsiderada) − intervalo`.
- `saldo = trabalhadoAjustado − jornadaEsperada`.
- **Remover** o bloco `if (|saldo| ≤ tol) saldo = 0` — a tolerância já foi absorvida na batida.

### 2. Integrar em `PontoBancoHorasTab.tsx`

- Buscar também os blocos da escala (`ponto_escala_blocos` via `ponto_jornada_do_dia` ou nova RPC) para conhecer `hora_entrada`, `hora_saida` e `intervalo` do dia.
- Substituir o cálculo atual das linhas 269-297 pela chamada a `calcularSaldoDia`.
- Manter os "dias protegidos" (atestado/férias/afastamento/feriado/justificado) neutralizando o saldo.

### 3. Alinhar a RPC de apuração

Atualizar a função SQL usada por Espelho/Fechamento (`ponto_apuracao_dia` / equivalente) com a mesma regra, para não divergir entre telas. Migração apenas altera a função — sem mudança de schema.

### 4. Validação

- Reprocessar a competência do print e conferir:
  - 01–03/06 → saldo diário = **−6 min** cada (débito de 18 min no acumulado dessas linhas).
  - 08/06 → saldo diário = **+30 min**.
- Rodar o botão "Recalcular apuração" para atualizar `ponto_diario.horas_extras / horas_faltantes`.

## Detalhes técnicos

- Arquivos alterados: `src/lib/ponto/calcularSaldoDia.ts` (novo), `src/components/ponto/PontoBancoHorasTab.tsx`, migração SQL da função de apuração.
- Sem mudança de schema, sem breaking change em telas consumidoras (todas leem `saldo_minutos`).
- Testes manuais nos 3 cenários: atraso fora da tolerância, atraso dentro da tolerância, saída antecipada dentro da tolerância, extras reais.