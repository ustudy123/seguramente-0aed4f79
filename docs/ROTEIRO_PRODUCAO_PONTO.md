# Roteiro de produção — módulo Ponto

Este documento é a **lista mestra** dos pacotes SQL que precisam ser colados,
**em ordem**, no SQL Editor do banco de **produção** (projeto
`diayjpsrcerycycyaxst`) quando a implantação do módulo Ponto for aprovada.

Ele existe para que, ao final de tudo, **nenhum passo se perca e nenhuma
sequência se inverta**. É um documento vivo: cada onda nova entra aqui assim
que é entregue no ambiente de teste.

---

## O princípio (não esquecer nunca)

1. **Nada vai para produção antes de ser validado no ambiente de teste.**
   Toda mudança nasce no teste (pela automação), é conferida por uma pessoa, e
   **só então** o pacote correspondente é colado em produção.
2. **A produção só muda por gesto manual seu.** A automação nunca toca o banco
   real. Você cola o script no SQL Editor de produção — nada mais faz isso.
3. **Ordem importa.** Rode os pacotes na numeração abaixo. Alguns dependem de
   outro ter rodado antes (a coluna "Depende de" avisa).
4. **Antes de colar qualquer coisa, confira o nome do projeto no topo da tela
   do Supabase.** Ele abre sempre no último projeto usado. Tem que estar escrito
   o projeto de **produção**.
5. Todos os pacotes são **idempotentes**: rodar duas vezes não quebra nem
   duplica. Se ficar na dúvida se rodou, rode de novo e olhe a conferência.

---

## Estado atual

**Nenhum pacote foi aplicado em produção ainda.** Todos estão validados (ou em
validação) apenas no ambiente de teste. Esta é a fila para quando você decidir
implantar.

Legenda de status: ⬜ a fazer · ✅ feito · ⏳ aguardando validação no teste

| # | Pacote | Arquivo | Depende de | Teste | Produção |
|---|--------|---------|-----------|:-----:|:--------:|
| 1 | PONTO-004 — marcação imutável + remove e-mail hardcoded | `docs/script_ponto004_imutabilidade.sql` | — | ⏳ | ⬜ |
| 2 | Onda 0 — travas legais de risco aberto | `docs/script_ponto_onda0_travas_legais.sql` | — | ⏳ | ⬜ |
| 3 | Onda 1 (parte 1) — NSR e histórico de lotação | `docs/script_ponto_onda1_nsr_e_lotacao.sql` | — | ⏳ | ⬜ |
| 4 | Onda 1 (parte 1) — preenchimento histórico do NSR | `docs/script_ponto210_backfill_nsr.sql` | **#3** | ⏳ | ⬜ |
| 5 | Onda 1 (parte 2) — vínculo/empresa na chave | `docs/script_ponto_onda1_vinculo_na_chave.sql` | **#3** | ⏳ | ⬜ |
| 6 | Onda 1 (parte 3) — versionamento + memória de cálculo | `docs/script_ponto_onda1_versionamento_e_memoria.sql` | — | ⏳ | ⬜ |
| 7 | Onda 3 (parte 1) — tolerância cumulativa dos dois tetos legais | `docs/script_ponto_onda3_tolerancia.sql` | — | ⏳ | ⬜ |
| 8 | Onda 3 (parte 2) — jornada da escala + hora extra sem truncar | `docs/script_ponto_onda3_jornada_escala_he.sql` | — | ⏳ | ⬜ |
| 9 | Onda 3 (parte 3) — adicional noturno prorrogado (Súmula 60, II) | `docs/script_ponto_onda3_adicional_noturno_prorrogado.sql` | inclui #8 | ⏳ | ⬜ |
| 10 | Onda 3 (parte 4) — turno da virada pertence ao dia de início | `docs/script_ponto_onda3_turno_da_virada.sql` | — | ⏳ | ⬜ |
| 11 | Onda 2 (parte 1) — cadeia de hash encadeado + verificação | `docs/script_ponto_onda2_cadeia_hash.sql` | **#3, #4** (NSR) | ⏳ | ⬜ |
| 12 | Onda 2 (parte 2) — relógio confiável + origem da batida | `docs/script_ponto_onda2_relogio_e_origem.sql` | — | ⏳ | ⬜ |
| 13 | Onda 2 (parte 3) — detecção de marcações uniformes ("britânico") | `docs/script_ponto_onda2_marcacoes_uniformes.sql` | — | ⏳ | ⬜ |
| 14 | Onda 2 (parte 4) — reabertura formal de competência + versão do espelho | `docs/script_ponto_onda2_reabertura_competencia.sql` | — | ⏳ | ⬜ |
| 15 | Onda 2 (parte 5) — correção por acréscimo (desconsiderar) — banco | `docs/script_ponto_onda2_desconsiderar_marcacao.sql` | — | ⏳ | ⬜ |
| 15-tela | Onda 2 (parte 5) — botão "Desconsiderar" | **Publicar no Lovable** (não é script) | #15 | ⏳ | ⬜ |
| 16 | Onda 4 (parte 1) — faixas de intervalo (art. 71) | `docs/script_ponto_onda4_faixas_intervalo.sql` | — | ⏳ | ⬜ |
| 17 | Onda 4 (parte 2) — supressão de intervalo (indenização 50%) | `docs/script_ponto_onda4_supressao_intervalo.sql` | **#16** | ⏳ | ⬜ |
| 18 | Onda 4 (parte 3) — pré-assinalação formal do intervalo (Súm. 338) | `docs/script_ponto_onda4_pre_assinalacao.sql` | **#16 #17** | ⏳ | ⬜ |
| 19 | Onda 4 (parte 4) — domingo trabalhado em dobro (Lei 605/49, Súm. 146) | `docs/script_ponto_onda4_domingo_em_dobro.sql` | — | ⏳ | ⬜ |
| 20 | Onda 4 (parte 5) — DSR e repouso semanal de 24h (Lei 605/49, CLT art. 67) | `docs/script_ponto_onda4_dsr.sql` | — | ⏳ | ⬜ |
| 21 | Onda 5 (parte 1) — banco de horas só com instrumento vigente (CLT art. 59) | `docs/script_ponto_onda5_banco_instrumento_vigente.sql` | — | ⏳ | ⬜ |

