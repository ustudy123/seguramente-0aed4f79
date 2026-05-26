import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export interface PendenciaItem {
  id: string;
  label: string;
  sublabel?: string;
  acao: string;
}

export interface PendenciaGroup {
  key: string;
  title: string;
  count: number;
  items: PendenciaItem[];
  path: string;
  priority: "high" | "medium" | "low";
}

export function usePendencias() {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  return useQuery({
    queryKey: ["pendencias-dashboard", tenantId, empresaAtivaId],
    queryFn: async (): Promise<PendenciaGroup[]> => {
      if (!tenantId) return [];

      const empresaFilter = empresaAtivaId ? { empresa_id: empresaAtivaId } : {};

      const [feriasRes, docRes, ajustesRes, avalRes, desligRes, impEmpRes] = await Promise.all([
        // Férias pendentes de aprovação
        supabase
          .from("ferias_solicitacoes")
          .select("id, colaborador_nome, data_inicio, data_fim, dias_solicitados, status")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .match(empresaFilter)
          .order("created_at", { ascending: false })
          .limit(50),

        // Documentos de admissão pendentes
        supabase
          .from("admissao_documentos")
          .select("id, nome, admissao_id, status, admissoes!inner(nome_completo)")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .limit(50),

        // Ajustes de ponto pendentes
        supabase
          .from("ponto_ajustes")
          .select("id, colaborador_nome, tipo_ajuste, data_referencia, motivo, status")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(50),

        // Avaliações pendentes
        supabase
          .from("avaliacao_respostas")
          .select("id, avaliado_nome, tipo_avaliador, status, ciclo_id")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(50),

        // Desligamentos em andamento
        supabase
          .from("admissoes")
          .select("id, nome_completo, cargo, data_desligamento, motivo_desligamento, status")
          .eq("tenant_id", tenantId)
          .eq("status", "desligado")
          .match(empresaFilter)
          .order("updated_at", { ascending: false })
          .limit(50),

        // Pendências de importação de empresas (duplicidades de CNPJ)
        (supabase as any)
          .from("empresa_import_pendencias")
          .select("id, cnpj, razao_social_planilha, razao_social_existente, linha_planilha, arquivo_nome, motivo")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const ferias = feriasRes.data || [];
      const docs = docRes.data || [];
      const ajustes = ajustesRes.data || [];
      const avals = avalRes.data || [];
      const desligs = desligRes.data || [];
      const impEmps = (impEmpRes as any).data || [];

      const tipoAvaliadorLabel: Record<string, string> = {
        gestor: "Avaliação do Gestor",
        auto: "Autoavaliação",
        par: "Avaliação de Par",
        cliente_interno: "Avaliação de Cliente Interno",
      };

      return [
        {
          key: "ferias",
          title: "Férias pendentes",
          count: ferias.length,
          path: "/ferias",
          priority: "high" as const,
          items: ferias.map((f) => ({
            id: f.id,
            label: f.colaborador_nome,
            sublabel: `${f.dias_solicitados} dias • ${f.data_inicio} a ${f.data_fim}`,
            acao: "Aprovar ou recusar solicitação de férias",
          })),
        },
        {
          key: "documentos",
          title: "Documentos pendentes",
          count: docs.length,
          path: "/documentos",
          priority: "high" as const,
          items: docs.map((d: any) => ({
            id: d.id,
            label: d.nome,
            sublabel: d.admissoes?.nome_completo || "Colaborador",
            acao: "Solicitar envio ou aprovar documento",
          })),
        },
        {
          key: "ajustes",
          title: "Ajustes de ponto",
          count: ajustes.length,
          path: "/ponto",
          priority: "medium" as const,
          items: ajustes.map((a) => ({
            id: a.id,
            label: a.colaborador_nome,
            sublabel: `${a.tipo_ajuste} • ${a.data_referencia}`,
            acao: "Aprovar ou recusar ajuste de ponto",
          })),
        },
        {
          key: "avaliacoes",
          title: "Avaliações pendentes",
          count: avals.length,
          path: "/avaliacoes",
          priority: "low" as const,
          items: avals.map((a) => ({
            id: a.id,
            label: a.avaliado_nome,
            sublabel: tipoAvaliadorLabel[a.tipo_avaliador] || a.tipo_avaliador,
            acao: "Responder avaliação de desempenho",
          })),
        },
        {
          key: "desligamentos",
          title: "Desligamentos",
          count: desligs.length,
          path: "/colaboradores",
          priority: "medium" as const,
          items: desligs.map((d) => ({
            id: d.id,
            label: d.nome_completo,
            sublabel: `${d.cargo || "—"} • ${d.motivo_desligamento || "Sem motivo informado"}`,
            acao: "Concluir processo de desligamento",
          })),
        },
      ];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 3,
  });
}
