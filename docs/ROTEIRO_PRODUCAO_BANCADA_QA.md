# Roteiro de produção — bancada de QA

Este documento é a **lista mestra** dos pacotes que levam a **bancada de testes**
para o banco de **produção** (projeto `diayjpsrcerycycyaxst`). É irmão do
`ROTEIRO_PRODUCAO_PONTO.md`, e vale o mesmo princípio: nada aqui roda sozinho —
a produção só muda quando você cola o script no SQL Editor.

---

## Por que esta trilha existe

A bancada de testes tem **três camadas**, e elas viajam por caminhos diferentes:

| camada | o que é | natureza |
|---|---|---|
| **rotina** (`qa_caso_ponto_041`) | a função que executa o teste | estrutura |
| **caso documentado** (linha em `qa_casos_teste`) | o que o teste prova, em português | dado |
| **ponte** (`qa_implementacoes`) | liga o código do caso à rotina | dado |

As três nasceram em **migrations** — e migration só alcança o ambiente de teste,
nunca a produção. Resultado medido em 27/08/2026, na homologação (que é cópia
fiel da produção, inclusive nestas tabelas, copiadas de lá na íntegra):

| | projeto | produção | falta |
|---|---|---|---|
| casos documentados | 822 | 568 | 254 |
| aprovados | 800 | 546 | 254 |
| **com rotina ligada** | 565 | **268** | **297** |
| pontes órfãs | 0 | 0 | — |

O caso mais grave é o **Ponto**: o projeto tem 121 casos com rotina; a produção
tem **15**. Dos 51 scripts de entrega do Ponto, só 4 criam alguma rotina de teste
e **nenhum** registra a ponte. As 114 rotinas do Ponto nasceram em 21 migrations.

Traduzindo: os 52 pacotes do Ponto levam **o comportamento corrigido**, mas não
levam **a bancada que comprova o comportamento**.

E seis módulos não existem lá de forma alguma — nem catálogo, nem rotina:
Férias (46 casos), Folha de Pagamento (19), Afastamentos (17), 13º Salário (17),
Benefícios (15) e Compliance SST (15).

---

## A ordem em relação aos 52 do Ponto

**Esta trilha vem DEPOIS dos 52 pacotes do Ponto.** Não é preferência, é
consequência: se a bancada do Ponto entrar antes, a bateria na produção vai
acender vermelho em dezenas de casos — corretamente, porque o comportamento
ainda não foi corrigido lá. Entregando o comportamento primeiro e a bancada
depois, a bateria nasce verde e passa a valer como prova do que foi entregue.
Inverter a ordem só produz um susto sem informação nova.

Dentro da trilha, **a parte 1 vem primeiro** (ela cria os módulos, e sem módulo
os casos não têm onde entrar). As partes 2 a 14 podem ir em qualquer ordem entre
si. A parte 15 vem por último, porque a conferência dela é o retrato do todo.

---

## O que a trilha NÃO faz

- Não altera nenhuma regra de negócio. Nem apuração, nem espelho, nem
  fechamento, nem tela. Só a bancada que verifica essas coisas.
- Não toca no **cercado** — o tenant isolado onde os testes rodam. Ele **já
  existe na produção** (provado: a bateria roda na homologação, que é a
  estrutura da produção).
- Não lê nem escreve dado de cliente.

---

## Garantias de cada pacote

- **Idempotente.** Rodar duas vezes não duplica nem quebra. Provado: duas
  passadas completas deixam o banco byte a byte idêntico.
- **Módulo resolvido pelo caminho** (`jornada-rotina/ponto`), nunca pelo
  identificador interno — os identificadores diferem entre ambientes.
- **A ponte só é criada quando a rotina existe de fato no destino.** Nenhum caso
  passa a apontar para o vazio; na dúvida a bateria mostra `nao_implementado`
  (honesto) em vez de `erro` (ruído).
- **Cada rotina entra em bloco próprio.** Falha de uma vira um aviso e não
  aborta o arquivo inteiro.
- **A disposição não é revertida em silêncio**: só é sobrescrita quando o
  destino ainda está `em_triagem`.
- Cada arquivo termina com **uma** conferência (o SQL Editor mostra só o último
  resultado).

---

## A fila

Cole na ordem. Cada linha é um arquivo inteiro, colado no SQL Editor de
produção. `ROT` = rotinas de teste; `CASOS` = casos documentados.

