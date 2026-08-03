# Cobertura dos 13 fatores em todos os instrumentos

## O problema

O catálogo NR-01/ISO 45003 tem 13 fatores, mas nenhum instrumento cobre todos:

- COPSOQ II-Br: não cobre "Más relações no ambiente de trabalho" e "Trabalho em condições de difícil comunicação".
- COPSOQ III: não cobre "Más relações", "Baixa justiça organizacional", "Trabalho remoto e isolado" e "Difícil comunicação".
- SIPRO, HSE e PROART: lacunas semelhantes.

Por isso o inventário mostra linhas "Não avaliado". A única forma legítima de eliminar isso é **perguntar** sobre os fatores faltantes — inventar score sem item respondido descaracteriza o laudo.

## Solução proposta: Bloco Complementar NR-01

Um bloco fixo e curto de itens, anexado automaticamente a qualquer instrumento escolhido, cobrindo exatamente os fatores que aquele instrumento não alcança. O respondente não escolhe: o sistema calcula a lacuna do instrumento e injeta só o que falta (tipicamente 8 a 14 perguntas a mais).

Cobertura do bloco (2 itens por fator, escala igual à do instrumento):

| Fator | Exemplo de item |
| --- | --- |
| Más relações no ambiente de trabalho | "Existem conflitos ou atritos frequentes entre as pessoas da minha equipe." |
| Trabalho em condições de difícil comunicação | "As informações necessárias para o meu trabalho chegam a tempo e de forma clara." |
| Baixa justiça organizacional | "As decisões sobre promoções, escalas e tarefas são tomadas de forma justa." |
| Trabalho remoto e isolado | "Trabalho sozinho(a) ou distante da equipe por longos períodos." |
| Assédio de qualquer natureza | "Presenciei ou sofri situações de assédio moral ou sexual no trabalho." |
| Eventos violentos ou traumáticos | "Estou exposto(a) a agressões, ameaças ou situações de violência no trabalho." |
| Baixa demanda (subcarga) | "Meu trabalho é repetitivo e aquém da minha qualificação." |

Os itens só entram quando o instrumento não cobre o fator — quem aplica o COPSOQ II-Br responde apenas 2 blocos extras; quem aplica o SIPRO responde 5.

## Como fica no relatório

- Inventário passa a mostrar 13/13 avaliados, com a coluna de origem indicando "Instrumento" ou "Bloco Complementar NR-01".
- Campanhas já respondidas (histórico) continuam com "Não avaliado" — não há resposta para esses itens. O PDF ganha nota de rodapé explicando que a cobertura complementar entrou a partir da data X.

## Alternativa (não recomendada como principal)

Estimar o fator faltante por correlação com dimensões próximas (ex.: "Más relações" a partir de Suporte dos Pares + Conflitos). Elimina o "Não avaliado" sem novas perguntas, mas é score inferido — pode ser questionado em fiscalização. Cabe como complemento marcado "Estimado por proxy" apenas para campanhas antigas, se você quiser.

## Detalhes técnicos

1. `src/data/instrumentos/complementoNR1.ts` (novo): dimensões do bloco, uma por fator faltante, com `fatorId` explícito do catálogo (sem depender de match por alias).
2. `src/data/instrumentos/index.ts`: função `montarInstrumentoComCobertura(instrumento)` que resolve os fatores cobertos via `resolverFatorPorSubject`, calcula a lacuna e concatena as dimensões do complemento.
3. Tela de resposta do questionário: consumir o instrumento montado, com o bloco complementar em seção própria ("Bloco Complementar NR-01").
4. Cálculo de radar/IPS: incluir as dimensões complementares no mesmo pipeline; sem mudança de fórmula.
5. `resolverFatorPorSubject`: aceitar `fatorId` direto quando a dimensão o declarar, evitando qualquer ambiguidade de alias.
6. `inventarioDiagnosticoPsicossocial.ts` e `fatoresRiscoPsicossocial.ts`: manter `completarComCatalogo` como rede de segurança para campanhas antigas.
7. Teste em `src/test/`: para cada instrumento, `montarInstrumentoComCobertura` deve resolver os 13 fatores.
8. Sem mudanças de banco — as respostas usam a mesma estrutura de itens já existente.
