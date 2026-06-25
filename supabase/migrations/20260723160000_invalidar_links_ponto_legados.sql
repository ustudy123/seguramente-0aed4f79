-- =====================================================================
-- Invalida os links de ponto ANTIGOS (por colaborador)
-- =====================================================================
-- O registro de ponto migrou para o LINK ÚNICO compartilhado (CPF + selfie).
-- Os links antigos, um por colaborador (ponto_links com tipo='colaborador'),
-- não são mais usados. Aqui eles são desativados (ativo=false) — as RPCs
-- externas exigem ativo=true, então passam a retornar "Link inválido ou
-- expirado.". Operação reversível e idempotente.
--
-- O link compartilhado (tipo='compartilhado') NÃO é afetado.
-- =====================================================================

UPDATE public.ponto_links
SET ativo = false,
    updated_at = now()
WHERE tipo = 'colaborador'
  AND ativo = true;