> Quando eu validar cada onda com você no teste e você aprovar, marque a coluna
> **Teste** como ✅. A coluna **Produção** só vira ✅ depois que você colar o
> pacote no banco real e a conferência der `OK`.

---

## Detalhe de cada pacote

### 1 · PONTO-004 — marcação imutável + remoção do e-mail hardcoded
- **Arquivo:** `docs/script_ponto004_imutabilidade.sql`
- **O que faz:** impede que a marcação de ponto original seja apagada
  diretamente por papel de gestão (a correção passa a ser por acréscimo) e
  remove um e-mail real que estava fixo no código como exceção (backdoor + LGPD).
- **Não altera cálculo de jornada.**
- **Conferência esperada (última linha do resultado):** `true | true | true | 3 | OK`
  — e-mail removido, marcação blindada, exclusão de ajustes preservada, 3
  gatilhos de proteção, situação OK.

### 2 · Onda 0 — travas legais de risco aberto
- **Arquivo:** `docs/script_ponto_onda0_travas_legais.sql`
- **O que faz:** seis travas de cadastro/acesso — colaborador comum passa a ler
  só o próprio ponto (LGPD); marcação no futuro é recusada; tolerância acima do
  teto legal, CCT abaixo do piso de intervalo e "registro por exceção" sem
  acordo passam a ser recusados no cadastro; instala a trava de teste na tabela
  que faltava.
- **Não altera cálculo de jornada.**
- **Conferência esperada:** `2 | 4 | 0 | 0 | 0 | OK` — 2 políticas de leitura, 4
  gatilhos de validação, e **três zeros** de cadastros legados fora da faixa.
- **Atenção:** se os três zeros **não** vierem zero, existem cadastros antigos
  fora da faixa legal (tolerância/intervalo/exceção). Eles continuam
  funcionando, mas produzem apuração irregular — me avise os números que eu
  ajudo a tratar um a um.

### 3 · Onda 1 (parte 1) — NSR e histórico de lotação
- **Arquivo:** `docs/script_ponto_onda1_nsr_e_lotacao.sql`
- **O que faz:** cria o NSR (numeração sequencial e imutável de cada marcação,
  exigida pela Portaria 671) e o histórico de lotação por estabelecimento.
  Estruturas novas ao lado do que já existe; **não altera cálculo.**
- **Conferência esperada:** `t | t | t | t | t | t | OK`. A coluna
  `marcacoes_sem_nsr` dá o tamanho do preenchimento histórico do passo 4.
- **Depois deste, rode o passo 4.**

### 4 · Onda 1 (parte 1) — preenchimento histórico do NSR
- **Arquivo:** `docs/script_ponto210_backfill_nsr.sql`
- **Rodar SOMENTE depois do #3.**
- **O que faz:** dá NSR às marcações **antigas** (as novas já nascem com NSR).
  É separado de propósito: cada atualização gera uma linha de auditoria, então
  o preenchimento é feito **em lotes** de 20 mil, no seu ritmo.
- **Como rodar:** cole e rode. A cada execução ele numera um lote e avisa quanto
  falta (`Faltam: N`). **Repita até `Faltam: 0`.** É seguro parar e retomar.
- **Conferência esperada ao terminar:** `faltam_nsr = 0` e situação `OK` (ou
  `OK, com ressalva` se houver `orfas_sem_tenant` — ver abaixo).
- **Atenção:** a coluna `orfas_sem_tenant` conta marcações que apontam para um
  empregador que não existe mais. Elas ficam de fora de propósito e merecem
  investigação à parte — me avise se vier acima de zero.

