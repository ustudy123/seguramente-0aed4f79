ALTER TABLE public.empresa_obrigacoes DROP CONSTRAINT empresa_obrigacoes_acao_gerada_id_fkey, ADD CONSTRAINT empresa_obrigacoes_acao_gerada_id_fkey FOREIGN KEY (acao_gerada_id) REFERENCES public.plano_acoes(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_contratacoes DROP CONSTRAINT marketplace_contratacoes_acao_vinculada_id_fkey, ADD CONSTRAINT marketplace_contratacoes_acao_vinculada_id_fkey FOREIGN KEY (acao_vinculada_id) REFERENCES public.plano_acoes(id) ON DELETE SET NULL;

ALTER TABLE public.psicossocial_alertas DROP CONSTRAINT psicossocial_alertas_acao_id_fkey, ADD CONSTRAINT psicossocial_alertas_acao_id_fkey FOREIGN KEY (acao_id) REFERENCES public.plano_acoes(id) ON DELETE SET NULL;