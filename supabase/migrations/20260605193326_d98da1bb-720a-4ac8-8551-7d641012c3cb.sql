-- Função para definir uma empresa como principal (matriz) de um tenant
CREATE OR REPLACE FUNCTION public.superadmin_set_principal_empresa(_empresa_id UUID, _tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Verificar se o usuário atual é superadmin (opcional se o GRANT for restrito, mas recomendado)
  IF NOT EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid() AND ativo = true) THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmins podem realizar esta operação.';
  END IF;

  -- 2. Garantir que a empresa pertence ao tenant informado
  IF NOT EXISTS (SELECT 1 FROM public.empresa_cadastro WHERE id = _empresa_id AND tenant_id = _tenant_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada ou não pertence ao tenant informado.';
  END IF;

  -- 3. Rebaixar todas as matrizes atuais desse tenant para filiais
  UPDATE public.empresa_cadastro
  SET tipo_unidade = 'filial',
      updated_at = now()
  WHERE tenant_id = _tenant_id
    AND tipo_unidade = 'matriz';

  -- 4. Promover a empresa selecionada a matriz
  UPDATE public.empresa_cadastro
  SET tipo_unidade = 'matriz',
      updated_at = now()
  WHERE id = _empresa_id;

  -- 5. Opcional: Atualizar o nome do tenant para refletir o nome da nova matriz (comportamento padrão de criação)
  -- Decidimos não fazer isso automaticamente para evitar efeitos colaterais inesperados no slug/nome do tenant, 
  -- a menos que o usuário explicitamente peça.

END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_set_principal_empresa(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_set_principal_empresa(UUID, UUID) TO service_role;