### 5 · Onda 1 (parte 2) — vínculo/empresa na chave da apuração
- **Arquivo:** `docs/script_ponto_onda1_vinculo_na_chave.sql`
- **Depende do #3** (usa a mesma base estrutural).
- **O que faz:** inclui a empresa na chave da apuração diária, para que dois
  vínculos do mesmo trabalhador (duas empresas do grupo) tenham cada um a sua
  linha. Para quem tem um vínculo só, o dia continua uma linha — **não altera
  cálculo.** Um gatilho de reconciliação garante que nenhum dia de vínculo
  único se parta.
- **Conferência esperada:** `t | t | t | 5 | OK` — chave por vínculo, gatilho de
  reconciliação, escritores sem o arbiter antigo, 5 escritores migrados, OK.
- **Sem backfill** — o gatilho de reconciliação dispensa.

### 6 · Onda 1 (parte 3) — versionamento de parâmetros + memória de cálculo
- **Arquivo:** `docs/script_ponto_onda1_versionamento_e_memoria.sql`
- **O que faz:** os parâmetros da escala passam a ser versionados por vigência
  (editar a escala hoje deixa de reescrever a apuração de um mês passado) e cria
  a memória de cálculo por competência (fonte + resultado). **A mudança é inerte
  até alguém editar uma escala** — sem edição, a apuração sai idêntica à de hoje.
- **Conferência esperada:** `t | t | 4 | t | OK` — tabela de versões, gatilho de
  arquivamento, 4 leitores com o overlay, tabela de memória, OK.
- **Sem backfill** — a tabela de versões nasce vazia.

---

### 7 · Onda 3 (parte 1) — tolerância cumulativa dos dois tetos legais
- **Arquivo:** `docs/script_ponto_onda3_tolerancia.sql`
- **O que faz:** a apuração passa a aplicar os dois tetos de tolerância do
  art. 58, §1º da CLT (Súmula 366 do TST) de forma cumulativa: o
  atraso/antecipação é absorvido só até **5 minutos por marcação**; a sobra no
  dia mantém o teto de **10 minutos diários**. Estourou qualquer um, computa-se
  a totalidade que excede a jornada — não só o que passou da tolerância. Corrige
  também o padrão de encaixe de batida (era 10 por marcação, o dobro do legal).
- **Muda o cálculo de saldo** (é a onda do dinheiro) — mas de forma provada:
  na bateria do teste, só PONTO-041, PONTO-042 e PONTO-352 passaram a passar, e
  **nenhum outro caso mudou** (regressão zero).
- **Este script é cirúrgico, não cola o corpo inteiro.** O corpo desta função,
  em produção, foi remendado à mão no passado e não bate com o repositório. O
  script lê o corpo vivo em produção e troca **apenas** os trechos de
  tolerância. Se o corpo tiver sido remendado também nessas linhas, ele **não
  altera nada e avisa** — aí me mande o corpo atual que eu reconcilio antes.
- **Conferência esperada:** `t | t | t | OK` — marcador aplicado, padrão de 5
  por marcação no lugar, e o padrão antigo de 10 removido.
- **Atenção:** se a conferência vier `PENDENTE`, o corpo divergiu e **nada foi
  aplicado** — é o comportamento seguro, me avise para reconciliarmos.
- **Sem backfill** — muda só a leitura/apuração, não grava nada em massa.

### 8 · Onda 3 (parte 2) — jornada da escala + hora extra sem truncar
- **Arquivo:** `docs/script_ponto_onda3_jornada_escala_he.sql`
- **O que faz:** na função de cálculo de hora extra e adicional noturno,
  (a) a jornada esperada do dia passa a vir da **escala vigente do vínculo**
  (respeitando o versionamento da onda 1), em vez das 8h fixas — assim a hora
  extra de quem tem jornada contratual menor deixa de ser apagada (CLT art. 58;
  CF art. 7º, XIII); (b) remove o corte que truncava a hora extra em 2h — apura
  **todo** o tempo trabalhado além da jornada (continua devido, art. 59) e
  **sinaliza** o excesso ao RH com um alerta (um por colaborador/dia).
- **Muda o cálculo de HE** (na bateria só PONTO-091 e PONTO-092 passaram a
  passar; PONTO-110/111 do adicional noturno seguem idênticos — regressão zero).
- **`CREATE OR REPLACE` limpo** (esta função tem definição única, sem remendos
  próprios de produção) — seguro e idempotente.
- **Conferência esperada:** `t | t | t | OK` — lê a jornada da escala, não trunca
  mais em 2h, e sinaliza o excesso.
- **Observação:** esta função de cálculo **ainda não é consumida pelo fluxo vivo
  de apuração** (nenhuma tela/gatilho a chama hoje). A correção deixa o cálculo
  certo para quando ele for ligado — por si só não muda os números que já
  aparecem hoje. Ligar o cálculo ao fluxo é passo à parte, de uma onda adiante.
- **Sem backfill.**

