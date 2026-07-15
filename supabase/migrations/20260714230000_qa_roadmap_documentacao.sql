-- =========================================================
-- QA — Roadmap da documentação no próprio painel
--
-- O plano de "por onde começar" não pode viver num chat. Passa a ser
-- estado do diretório.
--
-- Dois campos, deliberadamente separados:
--   prioridade_doc → risco/importância INTRÍNSECA do bloco. Não muda
--                    porque o módulo está pronto ou não.
--   status_doc     → PRONTIDÃO/progresso. Muda com o tempo.
--
-- Por isso Jornada & Rotina fica prioridade 1 E bloqueado: ele é o mais
-- crítico do sistema (CLT), mas as regras de negócio estão em alteração.
-- Documentar caso de teste contra regra instável eterniza como
-- especificação algo que vai ser trocado. Quando estabilizar, é só mudar
-- o status — sem renumerar a fila.
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.qa_status_doc AS ENUM (
    'nao_iniciado',  -- na fila
    'bloqueado',     -- regra de negócio em alteração; não documentar ainda
    'em_andamento',  -- sendo documentado
    'documentado',   -- casos escritos e aprovados
    'dispensado'     -- decisão explícita de não documentar
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.qa_modulos
  ADD COLUMN IF NOT EXISTS prioridade_doc  int NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS status_doc      public.qa_status_doc NOT NULL DEFAULT 'nao_iniciado',
  ADD COLUMN IF NOT EXISTS motivo_bloqueio text;

COMMENT ON COLUMN public.qa_modulos.prioridade_doc IS
  'Ordem de ataque da documentação (1 = mais crítico). Risco intrínseco: não muda com a prontidão.';
COMMENT ON COLUMN public.qa_modulos.status_doc IS
  'Prontidão/progresso da documentação deste módulo.';
COMMENT ON COLUMN public.qa_modulos.motivo_bloqueio IS
  'Por que está bloqueado/dispensado — a decisão fica registrada, não esquecida.';

-- ---------------------------------------------------------
-- Semeia o plano. Cada item herda a prioridade do bloco, para a
-- ordenação funcionar em qualquer nível da árvore.
-- ---------------------------------------------------------
DO $plano$
DECLARE
  r RECORD;
  v_prio CONSTANT jsonb := jsonb_build_object(
    'jornada-rotina',              1,   -- CLT: o mais crítico do sistema
    'infraestrutura-auth',         2,   -- RLS/LGPD: existencial em multi-tenant
    'estrutura-organizacional',    3,   -- fundação; PILOTO
    'saude-seguranca',             4,   -- NR-01 / NR-06
    'desenvolvimento-performance', 5,
    'pessoas-cultura',             6,
    'documentos-governanca',       7,
    'financeiro',                  7,
    'planejamento-gestao',         8,
    'rede-parceiros',              8,
    'academia',                    8,
    'sistema',                     8
  );
BEGIN
  -- Aplica a prioridade ao bloco e a todos os descendentes (path prefix)
  FOR r IN SELECT key AS raiz, value::int AS prio FROM jsonb_each(v_prio) LOOP
    UPDATE public.qa_modulos
    SET    prioridade_doc = r.prio
    WHERE  path = r.raiz OR path LIKE r.raiz || '/%';
  END LOOP;

  -- Jornada & Rotina: bloqueado — regras de negócio em alteração
  UPDATE public.qa_modulos
  SET    status_doc      = 'bloqueado',
         motivo_bloqueio = 'Regras de negócio em alteração (jul/2026). Documentar agora eternizaria comportamento que vai mudar. Reavaliar quando estabilizar.'
  WHERE  path = 'jornada-rotina' OR path LIKE 'jornada-rotina/%';
END $plano$;
