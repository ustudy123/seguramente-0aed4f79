# Resultado da conferência de divergência — produção × repositório

Medição feita em 14/08/2026, com os três scripts de
`docs/script_divergencia_producao_parte*.sql`.

Este documento é a **lista de trabalho do alinhamento**. Cada item aqui é uma
coisa que existe de um lado e não do outro.

---

## Primeiro: o que é ruído da medição

**53 das 276 funções apontadas como "faltando" não faltam.** São funções das
extensões `pgcrypto` (36) e `pg_trgm` (31 — 17 aparecem na lista): na produção
elas vivem no schema `extensions`, e na réplica que gerou o inventário elas
estão em `public`, por causa dos atalhos que o `db push` exige (o próprio
CLAUDE.md registra isso). O script olha só `public` e por isso as acusou.

Ignorar: `armor`, `crypt`, `dearmor`, `decrypt*`, `digest`, `encrypt*`,
`gen_random_*`, `gen_salt`, `hmac`, `pgp_*`, `gin_*trgm*`, `gtrgm_*`,
`set_limit`, `show_limit`, `show_trgm`, `similarity*`, `word_similarity*`,
`strict_word_similarity*`.

**Correção pendente no script:** a próxima geração deve excluir funções que
pertencem a extensões (`pg_depend` com `deptype='e'`).

---

## Segundo: o motor de QA nunca foi entregue à produção

Cerca de **197 funções `qa_caso_*`**, mais a tabela `qa_cobertura_e2e`, a coluna
`qa_resultados.evidencia_png` e o valor `e2e` no tipo `qa_disparo`.

Não é uma lista de 200 problemas: é **uma decisão só**. As baterias de QA rodam
no ambiente de teste e, na produção, só existe o que foi colado pontualmente
(PERFIL-001/003 e FERIAS-017, entregues nesta semana). Foi por isso que a
FERIAS-017 quebrou lá: chamava auxiliares que nunca chegaram.

**Decisão a tomar:** entregar o motor inteiro à produção, ou assumir que ele
vive só no teste e parar de entregar rotinas soltas para lá.

---

## Terceiro: o que realmente falta na produção

### Afeta usuário hoje

| Item | Consequência |
|---|---|
| `licenca_adocao` (tipo de afastamento) e `adocao` (subtipo de atestado) | **não é possível lançar afastamento por adoção** |
| `afastamentos_cat.numero_cat` | CAT emitida sem onde guardar o número |
| `afastamentos.data_fim_estabilidade` + `gerar_alertas_estabilidade` | **estabilidade pós-acidente não funciona** |
| `psicossocial_entrevistas`: `tipo_sessao`, `grupo_nome`, `participantes_previstos` | **entrevistas em grupo não funcionam** |
| `admissoes`: 4 colunas `exame_demissional_dispensa_*` + `admissao_carimbar_dispensa_exame`, `exame_demissional_pendencias` | dispensa de exame demissional no desligamento |
| `desligamento_eventos` + `admissao_guardar_desligamento`, `desligamento_retificar` | trilha e retificação de desligamento |
| `reverter_ponto_por_atestado_excluido` | atestado excluído não reverte o ponto |

### Proteção que existe no código e não no banco real

| Item | Consequência |
|---|---|
| `ponto_ajuste_bloqueia_autoaprovacao` | **a trava de autoaprovação do ajuste de ponto (PONTO-252) não está na produção.** É a mesma trava que a FERIAS-056 cita como precedente — e ela não existe onde importa |

### Funcionalidades incompletas

| Área | Falta |
|---|---|
| Feriados | tabela `feriado_folga_compensatoria` (+ gatilho e política), `feriado_folga_compensatoria_touch`, `feriados_da_empresa`, `ponto_feriados_colaborador`, `ponto_feriado_adicional_competencia` |
| Retenção de ponto | tabela `ponto_expurgo_eventos` (+ gatilho e política), `ponto_expurgar_geolocalizacao` |
| Auditoria de ponto | `ponto_auditoria_ajustes_motivo`, `ponto_auditoria_motivos_resumo` |
| Ponto (apoio) | `ponto_colaborador_id_por_cpf`, `ponto_dias_repetidos_na_apuracao`, `ponto_links_desativar_vencidos`, `ponto_saldo_dias_competencia_bruto` |
| Documentos | `documento_pasta_do_colaborador`, `documento_resolver_dono_e_pasta`, `documento_versao_numerar`, `reconciliar_documentos_colaborador`, `admissao_reconciliar_documentos` |
| Admissões | `admissao_normalizar_cpf`, `admissoes_cpf_duplicado` |
| Férias | `ferias_deriva_dias_direito` — entregue hoje, ainda não colada. Esperado. |

---

## Quarto: o que existe só na produção e precisa voltar para o código

Sem isso, **o repositório não consegue reconstruir a produção** — e o ambiente
de teste roda com uma estrutura diferente da real.

| Objeto | Observação |
|---|---|
| `ponto_diario.feriado_nome` e `feriado_trabalhado` | **as duas mais graves**: o front (`usePonto.ts`, `Ponto.tsx`) lê essas colunas, e nenhuma migration as cria. No ambiente de teste elas não existem |
| `admissoes_limpeza_duplicidade` (tabela) | criada direto no banco |
| `_add_feriado_nacional`, `gerar_feriados_nacionais` | geração de feriados nacionais |
| `_ponto_class_feriado` | classificação de feriado no ponto |
| `bloquear_exclusao_cargo_vinculado` | trava de exclusão de cargo |
| `sync_ultimo_acesso_usuario` | último acesso do usuário |
| `ponto_retencao_config.id` | coluna a mais na produção |

---

## Gatilhos e políticas que diferem

Oito tabelas com gatilhos diferentes e cinco com políticas diferentes. A maior
parte é consequência dos itens acima (a tabela existe nos dois lados, mas um
deles tem um gatilho a mais). Precisam de comparação dirigida depois que o
resto estiver alinhado — comparar agora só produziria ruído.

Um dado positivo: `qa_guarda_cercado` aparece nos gatilhos da produção, ou seja,
a cerca de QA está lá.

---

## Ordem de trabalho sugerida

1. **Adoção, CAT, estabilidade e entrevistas em grupo** — são os itens que
   impedem trabalho hoje, e são pequenos (valores de tipo e colunas).
2. **A trava de autoaprovação do ponto** — proteção que todos acreditam existir.
3. **Trazer para o repositório o que só existe na produção** — em especial as
   duas colunas de `ponto_diario`, que hoje deixam o ambiente de teste mentindo.
4. **Feriados, retenção, documentos e desligamento** — blocos maiores, um por
   entrega.
5. **Motor de QA** — depois da decisão sobre se ele deve viver na produção.
6. **Reavaliar o terceiro ambiente** com a produção já alinhada.