### 9 · Onda 3 (parte 3) — adicional noturno prorrogado (Súmula 60, II do TST)
- **Arquivo:** `docs/script_ponto_onda3_adicional_noturno_prorrogado.sql`
- **O que faz:** quando a jornada é cumprida integralmente no período noturno
  (entrada até as 22h, cobrindo toda a janela 22h–05h) e **prorrogada** além das
  05h, o adicional noturno acompanha as horas prorrogadas — em vez de cessar em
  05:00 fixo (Súmula 60, II do TST). A parte noturna mantém a hora ficta; as
  horas prorrogadas entram pelo tempo real (critério conservador, porque aplicar
  a ficta à prorrogação é controvertido — registrado no comentário da função).
- **Este pacote INCLUI o #8.** É a mesma função da parte 2: o corpo aqui já traz
  a jornada da escala e a hora extra sem truncar. Rodar o #8 antes é inofensivo
  (o #9 o substitui com o corpo final); rodar só o #9 também fica completo.
- **`CREATE OR REPLACE` limpo** (definição única, sem remendos) — idempotente.
- **Conferência esperada:** `t | t | t | t | OK` — jornada da escala, sem corte
  em 2h, alerta do art. 59 e prorrogação do adicional, todos presentes.
- **Na bateria** só PONTO-112 passou a passar; PONTO-110/111 (janela e ficta)
  seguem idênticos — regressão zero.
- **Mesma observação de escopo:** a função ainda não é consumida pelo fluxo vivo
  de apuração. **Sem backfill.**

### 10 · Onda 3 (parte 4) — turno da virada pertence ao dia de início
- **Arquivo:** `docs/script_ponto_onda3_turno_da_virada.sql`
- **O que faz:** a jornada que cruza a meia-noite (ex.: entrada 22:00, saída
  06:00 do dia seguinte, lançadas no dia de início) passa a pertencer inteira ao
  dia em que começou — 8h no dia de início, **sem falta fictícia** no dia
  seguinte. A reordenação de rótulos e a consolidação diária passam a ler as
  batidas em ordem **cíclica** (o turno começa logo após o maior vão do dia),
  reconhecendo a virada. **Nenhum horário é alterado** — muda só a ordem de
  leitura das batidas.
- **Cria uma função nova** (`ponto_corte_virada`) usada pelas duas.
- **`CREATE OR REPLACE` limpo** (sem remendos próprios de produção) — idempotente.
- **Conferência esperada:** `t | t | t | OK` — corte criado, reordenação e
  consolidação lendo em ordem cíclica.
- **Na bateria** só PONTO-022 passou a passar; dias comuns não mudaram
  (regressão zero em 120 casos).
- **Sem backfill.**

### 11 · Onda 2 (parte 1) — cadeia de hash encadeado + verificação
- **Arquivo:** `docs/script_ponto_onda2_cadeia_hash.sql`
- **Depende do NSR (#3 e #4).** O encadeamento usa a numeração sequencial das
  marcações — rode os pacotes do NSR antes deste.
- **O que faz:** o hash de cada marcação nova passa a **incorporar o hash da
  anterior** (por NSR/estabelecimento) — remover uma linha passa a quebrar a
  cadeia. Uma rotina recomputa cada hash (detecta alteração de conteúdo) e
  confere o encadeamento e a continuidade da NSR (detecta remoção), com alerta
  ao RH. É o que transforma "não editamos" em prova (registro tipo 7 do AFD).
- **Retrocompatível.** O append do hash anterior é vazio para as marcações
  antigas, e append de vazio não muda o hash — as marcações já gravadas
  continuam com o **mesmo hash** e verificam limpas. **Sem backfill.**
- **`ADD COLUMN IF NOT EXISTS` + `CREATE OR REPLACE`** — idempotente. A geração
  do hash é defensiva: nunca deixa de gravar a marcação.
- **Conferência esperada:** `t | t | t | 0 | OK` — coluna criada, hash encadeado,
  rotina de verificação, e **zero quebras** na base atual (sem falso positivo).
- **Atenção:** se `quebras_hoje` vier acima de zero, há marcação adulterada ou
  removida em produção — me avise para investigar.
- **Na bateria** só PONTO-191 passou a passar; regressão zero. Além da régua,
  provei o mecanismo de verdade: base legada limpa, novas marcações encadeiam, e
  a remoção de uma marcação do meio é detectada.

### 12 · Onda 2 (parte 2) — relógio confiável + origem da batida
- **Arquivo:** `docs/script_ponto_onda2_relogio_e_origem.sql`
- **O que faz (requisitos do REP-P):** (378) a marcação passa a registrar se
  nasceu **on-line ou off-line** (`origem_offline`) e o momento da sincronização
  (`sincronizado_em`), preservando a hora da batida como a oficial; (379) uma
  rotina monitora o **relógio do servidor contra a Hora Legal Brasileira**
  (Observatório Nacional), com trilha das checagens (`ponto_relogio_checagens`)
  e alerta quando o desvio passa da tolerância. A hora oficial é fornecida por
  quem chama (uma Edge Function que consulta a fonte).
- **Puramente aditivo** — colunas novas com padrão neutro e mecanismos ao lado
  do que já existe; nada do fluxo atual muda.
- **`ADD COLUMN IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS` + `CREATE OR
  REPLACE`** — idempotente. **Sem backfill.**
- **Conferência esperada:** `t | t | t | OK` — colunas de origem, trilha do
  relógio e rotina de monitoração presentes.
- **Na bateria** só PONTO-378 e PONTO-379 passaram a passar; regressão zero.
  Provado de verdade: desvio dentro da tolerância não alerta, desvio acima
  alerta (uma vez por dia), e a trilha registra cada checagem.

### 13 · Onda 2 (parte 3) — detecção de marcações uniformes ("britânico")
- **Arquivo:** `docs/script_ponto_onda2_marcacoes_uniformes.sql`
- **O que faz:** por colaborador na competência, mede o desvio-padrão dos
  horários de entrada e saída ao longo dos dias. Desvio quase nulo por muitos
  dias = espelho **uniforme** ("britânico"), que a Súmula 338, III, do TST
  considera **inválido como prova**. Uma rotina companheira alerta o RH,
  idempotente por competência.
- **Somente leitura** sobre `ponto_diario`; aditivo e idempotente
  (`CREATE OR REPLACE`). **Sem backfill.**
- **Conferência esperada:** `t | t | OK` — rotina de verificação e companheira
  de alerta presentes.
- **Na bateria** só PONTO-377 passou a passar; regressão zero. Provado de
  verdade: um colaborador com horários idênticos por 14 dias é sinalizado como
  uniforme (e alertado); um com variação de minutos, não.

### 14 · Onda 2 (parte 4) — reabertura formal de competência + versão do espelho
- **Arquivo:** `docs/script_ponto_onda2_reabertura_competencia.sql`
- **O que faz:** cria a saída **formal** para o erro legítimo descoberto após o
  fechamento. `ponto_reabrir_competencia` valida que a competência está fechada,
  **exige motivo**, confere a **alçada** (papéis de gestão), **arquiva** a versão
  corrente dos espelhos (a que o colaborador recebeu) num histórico recuperável,
  marca o fechamento como `reaberto` e registra a **trilha**. O re-fechamento
  seguinte gera a próxima versão, sem regravar a anterior.
- **A tabela nova (`ponto_espelhos_historico`) recebe a trava do cercado** do QA,
  como toda tabela de ponto — sem isso a rotina PONTO-270 acusaria.
- **Aditivo e idempotente** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT
  EXISTS`, `CREATE OR REPLACE`). **Sem backfill.**
- **Conferência esperada:** `t | t | t | t | OK` — colunas de reabertura,
  histórico do espelho, trava do cercado na tabela nova, e a função de
  reabertura.
- **Na bateria** PONTO-358 passou a passar; regressão zero. Provado de verdade:
  reabertura sem motivo é recusada; com motivo, arquiva a versão e marca
  `reaberto`; e reabrir uma competência já reaberta é recusado.
- **Nota honesta:** o PONTO-194 (geração transacional dos espelhos) também
  aparece verde na bateria depois desta parte, mas por **coincidência** — a
  régua dele só procura uma função que toque `ponto_espelhos` com `INSERT`, e a
  reabertura casa esse padrão. A geração transacional dos espelhos de verdade
  (hoje o frontend grava linha a linha) segue como item próprio, a fazer.

### 15 · Onda 2 (parte 5) — correção por acréscimo: desconsiderar, nunca apagar
- **Arquivo (banco):** `docs/script_ponto_onda2_desconsiderar_marcacao.sql`
- **O que faz:** a batida original **nunca é apagada**. Passa a ser
  **desconsiderada**: fica no acervo e na cadeia de hash, marcada com motivo e
  responsável, e sai do cálculo do dia. Fecha o buraco dos RPCs
  (`excluir_marcacao_ponto`, `processar_ajuste_ponto` tipo correção) que ainda
  apagavam pelo flag de sessão. Portaria 671 veda apagar; CLT art. 74; Súmula
  338 do TST.
- **`ADD COLUMN IF NOT EXISTS` + `CREATE OR REPLACE`** — idempotente. **Sem
  backfill.**
- **Conferência esperada:** `t | t | t | t | t | OK` — coluna de desconsideração,
  RPC próprio, o antigo "excluir" delegando (não apaga), o cálculo ignorando
  desconsideradas, e o ajuste sem apagar.
- **Na bateria:** PONTO-004 segue passando; **regressão zero**. Provado de
  verdade: desconsiderar tira a batida do cálculo, mas ela **continua no acervo**
  e a **cadeia de hash segue intacta** (a prova fica).

#### 15-tela · o botão "Desconsiderar" (Publicar no Lovable)
- **Não é um script.** A tela (o botão "Excluir" do espelho vira "Desconsiderar",
  com o motivo obrigatório) está no código do frontend e entra em produção pelo
  **Publicar no Lovable**, depois que o pacote #15 (banco) estiver em produção.
- **Enquanto a tela não é publicada:** o banco já protege — o botão "Excluir"
  antigo já **desconsidera** (não apaga), só com o rótulo antigo. Publicar o
  Lovable troca o rótulo e passa a pedir o motivo.

### 16 · Onda 4 (parte 1) — faixas de intervalo (art. 71)
- **Arquivo:** `docs/script_ponto_onda4_faixas_intervalo.sql`
- **O que faz:** cria a função canônica do mínimo de intervalo intrajornada por
  **faixa de jornada** (CLT art. 71): até 4h nenhum; 4-6h 15 min; acima de 6h
  60 min. É a base do cálculo de supressão (parte 2) — sem as faixas, aplicar
  "1 hora para todos" criaria supressão fictícia nas jornadas curtas.
- **Função pura (`IMMUTABLE`), aditiva e idempotente** (`CREATE OR REPLACE`).
  **Sem backfill.**
- **Conferência esperada:** `t | 0 | 15 | 15 | 60 | OK`.
- **Na bateria** só PONTO-062 passou a passar; regressão zero.

### 17 · Onda 4 (parte 2) — supressão de intervalo (indenização de 50%)
- **Arquivo:** `docs/script_ponto_onda4_supressao_intervalo.sql`
- **Depende da parte 1 (#16).** Usa as faixas de intervalo.
- **O que faz (CLT art. 71, §4º pós-2017):** jornada acima de 6h com pausa menor
  que a devida gera **supressão** — indenização de **50% sobre apenas os minutos
  suprimidos**, natureza **indenizatória** (sem reflexos em DSR/férias/13º/FGTS;
  a regra antiga da hora cheia salarial foi revogada em 2017). A função calcula;
  um gatilho na consolidação grava os minutos suprimidos em
  `ponto_diario.he_intervalo_suprimido_minutos` e **alerta o RH** (parcial ou
  total), idempotente por colaborador/dia. A supressão total (jornada corrida
  sem nenhuma pausa) deixa de passar invisível.
- **Aditivo e idempotente** (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS` +
  `CREATE TRIGGER`). **Sem backfill.**
- **Conferência esperada:** `t | t | 60 | 0 | OK`.
- **Na bateria** só PONTO-060 e PONTO-061 passaram a passar; regressão zero.
  Provado: 8h30 sem pausa → 60 min suprimidos e alerta; 8h com 60min de pausa →
  nada; jornada de 4h sem pausa → nada (≤4h não exige intervalo).

### 18 · Onda 4 (parte 3) — pré-assinalação formal do intervalo (Súmula 338)
- **Arquivo:** `docs/script_ponto_onda4_pre_assinalacao.sql`
- **Depende das partes 1 e 2 (#16/#17).**
- **O que faz (Súmula 338, III do TST; Portaria MTP 671/2021):** a jornada de
  **duas batidas** (entra e sai, sem marcar o almoço) só é válida quando o
  intervalo é **expressamente pré-assinalado**. Passa a existir a **declaração
  formal** — tabela `ponto_pre_assinalacao`, por escala (ampla) ou por
  colaborador (específica, que prevalece), com **vigência** e **lastro**
  (CCT/acordo). O espelho ganha duas colunas em `ponto_diario`
  (`intervalo_origem` = `marcado`/`pre_assinalado` e
  `intervalo_pre_assinalado_minutos`) que **mostram** de onde veio o intervalo
  do dia. E a supressão (parte 2) deixa de acusar **falsa "supressão total"**
  num dia legitimamente pré-assinalado.
- **Desligado por padrão.** Sem declaração cadastrada, nada muda: a origem fica
  `marcado` (dia com almoço batido) ou `NULL`, e a supressão fica idêntica à
  parte 2. **Não altera** `ponto_marcacoes`, `horas_trabalhadas` nem o motor de
  saldo — a dedução do intervalo na apuração segue exatamente como já era.
- **Batida real sempre vence o declarado.**
- **Aditivo e idempotente** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT
  EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`).
  **Sem backfill.** Um único gatilho de `ponto_diario` é (re)criado; a tabela
  nova nasce vazia (sem contenção) — sem risco de deadlock entre tabelas.
- **Conferência esperada:** `t | t | t | t | t | t | OK`.
- **Na bateria** só PONTO-064 passou a passar; regressão zero (270 da cerca
  segue verde, 060/061/062 seguem verdes). Provado em transação: dia de 2
  batidas sem declaração → nada muda (`60` min de supressão, igual à parte 2);
  almoço batido → `marcado`, sem supressão; 2 batidas + declaração de 60 min →
  `pre_assinalado`, **sem supressão**, `horas_trabalhadas` intactas; declaração
  existente mas com almoço batido → `marcado` (real vence); declaração de 30 min
  (abaixo do mínimo) → supressão **parcial** de 30 min mantida.
- **Tela (Publicar no Lovable) — quando o RH for usar:** a exibição de "intervalo
  pré-assinalado" no espelho e o cadastro da declaração são de tela; entram por
  Publicar no Lovable quando forem construídos. O banco já guarda tudo.

### 19 · Onda 4 (parte 4) — domingo trabalhado em dobro (Lei 605/49, Súmula 146)
- **Arquivo:** `docs/script_ponto_onda4_domingo_em_dobro.sql`
- **O que faz:** o trabalho em **domingo** (descanso semanal) sem folga
  compensatória é pago **em dobro por inteiro** — a jornada normal inclusive —,
  não apenas o que excede a jornada (Lei 605/1949, art. 9º; Súmula 146 do TST).
  Até aqui o cálculo tratava o domingo como mera hora extra 100%, dobrando só o
  excedente. Agora, na `calcular_he_adicional_noturno_dia`, quando o domingo
  **não é dia de trabalho previsto na escala** (é o repouso da semana), a
  jornada trabalhada inteira vira 100%.
- **Só muda o domingo de repouso trabalhado.** Domingo **previsto na escala**
  (6x1 e afins) já carrega o repouso noutro dia → cai no cálculo normal, sem
  dobra. Dia útil e sábado ficam idênticos. **Não toca no motor de saldo** (ele
  lê `horas_extras`/`horas_faltantes`, não `horas_extras_100_minutos`); o alerta
  do art. 59 segue igual.
- **Substitui a função inteira** (mantém as partes 2 e 3 da onda 3: jornada pela
  escala, HE sem truncar, adicional noturno prorrogado — a conferência confirma).
- **Aditivo e idempotente** (`CREATE OR REPLACE`). **Sem backfill.**
- **Conferência esperada:** `t | t | t | t | t | OK`.
- **Na bateria** só PONTO-130 passou a passar; regressão zero. Provado em
  transação: domingo-repouso de 8h → 480 min a 100% (dobra da jornada inteira);
  domingo-repouso de 11h corridas → 660 min a 100%; **domingo previsto na escala
  → sem dobra** (0); dia útil de 11h → 180 min a 50%; sábado de 11h → 180 min a
  50%. *Obs.: PONTO-132 (reflexo do DSR) segue pendente — é a parte 5; não foi
  tocado por esta parte.*
- **Limitação conhecida:** escala legada sem `dias_config` reporta o domingo como
  dia útil e não dobra (critério conservador, não cobra a mais). Compensação
  ad-hoc de domingo, se necessária, é evolução à parte (espelhando o mecanismo
  de `feriado_folga_compensatoria`).

### 20 · Onda 4 (parte 5) — DSR e repouso semanal de 24h (Lei 605/49, CLT art. 67)
- **Arquivo:** `docs/script_ponto_onda4_dsr.sql`
- **O que faz:** fecha a onda 4 com o repouso semanal, até aqui ausente do
  cálculo. Três funções novas:
  - `ponto_dsr_competencia` (**132**) — apuração semanal que alimenta a folha
    com o **reflexo das horas extras sobre o repouso** (Súmula 172 do TST: a
    média das HE da semana entra no valor do DSR) e a **perda do DSR por falta
    injustificada** na semana (Lei 605/49, art. 6º);
  - `ponto_repouso_semanal_verificar` (**133**) — detecta **sete dias seguidos
    de trabalho sem 24 horas consecutivas de repouso** (CLT art. 67);
  - `ponto_repouso_semanal_monitorar` (**133**) — varre a competência e alerta o
    gestor sobre a violação, idempotente por colaborador/sequência.
- **Baixo risco:** duas funções somente-leitura e um monitor que só insere
  alertas. Nada é chamado automaticamente, **sem gatilho em tabela quente, sem
  tocar no motor de saldo e sem tabela nova** (sem cerca a instalar). A folha e o
  espelho consomem estas funções quando forem ligados.
- **Aditivo e idempotente** (`CREATE OR REPLACE`). **Sem backfill.**
- **Conferência esperada:** `t | t | t | OK`.
- **Na bateria** só PONTO-132 e PONTO-133 passaram a passar; regressão zero.
  Provado em transação: semana com 120 min de HE em 5 dias úteis → reflexo de 24
  min no DSR; semana com falta injustificada → `dsr_perdido = true`; sequência de
  7 dias trabalhados → violação do art. 67 sinalizada; o monitor cria o alerta na
  1ª execução e devolve 0 na 2ª (idempotente).
- **Tela (Publicar no Lovable) — quando o RH for usar:** o evento de DSR na folha
  e a coluna do espelho (`total_dsr`) passam a ter fonte; ligá-los na exportação
  e no espelho é de tela, por Publicar no Lovable. O banco já apura.

### 21 · Onda 5 (parte 1) — banco de horas só com instrumento vigente (CLT art. 59)
- **Arquivo:** `docs/script_ponto_onda5_banco_instrumento_vigente.sql`
- **O que faz:** o banco de horas creditava para **todo mundo**, sem regime nem
  acordo. Sem instrumento válido e vigente (CLT art. 59, §§2º e 5º), a hora extra
  é devida em **dinheiro** na competência — mandá-la para o banco é postergar
  pagamento devido. Agora a apuração só **credita/debita** o banco quando existe
  regime de compensação **vigente** para o vínculo (`ponto_banco_horas_config`
  ativo, dentro da vigência, e com o acordo/CCT anexado quando o regime o exige).
  Sem regime, o excedente **segue apurado no dia** e vai para a folha — não some.
- **Duas peças:** a função nova `ponto_banco_regime_vigente` (resolve o regime do
  vínculo, específico da escala > empresa > tenant) e o portão dentro de
  `apurar_banco_horas_colaborador`. A rotina de empresa `apurar_banco_horas` só
  repassa para essa função — o comportamento propaga sozinho.
- **Só muda quem NÃO tem regime.** Vínculo com regime vigente segue idêntico.
  **Não apaga nada** — a hora extra continua apurada (`horas_extras_*` do dia).
- **Aditivo e idempotente** (`CREATE OR REPLACE`). **Sem backfill.**
- **Conferência esperada:** `t | t | OK`.
- **Na bateria** só PONTO-170 passou a passar; regressão zero. Provado em
  transação: sem config → sem crédito; config ativa e vigente → regime presente;
  config inativa, com início futuro, ou que exige acordo sem anexo → regime nulo
  (não credita); com o acordo anexado → regime presente.

## Regras gerais dos pacotes

- **Um pacote por vez, na ordem.** Cole o arquivo inteiro no SQL Editor, rode, e
  **olhe a última linha do resultado** (o editor só mostra o último) — ela é a
  conferência. Só passe ao próximo quando ela der `OK`.
- **Se a conferência não der `OK`,** pare e me mostre o resultado. Não siga
  adiante.
- **Nenhum destes pacotes exige "Publicar no Lovable".** Nenhum mexe em tela —
  são todos de banco. O passo do Lovable só aparece quando uma onda mexer em
  tela (a partir da onda 2, "desconsiderar em vez de apagar", e outras).

---

## O que NÃO faz parte deste roteiro

Existem em `docs/` dois scripts de ponto de **trabalhos anteriores**, fora deste
plano das ondas:

- `docs/script_ponto_controle_por_empresa.sql`
- `docs/script_ponto_correcoes_bateria_12ago.sql`

**Não sei o estado de produção deles** (podem já ter sido aplicados por outra
pessoa). Não os inclua nesta sequência sem confirmar com quem os escreveu — eles
não pertencem à jornada das ondas 0/1.

---

## Próximas ondas (ainda não entregues)

Conforme cada uma for entregue e validada no teste, ela entra na tabela acima
com seu pacote. A ordem prevista:

- **Onda 2** — registro imutável de verdade (correção por acréscimo, cadeia de
  hash, competência fechada). **Concluída no teste**, em cinco partes: cadeia de
  hash (#11), relógio/origem da batida (#12), marcações uniformes (#13),
  reabertura formal de competência (#14) e correção por acréscimo/desconsiderar
  (#15 banco + #15-tela). *A parte 5 tem componente de tela — o botão
  "Desconsiderar" entra por Publicar no Lovable.* A geração transacional dos
  espelhos (PONTO-194) fica como item próprio, a fazer.
- **Onda 3** — cálculo (hora extra, jornada da escala, tolerância, turno da
  virada, adicional noturno). *Onde está o dinheiro; agora segura, com o
  versionamento da onda 1 no lugar.* **Concluída no teste**, entregue em quatro
  partes: 1 (tolerância, #7), 2 (jornada da escala + hora extra sem truncar,
  #8), 3 (adicional noturno prorrogado, #9) e 4 (turno da virada, #10). Sete
  casos da bateria passaram a passar, regressão zero. O regime rural
  (PONTO-113) fica como evolução condicional a cliente do agro.
- **Onda 4** — intervalo, descanso e DSR. **Concluída no teste**, em cinco
  partes: parte 1 (faixas de intervalo, #16), parte 2 (supressão de intervalo,
  #17), parte 3 (pré-assinalação formal, #18), parte 4 (domingo em dobro, #19) e
  parte 5 (DSR + repouso semanal de 24h, #20). Sete casos da bateria passaram a
  passar na onda (062, 060, 061, 064, 130, 132, 133), regressão zero.
- **Onda 5** — banco de horas e escalas especiais. **Em andamento**, em seis
  partes: parte 1 (banco só com instrumento vigente, #21) pronta no teste;
  faltam o prazo de vencimento do saldo (171/354), os alertas de vencimento e
  teto (355/356), o limite de 10h no regime de compensação (172), a liquidação
  do saldo na rescisão (173) e a escala 12x36 por ciclo (150/151).
- **Ondas 6 a 8** — fechamento e folha, arquivos legais, enquadramento e
  prevenção.

O plano completo, com o detalhe de cada onda, está no documento de planejamento
(artefato "Ponto Redondo").
