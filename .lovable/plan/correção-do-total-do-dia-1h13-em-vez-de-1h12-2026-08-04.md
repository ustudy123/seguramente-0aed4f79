# Correção do total do dia: 1h13 em vez de 1h12

## O que está acontecendo

As batidas da Kailaine em 30/06/2026 têm segundos gravados:

- Entrada: 07:38:10
- Saída: 08:50:44

A diferença real é 1h12min34s.

- O card de cada período no Espelho mostra a diferença apenas de hora:minuto (07:38 → 08:50) = **1h12**.
- O "Total do dia" e a Edição do Banco de Horas vêm da consolidação no banco, que converte a diferença em minutos **arredondando** (72,57 → 73) = **1h13**.

Ou seja, não é erro de escala nem de tolerância: é diferença de critério de arredondamento entre a tela (trunca os segundos) e o banco (arredonda para o minuto mais próximo). Confirmado no registro consolidado do dia: `horas_trabalhadas = 01:13:00`.

## Sobre a explicação do atestado

A hipótese de que o dia caiu no caminho do abono de atestado (grava abono e retorna antes de recalcular as horas) não se aplica a esse dia. Esse caminho existe mesmo no código, mas só é acionado para atestado de dia cheio, e nele o registro fica com `status = 'justificado'`, sem entrada/saída. O registro de 30/06 da Kailaine está com `status = 'regular'`, entrada 07:38:10 e saída 08:50:44 — passou pelo cálculo normal. A causa é o arredondamento de 72,57 min para 73.



## Correção proposta

Adotar um único critério — desprezar os segundos (truncar), como o RH espera e como o cartão de ponto normalmente é lido:

1. Ajustar a função de consolidação diária (`_ponto_calc_dia`) para truncar a diferença de cada par entrada/saída ao minuto (`floor`), em vez de arredondar.
2. Reconsolidar os dias afetados para que `ponto_diario` passe a gravar 1h12 nesses casos.
3. Com isso, Espelho (período), Total do dia e Edição do Banco de Horas passam a exibir o mesmo valor.

## Detalhes técnicos

- Migração alterando `public._ponto_calc_dia`: substituir `(EXTRACT(EPOCH FROM (saida - entrada))/60)::INT` por `FLOOR(EXTRACT(EPOCH FROM (saida - entrada))/60)::INT`.
- Após a migração, rodar reconsolidação (`consolidar_ponto_dia_todos` / `consolidar_ponto_diario_manual`) para as competências abertas afetadas, e reapurar o banco de horas dessas competências.
- Nenhuma mudança de front-end é necessária — o Espelho já trunca.

## Impacto

- Diferenças de no máximo 1 minuto por par de batidas, sempre a favor do critério mais conservador (não credita minuto não trabalhado).
- Não altera regras de tolerância, escala, feriados ou abonos.
