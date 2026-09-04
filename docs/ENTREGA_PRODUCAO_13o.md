# 13º Salário — roteiro de entrega em PRODUÇÃO

Referência: YE-DP-13-001. Este roteiro cobre as cinco entregas do módulo.
**Nada aqui roda sozinho**: cada passo é você colando um arquivo no SQL Editor
do projeto de produção (`diayjpsrcerycycyaxst`).

## Antes de começar

- Reserve ~20 minutos e faça fora do horário de fechamento de folha.
- Rode **um script por vez, na ordem**, e só passe ao próximo depois de ver a
  conferência do anterior. O SQL Editor mostra apenas o último resultado —
  cada script termina com uma tabela de conferência, que é o que você lê.
- Se um script der erro, ele **se desfaz inteiro** (o editor roda tudo em uma
  transação só). Nesse caso, nada foi alterado: mande o erro e pare por ali.
- Todos são **idempotentes**: rodar de novo não duplica nem quebra.

## A ordem

| # | Arquivo | O que entrega |
|---|---|---|
| 1 | `docs/script_13o_apuracao_avos_e_medias.sql` | Avos da Lei 4.090/1962, média das variáveis e as memórias de cálculo |
| 2 | `docs/script_13o_entrega2_estrutura_encargos_lote.sql` | Vínculo, situação, INSS/IRRF no banco, lote, prazo legal, aprovação/pagamento/reabertura e a camada de acesso por perfil |
| 3 | `docs/script_13o_adiantamento_e_media_sumula347.sql` | As duas políticas de adiantamento (escolha da empresa) e a média física de horas extras (Súmula 347 TST) |
| 4 | `docs/script_13o_entrega3_alertas_prazos.sql` | Alertas de prazo (D-30/15/7 e D-15/7/3) e geração de Plano de Ação |
| 5 | `docs/script_13o_entrega4_provisao_rescisao_ferias.sql` | Provisão contábil, conciliação, 13º na rescisão e adiantamento nas férias |
| 6 | `docs/script_13o_entrega5_esocial.sql` | S-1200 anual (indApuracao = 2) e S-1210, com validação prévia. **Não transmite** |

## O que esperar em cada conferência

| # | Linhas | Esperado |
|---|---|---|
| 1 | 9 | todas **OK** |
| 2 | 21 | todas **OK**. Se aparecer alguma linha `DUPLICADO: ... RESOLVER`, existem dois cálculos vivos da mesma parcela na base: cancele os que sobram e rode o script 2 de novo |
| 3 | 7 | 6 **OK** + 1 **INFORMATIVO** dizendo quantas configurações duplicadas foram movidas para `backup_decimo_terceiro_config_<data>` |
| 4 | 9 | 8 **OK** + 1 linha sobre o agendamento diário (em produção o `pg_cron` existe, então deve sair **OK**; se sair INFORMATIVO, a varredura funciona sob demanda pelo botão da tela) |
| 5 | 8 | todas **OK** |
| 6 | 6 | todas **OK** |

Qualquer linha **FALTOU** significa que aquele item não foi criado — pare e
mande a tabela inteira antes de seguir.

## O que é alterado em dado existente

Cinco dos seis scripts **só criam coisa nova** (colunas, índices, funções,
regras) — não há o que desfazer. A exceção é o script 3, que remove
configurações duplicadas do 13º; ele **copia as linhas antes** para
`backup_decimo_terceiro_config_<aaaammdd>` e o próprio arquivo traz, no
comentário final, o comando que devolve o que foi movido. Isso importa porque
a produção não tem Point-in-Time Recovery: o resgate é cirúrgico, linha a
linha, e não um retorno de backup do dia inteiro.

## Depois dos scripts: publicar as telas

As telas do 13º (apuração com memória, lote, política do 13º, recibos em
Documentos, alertas, provisões e o bloco do eSocial) vêm do código, não do
banco. Depois de rodar os seis scripts, **clique em Publicar no Lovable** para
que elas apareçam em produção. Publicar sem os scripts deixaria a tela pedindo
funções que ainda não existem — por isso o banco vem primeiro.

## Conferência final na tela

Depois de publicar, em Financeiro → Folha → **13º Salário**:

1. **Calcular 13º** para um colaborador e clicar em **Apurar**: devem aparecer
   os avos com a memória mês a mês e a média com as competências somadas.
2. A coluna **13º integral** mostra o valor cheio do ano, e a coluna **Prazo
   legal** a data-limite da parcela (30/11 e 20/12, recuando para o último dia
   útil).
3. Aba **eSocial** → bloco "13º salário — apuração anual" → **Validar 13º**:
   ou diz quantos cálculos estão aptos, ou lista nome a nome o que corrigir.

## Como foi conferido antes de chegar aqui

- Réplica montada com **exatamente o que a produção tem hoje**, e sobre ela os
  seis scripts na ordem, duas vezes seguidas, sem erro;
- O estado final da réplica pelos scripts é **idêntico** ao produzido pelas
  migrations do ambiente de teste: mesmas 39 funções (corpo por corpo), 17
  índices e 23 regras;
- Bateria de QA do módulo na réplica de produção: **17/17**.
