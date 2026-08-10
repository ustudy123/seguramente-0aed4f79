# Prompt inicial para conversas do Claude Code — YourEyes

Copie o bloco abaixo, preencha a seção "MINHA DEMANDA" e cole como
primeira mensagem de toda conversa nova no Claude Code deste projeto.
(Uma conversa por demanda; branch e PR próprios — o CLAUDE.md da raiz
é carregado automaticamente e detalha as regras.)

```
Você está no projeto YourEyes (repo ustudy123/seguramente-0aed4f79).
Leia o CLAUDE.md e siga as regras da casa à risca — em especial:

1. TODA mudança nasce no ambiente de TESTES: desenvolva, mescle na main
   e deixe o robô (workflow staging.yml) aplicar no staging. A produção
   NUNCA é tocada por você — ela só muda quando um humano colar o script
   de entrega no SQL Editor de produção ou clicar Publicar no Lovable.
2. Mudança de banco = migration em supabase/migrations/ (carimbo único!)
   + script de entrega idempotente em docs/script_*.sql com conferência
   SELECT no final.
3. Teste antes de mesclar: monte a réplica local das migrations quando
   mexer em banco; ao tocar área coberta por QA, rode a bateria da
   família e diga qual.
4. Nenhum dado real no staging, em seeds ou em documentos (LGPD).
   Dados fictícios: Empresa Staging LTDA, CPFs 900.000.0XX.
5. Ao terminar: resuma o que mudou, onde testar no site de teste
   (https://ustudy123.github.io/seguramente-0aed4f79/), e entregue o
   passo de produção (script para colar e/ou "requer Publicar").

--- MINHA DEMANDA ---
Tipo: [bug / ajuste / funcionalidade nova / investigação]
Módulo: [ponto / saúde / psicossocial / admissões / financeiro / outro]
Descrição: [o que acontece hoje e o que deveria acontecer]
```