| # | arquivo | conteúdo | ROT | CASOS | tam. |
|---|---|---|---|---|---|
| 1 | `script_qa_bancada_parte01_base.sql` | Módulos + 79 ferramentas do motor | — | — | 102 kB |
| 2 | `script_qa_bancada_parte02_13o_salario_e_outros.sql` | 13º Salário, Admissão | 47 | 56 | 190 kB |
| 3 | `script_qa_bancada_parte03_afastamentos_e_outros.sql` | Afastamentos, Atestados, Benefícios, Cargos | 37 | 38 | 145 kB |
| 4 | `script_qa_bancada_parte04_colaboradores_e_outros.sql` | Colaboradores, Compliance SST, Departamentos | 51 | 53 | 195 kB |
| 5 | `script_qa_bancada_parte05_desligamento_e_outros.sql` | Desligamento, Documentos | 35 | 80 | 177 kB |
| 6 | `script_qa_bancada_parte06_epi.sql` | EPI | 15 | 65 | 85 kB |
| 7 | `script_qa_bancada_parte07_empresa_1_de_2.sql` | Empresa (1 de 2) | 59 | 83 | 203 kB |
| 8 | `script_qa_bancada_parte08_empresa_2_de_2_e_outros.sql` | Empresa (2 de 2), Estabelecimentos, Folha | 32 | 54 | 140 kB |
| 9 | `script_qa_bancada_parte09_ferias.sql` | Férias | 46 | 46 | 140 kB |
| 10 | `script_qa_bancada_parte10_hub_contabil_e_outros.sql` | Hub Contábil, Identidade, Incidentes, Metas | 76 | 85 | 201 kB |
| 11 | `script_qa_bancada_parte11_organograma_e_outros.sql` | Organograma, Perfis, Planej. Estratégico, Plano de Ação | 45 | 64 | 133 kB |
| 12 | `script_qa_bancada_parte12_ponto_1_de_3.sql` | Ponto (1 de 3) | 56 | 61 | 206 kB |
| 13 | `script_qa_bancada_parte13_ponto_2_de_3.sql` | Ponto (2 de 3) | 58 | 60 | 205 kB |
| 14 | `script_qa_bancada_parte14_ponto_3_de_3_e_outros.sql` | Ponto (3 de 3), Prestadores, Psicossocial | 27 | 77 | 105 kB |
| 15 | `script_qa_bancada_parte15_final.sql` | Cobertura de tela + conferência do todo | — | — | 16 kB |
| | **total** | | **584** | **822** | **2,2 MB** |

### A conferência de cada parte

Partes 2 a 14 devolvem:

```
esperados | casos_no_alvo | com_rotina | ponte_orfa | erro_tecnico
```

`esperados` e `casos_no_alvo` têm que bater, e `ponte_orfa` tem que ser **0**.
`com_rotina` pode ser menor que `casos_no_alvo` — caso de **tela** (`e2e`) não
tem rotina no motor por natureza; a cobertura dele vive no Cypress.

A **parte 15** devolve o retrato do todo. Com a trilha inteira aplicada:

```
822 | 800 | 565 | 257 | 0 | OK
```

---

## Como isso chega à homologação

Não precisa colar lá separadamente. A esteira de cópia da homologação leva as
tabelas do motor de QA **da produção, na íntegra e sem mascarar**
(`PRESERVAR_TABELAS` em `scripts/homologacao/gerar_copia_mascarada.py`). Depois
que a trilha entrar na produção, a homologação herda na próxima recriação.

Colar na homologação **antes** da produção funciona para conferir, mas **evapora**
na recriação seguinte — a homologação volta a espelhar a produção.

---

## Como esta trilha foi conferida

Não foi conferida "por leitura". A prova foi feita numa réplica local:

1. Clonou-se a réplica completa (as 744 migrations aplicadas).
2. **Despiu-se a bancada** — apagados os 822 casos, as 584 pontes, os 67 módulos
   e as 585 rotinas, mantendo as ferramentas do motor e o cercado (que a
   produção tem). Ficou o retrato de um banco sem bancada.
3. Aplicaram-se as 15 partes, cada uma em uma transação só, como no SQL Editor.
4. Comparou-se o resultado com a réplica íntegra: **casos, pontes, cobertura de
   tela, árvore de módulos e o corpo de todas as 663 funções bateram byte a
   byte** (mesma soma de verificação).
5. Segunda passada completa: nenhuma divergência — idempotência provada.
6. Rodou-se a bateria do Ponto nos dois bancos: resultado idêntico —
   118 passou, 7 não implementado, 2 erro, 1 falhou, em 128 casos.

Os 3 casos que não passam são **pré-existentes do projeto**, não da trilha:
PONTO-001 e PONTO-024 dão `erro` porque a fixture marca hora à frente do relógio
da réplica, e PONTO-113 é um achado documentado ("não existe regime rural").

Esse defeito foi encontrado e corrigido durante a conferência: `qa_caso_detalhe`
tem nome de rotina de teste mas é **ferramenta do motor** — classificar pelo nome
a deixava de fora da entrega. A trilha passou a classificar pelo que a **ponte**
aponta, não pelo que o nome sugere.
