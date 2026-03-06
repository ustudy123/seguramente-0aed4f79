ALTER TABLE public.estrategia_swot ADD COLUMN IF NOT EXISTS grupo_economico_id UUID REFERENCES public.grupos_economicos(id) ON DELETE SET NULL;
ALTER TABLE public.estrategia_oceano_azul ADD COLUMN IF NOT EXISTS grupo_economico_id UUID REFERENCES public.grupos_economicos(id) ON DELETE SET NULL;
ALTER TABLE public.estrategia_cultura ADD COLUMN IF NOT EXISTS grupo_economico_id UUID REFERENCES public.grupos_economicos(id) ON DELETE SET NULL;
ALTER TABLE public.estrategia_organograma ADD COLUMN IF NOT EXISTS grupo_economico_id UUID REFERENCES public.grupos_economicos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_estrategia_swot_grupo ON public.estrategia_swot(grupo_economico_id) WHERE grupo_economico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estrategia_oceano_grupo ON public.estrategia_oceano_azul(grupo_economico_id) WHERE grupo_economico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estrategia_cultura_grupo ON public.estrategia_cultura(grupo_economico_id) WHERE grupo_economico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estrategia_organograma_grupo ON public.estrategia_organograma(grupo_economico_id) WHERE grupo_economico_id IS NOT NULL;