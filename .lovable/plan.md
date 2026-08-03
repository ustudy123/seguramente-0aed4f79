# Corrigir GHE excluído aparecendo nos relatórios psicossociais

## O que está acontecendo (verificado no banco)

As respostas do questionário guardam um "carimbo" do GHE (`ghe_id_snapshot`) gravado uma única vez. Hoje existem 4 respostas carimbadas com o GHE "GHE 03" que **não existe mais** na tabela de GHEs — foi excluído. O relatório agrupa pelo carimbo e usa o nome guardado na própria resposta, por isso o GHE 03 continua saindo no PDF mesmo depois de excluído.

Além disso, a rotina que preenche esse carimbo (`preencher_ghe_snapshot_respostas`) só atua em respostas com carimbo **vazio**. Quando você muda funções/setores de um GHE, ou move pessoas de um GHE para outro, as respostas já carimbadas continuam com o GHE antigo — não acompanham a alteração.

## O que será feito

### 1. O carimbo passa a acompanhar o cadastro atual
Reescrever a rotina de preenchimento para **reavaliar todas as respostas** da campanha, não só as sem carimbo:
- Limpa o carimbo quando o GHE apontado não existe mais (caso do GHE 03).
- Regrava o carimbo quando o cargo/setor da pessoa passou a pertencer a outro GHE (as 4 pessoas do GHE 03 passam a contar no GHE 01, se a composição do GHE 01 hoje inclui esses cargos/setores).
- Mantém o mesmo cruzamento anônimo já usado hoje (cpf_hash → admissão → cargo/setor → GHE); o CPF continua sem sair do banco.

### 2. Proteção no relatório
No agrupamento por GHE (`usePsicossocialResultadosGHE`), descartar qualquer grupo cujo `ghe_id` não exista mais na tabela de GHEs — assim nenhum GHE excluído volta ao PDF nem à tela, mesmo que algum carimbo antigo escape.

### 3. Reprocessar os dados existentes
Rodar a reavaliação uma vez sobre as campanhas já respondidas, para que os relatórios atuais (inclusive o da CRT) saiam corrigidos sem depender de nova resposta.

## Resultado esperado
- GHE 03 desaparece do PDF e da tela de resultados.
- As 4 respostas passam a compor o GHE 01 (conforme a composição atual de cargos/setores).
- Qualquer alteração futura de funções/setores nos GHEs passa a refletir automaticamente no próximo carregamento do relatório.

## Detalhes técnicos
- Migração: `CREATE OR REPLACE FUNCTION public.preencher_ghe_snapshot_respostas(uuid[])` — remover o filtro `ghe_id_snapshot IS NULL`, usar `LEFT JOIN` do carimbo atual contra `psicossocial_ghe` e aplicar `UPDATE` quando `ghe_id_snapshot IS DISTINCT FROM` o GHE resolvido (inclusive para `NULL`).
- Frontend: em `src/hooks/usePsicossocialResultadosGHE.ts`, filtrar `resultadosPorGHE` pelos ids presentes em `ghes` carregados; carimbos órfãos caem em "Sem GHE definido" ou são ignorados na estratificação.
- Nenhuma mudança de schema; apenas função + hook.
