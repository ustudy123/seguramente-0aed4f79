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
  hash, competência fechada). *Mexe em tela — vai exigir Publicar no Lovable.*
- **Onda 3** — cálculo (hora extra, jornada da escala, tolerância, turno da
  virada, adicional noturno). *Onde está o dinheiro; agora segura, com o
  versionamento da onda 1 no lugar.* **Em andamento**, entregue em partes:
  partes 1 (tolerância, #7), 2 (jornada da escala + hora extra sem truncar, #8)
  e 3 (adicional noturno prorrogado, #9) prontas no teste; falta o turno da
  virada (PONTO-022). O regime rural (PONTO-113) fica como evolução condicional
  a cliente do agro.
- **Ondas 4 a 8** — intervalo/DSR, banco de horas, fechamento, arquivos legais,
  enquadramento e prevenção.

O plano completo, com o detalhe de cada onda, está no documento de planejamento
(artefato "Ponto Redondo").
