## Objetivo
Apagar as 13 empresas cadastradas pelo usuário `renata_sophia_cortereal@cafefrossard.com` (tenant `b344b6ba-7457-4786-ad00-0bbf84666959`) para que ele possa reimportar a planilha do zero.

## Empresas que serão apagadas (13)
- Alpha Comércio LTDA
- Atlas Alimentos LTDA
- Aurora Alimentos LTDA
- Aurora Daiane Lima
- ELEICOES 2004 - JOAQUIM LOPES DE SOUZA - PREFEITO
- Fort Alimentos LTDA
- Global Consultoria LTDA
- Nexus Consultoria LTDA
- Nova Comércio LTDA
- Prime Financeira LTDA
- Sigma Comércio LTDA
- teste 2
- Vision Transportes LTDA

Verificado: nenhuma terceiros vinculada. Sem tabela de colaboradores no schema. Limpo para deletar.

## Execução
1. Migration única apagando todos os registros dependentes (FKs em `empresa_obrigacoes`, `documentos`, `documento_pastas`, `gro_riscos`, `plano_acoes`, `usuario_vinculos`, etc.) filtrando por `tenant_id` da Renata e `empresa_id IN (...)`.
2. Em seguida `DELETE FROM empresa_cadastro WHERE tenant_id = 'b344b6ba-...'`.
3. Estratégia: usar um bloco `DO $$` que itera as tabelas com coluna `empresa_id` e executa `DELETE` filtrando pelo tenant — evita listar 60+ tabelas manualmente e respeita FKs (a maioria tem `ON DELETE CASCADE`, mas garantimos limpeza).

## Atenção
- A operação é destrutiva e irreversível.
- Mantém o tenant, profile, usuário e estrutura de pastas auto-geradas (serão recriadas no próximo cadastro).

Confirma que posso executar?
