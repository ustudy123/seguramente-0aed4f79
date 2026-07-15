-- =========================================================
-- QA — Colaboradores: regra de unicidade em DOIS níveis
--
-- Regra de negócio confirmada (jul/2026):
--   "Dentro da mesma empresa não poderá duplicar CPF, pois o CPF é visto
--    como chave única (validando formatações diferentes). Entre empresas
--    diferentes a validação muda, pois não há restrição na legislação de
--    uma pessoa ter vínculo em apenas uma empresa."
--
-- Isso se traduz em DOIS níveis distintos, e o schema só cobre um:
--
--   Nível PESSOA (usuarios_base)
--     usuarios_base_cpf_tenant_uidx (tenant_id, cpf) WHERE cpf IS NOT NULL
--     → CPF único por tenant. COBERTO — desde que o CPF seja normalizado
--       (ver COLAB-033; sem normalização o índice não protege nada).
--
--   Nível VÍNCULO (usuario_vinculos)
--     usuario_vinculos_usuario_idx / _empresa_idx / _tenant_idx
--     → todos NÃO ÚNICOS. NÃO COBERTO: nada impede a mesma pessoa de ter
--       dois vínculos ATIVOS na mesma empresa. É exatamente o que a regra
--       proíbe.
--
-- A correção estrutural (a propor, não aplicada aqui) seria um índice
-- único PARCIAL — parcial porque readmissão na mesma empresa precisa
-- conviver com o vínculo anterior encerrado (COLAB-036):
--
--   CREATE UNIQUE INDEX usuario_vinculos_ativo_uidx
--     ON public.usuario_vinculos(empresa_id, usuario_id)
--     WHERE status = 'ativo';
--
-- Aplicar isso exige antes varrer duplicatas ativas já existentes, senão
-- a criação do índice falha. Por isso fica documentado, não executado.
-- =========================================================

DO $seed$
DECLARE
  v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos
  WHERE path = 'estrutura-organizacional/colaboradores';

  IF v_mod IS NULL THEN
    RAISE EXCEPTION 'Módulo estrutura-organizacional/colaboradores não encontrado.';
  END IF;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  (v_mod, 'COLAB-025', 'Segundo vínculo ativo na mesma empresa é recusado',
   'negativo', 'critica', 'aprovado', 'api',
   'Dentro de uma empresa o CPF é chave única: a mesma pessoa não pode figurar duas vezes como colaboradora ativa.',
   'COLAB-001 executado: pessoa com vínculo ativo na empresa A.',
   '[{"ordem":1,"acao":"Criar um segundo vínculo ATIVO da mesma pessoa na MESMA empresa A","resultado_esperado":"Recusado — a pessoa já é colaboradora ativa desta empresa"},
     {"ordem":2,"acao":"Ler a mensagem exibida","resultado_esperado":"Erro em português indicando que a pessoa já possui vínculo ativo nesta empresa"},
     {"ordem":3,"acao":"Contar vínculos ativos de (empresa A, pessoa)","resultado_esperado":"Exatamente 1"},
     {"ordem":4,"acao":"Tentar o mesmo pela importação de planilha (CPF repetido em duas linhas para a empresa A)","resultado_esperado":"Recusado ou consolidado em 1 — a importação não é rota alternativa para burlar a regra"}]'::jsonb,
   'Uma pessoa tem no máximo um vínculo ativo por empresa.',
   'GAP ESTRUTURAL: usuario_vinculos não tem índice único (só _usuario_idx, _empresa_idx, _tenant_idx, todos comuns). Hoje nada impede a duplicata. Correção proposta: índice único PARCIAL (empresa_id, usuario_id) WHERE status = ativo — parcial para não bloquear a readmissão do COLAB-036. Passo 4 é essencial: a regra tem que valer nas duas rotas de entrada.'),

  (v_mod, 'COLAB-026', 'Mesma pessoa em duas empresas do tenant é permitida',
   'alternativo', 'alta', 'aprovado', 'api',
   'A contraparte da regra: entre empresas diferentes não há restrição legal a múltiplos vínculos.',
   'Tenant de teste com empresas A e B. Pessoa com vínculo ativo em A.',
   '[{"ordem":1,"acao":"Criar vínculo ativo da mesma pessoa na empresa B","resultado_esperado":"Aceito — a legislação não restringe a pessoa a um único vínculo empregatício"},
     {"ordem":2,"acao":"Conferir usuarios_base","resultado_esperado":"Continua 1 pessoa — o CPF não duplicou; a multiplicidade vive no vínculo, não na pessoa"},
     {"ordem":3,"acao":"Contar vínculos ativos da pessoa","resultado_esperado":"2 — um em A, outro em B"},
     {"ordem":4,"acao":"Listar colaboradores de A e de B","resultado_esperado":"A pessoa aparece nas duas, com o cargo de cada vínculo"}]'::jsonb,
   'Pessoa única no tenant; um vínculo ativo por empresa; várias empresas permitidas.',
   'Junto com COLAB-025 fecha a regra em dois níveis. A correção proposta em COLAB-025 (índice parcial por empresa_id) preserva este caso — por isso a chave é (empresa_id, usuario_id) e não (tenant_id, usuario_id).')

  ON CONFLICT (codigo) DO NOTHING;

  -- COLAB-033 deixa de ser hipótese: a normalização virou regra confirmada.
  UPDATE public.qa_casos_teste
  SET observacoes = 'REGRA CONFIRMADA (jul/2026): o CPF é chave única e a validação deve considerar formatações diferentes. Sem normalização, o índice usuarios_base_cpf_tenant_uidx compara string e deixa passar "111.222.333-44" e "11122233344" como pessoas distintas — provável causa-raiz do bug de duplicação por reimportação. A normalização é pré-requisito para COLAB-020, COLAB-025 e COLAB-030 funcionarem.'
  WHERE codigo = 'COLAB-033';

  -- COLAB-012 e COLAB-026 se sobrepõem; o antigo aponta para o novo.
  UPDATE public.qa_casos_teste
  SET observacoes = 'Ver COLAB-026, que detalha a regra de dois níveis (pessoa por tenant x vínculo por empresa).'
  WHERE codigo = 'COLAB-012';

  RAISE NOTICE 'Regra de unicidade em dois níveis documentada (COLAB-025, COLAB-026).';
END $seed$;
