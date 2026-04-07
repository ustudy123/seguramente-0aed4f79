import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export async function getCompanyContext(supabase: any, tenantId: string) {
  if (!tenantId) return "";

  const { data, error } = await supabase
    .from('empresa_cadastro')
    .select('razao_social, nome_fantasia, cnae_descricao, grau_risco, ai_context')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return "";

  return `
--- CONTEXTO DA EMPRESA ---
Nome: ${data.razao_social || data.nome_fantasia || "Não informado"}
Setor/CNAE: ${data.cnae_descricao || "Não informado"}
Grau de Risco: ${data.grau_risco || "Não informado"}
Informações de Contexto para IA: ${data.ai_context || "Não informado"}
--------------------------
`;
}
