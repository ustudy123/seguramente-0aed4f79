-- Corrigindo a restrição de pastas de documentos
ALTER TABLE public.documento_pastas 
DROP CONSTRAINT IF EXISTS documento_pastas_tenant_id_fkey,
ADD CONSTRAINT documento_pastas_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Corrigindo outras restrições comuns que impedem a exclusão de tenants
ALTER TABLE public.documento_audit_log 
DROP CONSTRAINT IF EXISTS documento_audit_log_tenant_id_fkey,
ADD CONSTRAINT documento_audit_log_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.documento_categorias_padrao 
DROP CONSTRAINT IF EXISTS documento_categorias_padrao_tenant_id_fkey,
ADD CONSTRAINT documento_categorias_padrao_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.beneficios_tipos 
DROP CONSTRAINT IF EXISTS beneficios_tipos_tenant_id_fkey,
ADD CONSTRAINT beneficios_tipos_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.beneficios_colaboradores 
DROP CONSTRAINT IF EXISTS beneficios_colaboradores_tenant_id_fkey,
ADD CONSTRAINT beneficios_colaboradores_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.funcao_epis 
DROP CONSTRAINT IF EXISTS funcao_epis_tenant_id_fkey,
ADD CONSTRAINT funcao_epis_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.sst_documentos 
DROP CONSTRAINT IF EXISTS sst_documentos_tenant_id_fkey,
ADD CONSTRAINT sst_documentos_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.folha_periodos 
DROP CONSTRAINT IF EXISTS folha_periodos_tenant_id_fkey,
ADD CONSTRAINT folha_periodos_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.folha_itens 
DROP CONSTRAINT IF EXISTS folha_itens_tenant_id_fkey,
ADD CONSTRAINT folha_itens_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.folha_eventos 
DROP CONSTRAINT IF EXISTS folha_eventos_tenant_id_fkey,
ADD CONSTRAINT folha_eventos_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
