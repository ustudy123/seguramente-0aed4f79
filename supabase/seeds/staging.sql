-- Seed para ambiente de staging/testes internos
-- Este script popula um tenant fictício com empresa, departamentos, cargos e colaboradores.
-- IMPORTANTE: crie o usuário de autenticação primeiro (via Supabase Dashboard ou API) e
-- substitua o user_id fixo abaixo pelo UUID real do usuário, ou ajuste o script para inserir
-- o profile com o UUID correto.
--
-- Recomendação: executar em uma instância Supabase limpa (staging) para não misturar dados.

BEGIN;

-- IDs fixos para referência cruzada (pode ser alterado conforme necessário)
SET LOCAL seed.tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL seed.empresa_id = '22222222-2222-2222-2222-222222222222';
SET LOCAL seed.user_id = '00000000-0000-0000-0000-000000000000';

-- 1. Tenant de testes
INSERT INTO public.tenants (id, nome, slug, plano, ativo, configuracoes, created_at, updated_at)
VALUES (
  current_setting('seed.tenant_id')::uuid,
  'Empresa Staging LTDA',
  'empresa-staging',
  'enterprise',
  true,
  '{"demo": true, "ambiente": "staging"}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  slug = EXCLUDED.slug,
  plano = EXCLUDED.plano,
  ativo = EXCLUDED.ativo,
  updated_at = now();

-- 2. Empresa (matriz) de testes
INSERT INTO public.empresa_cadastro (
  id, tenant_id, razao_social, nome_fantasia, cnpj, cidade, estado, cep, telefone, email,
  cnae_principal, cnae_descricao, grau_risco, ativo, created_at, updated_at
)
VALUES (
  current_setting('seed.empresa_id')::uuid,
  current_setting('seed.tenant_id')::uuid,
  'Empresa Staging LTDA',
  'Empresa Staging',
  '00.000.000/0001-00',
  'São Paulo', 'SP', '01000-000', '(11) 99999-9999', 'staging@youreyes.local',
  '6201501', 'Desenvolvimento de programas de computador sob encomenda', 2,
  true, now(), now()
)
ON CONFLICT (id) DO UPDATE SET
  razao_social = EXCLUDED.razao_social,
  nome_fantasia = EXCLUDED.nome_fantasia,
  cnpj = EXCLUDED.cnpj,
  updated_at = now();

-- 3. Departamentos
INSERT INTO public.departamentos (id, tenant_id, nome, descricao, ativo, empresa_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), current_setting('seed.tenant_id')::uuid, 'Administrativo', 'Gestão administrativa e financeira', true, current_setting('seed.empresa_id')::uuid, now(), now()),
  (gen_random_uuid(), current_setting('seed.tenant_id')::uuid, 'Recursos Humanos', 'Departamento pessoal e SST', true, current_setting('seed.empresa_id')::uuid, now(), now()),
  (gen_random_uuid(), current_setting('seed.tenant_id')::uuid, 'Operações', 'Operações e produção', true, current_setting('seed.empresa_id')::uuid, now(), now()),
  (gen_random_uuid(), current_setting('seed.tenant_id')::uuid, 'Tecnologia', 'Desenvolvimento e infraestrutura', true, current_setting('seed.empresa_id')::uuid, now(), now())
ON CONFLICT DO NOTHING;

-- 4. Cargos de exemplo
WITH dept AS (
  SELECT id, nome FROM public.departamentos
  WHERE tenant_id = current_setting('seed.tenant_id')::uuid
)
INSERT INTO public.cargos (
  id, tenant_id, nome, descricao, departamento_id, ativo, empresa_id, created_at, updated_at,
  objetivo_funcao, escopo_geral, responsabilidade, nivel
)
SELECT
  gen_random_uuid(),
  current_setting('seed.tenant_id')::uuid,
  CASE d.nome
    WHEN 'Administrativo' THEN 'Analista Financeiro'
    WHEN 'Recursos Humanos' THEN 'Analista de RH'
    WHEN 'Operações' THEN 'Operador de Produção'
    WHEN 'Tecnologia' THEN 'Desenvolvedor Full Stack'
  END,
  'Cargo de testes para ambiente staging',
  d.id,
  true,
  current_setting('seed.empresa_id')::uuid,
  now(), now(),
  'Objetivo genérico da função',
  'Escopo genérico da função',
  'Responsabilidade genérica',
  'pleno'
FROM dept d
ON CONFLICT DO NOTHING;

-- 5. Colaboradores fictícios
DO $$
DECLARE
  v_tenant_id uuid := current_setting('seed.tenant_id')::uuid;
  v_empresa_id uuid := current_setting('seed.empresa_id')::uuid;
BEGIN
  INSERT INTO public.admissoes (
    id, tenant_id, status, nome_completo, cpf, data_nascimento, estado_civil, genero,
    email, telefone, cidade, estado, cargo, departamento, data_admissao,
    tipo_contrato, jornada_trabalho, salario, gestor_imediato, criado_por, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_tenant_id,
    'ativo'::public.admissao_status,
    'Colaborador ' || n,
    LPAD(n::text, 11, '0'),
    '1990-01-01',
    'solteiro',
    'masculino',
    'colaborador' || n || '@youreyes.local',
    '(11) 99999-' || LPAD(n::text, 4, '0'),
    'São Paulo', 'SP',
    CASE (n % 4)
      WHEN 0 THEN 'Analista Financeiro'
      WHEN 1 THEN 'Analista de RH'
      WHEN 2 THEN 'Operador de Produção'
      ELSE 'Desenvolvedor Full Stack'
    END,
    CASE (n % 4)
      WHEN 0 THEN 'Administrativo'
      WHEN 1 THEN 'Recursos Humanos'
      WHEN 2 THEN 'Operações'
      ELSE 'Tecnologia'
    END,
    '2024-01-01',
    'CLT',
    '8h diárias',
    5000.00,
    'Gestor Staging',
    current_setting('seed.user_id')::uuid,
    now(),
    now()
  FROM generate_series(1, 20) AS n
  ON CONFLICT DO NOTHING;
END $$;

-- 6. Contexto de IA para testes de geração de funções
INSERT INTO public.empresa_cadastro (id, tenant_id, contexto_ia)
VALUES (
  current_setting('seed.empresa_id')::uuid,
  current_setting('seed.tenant_id')::uuid,
  'Empresa de tecnologia e serviços de SST. Processos: financeiros, DP, operação de produção e desenvolvimento de software. Atividades esperadas: contas a pagar/receber, folha de pagamento, admissão/demissão, controle de EPIs, desenvolvimento de funcionalidades, suporte a clientes internos.'
)
ON CONFLICT (id) DO UPDATE SET contexto_ia = EXCLUDED.contexto_ia;

COMMIT;
