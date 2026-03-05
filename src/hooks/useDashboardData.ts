import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export interface PilarData {
  organizacao: {
    totalColaboradores: number;
    cargosDefinidos: number;
    departamentos: number;
    admissoesAndamento: number;
    score: number;
  };
  condicoes: {
    itensNr17Atendidos: number;
    itensNr17Total: number;
    episDisponiveis: number;
    episBaixoEstoque: number;
    riscosAtivos: number;
    score: number;
  };
  experiencia: {
    humorPositivo: number;
    humorTotal: number;
    ouvidoriaPendente: number;
    feedPostsHoje: number;
    score: number;
  };
  governanca: {
    acoesEmAndamento: number;
    acoesConcluidas: number;
    acoesTotal: number;
    evidenciasEnviadas: number;
    terceirosAtivos: number;
    terceirosConformes: number;
    ptsBloqueadas: number;
    score: number;
  };
}

export const useDashboardData = () => {
  const { tenant } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();

  return useQuery({
    queryKey: ["dashboard-pilares", tenant?.id, empresaAtivaId],
    queryFn: async (): Promise<PilarData> => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");

      // Parallel queries for all pilares
      const [
        cargosRes,
        departamentosRes,
        admissoesRes,
        itensNr17Res,
        episRes,
        riscosRes,
        humorRes,
        ouvidoriaRes,
        feedRes,
        acoesRes,
        evidenciasRes,
        terceirosRes,
        ptsRes,
      ] = await Promise.all([
        // Pilar 1 - Organização
        supabase.from("cargos").select("id", { count: "exact" }).eq("tenant_id", tenant.id).eq("ativo", true),
        supabase.from("departamentos").select("id", { count: "exact" }).eq("tenant_id", tenant.id).eq("ativo", true),
        supabase.from("admissoes").select("id", { count: "exact" }).eq("tenant_id", tenant.id).neq("status", "concluido").neq("status", "reprovado").match(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
        
        // Pilar 2 - Condições
        supabase.from("ergonomia_itens_nr17").select("id, status").eq("tenant_id", tenant.id),
        supabase.from("epis").select("id, quantidade_estoque, quantidade_minima, status").eq("tenant_id", tenant.id).match(empresaAtivaId ? { empresa_id: empresaAtivaId } : {}),
        supabase.from("ergonomia_riscos").select("id").eq("tenant_id", tenant.id).eq("ativo", true),
        
        // Pilar 3 - Experiência
        supabase.from("humor_diario").select("id, humor").eq("tenant_id", tenant.id).gte("data", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
        supabase.from("ouvidoria").select("id").eq("tenant_id", tenant.id).eq("status", "pendente"),
        supabase.from("feed_posts").select("id").eq("tenant_id", tenant.id).gte("created_at", new Date().toISOString().split("T")[0]),
        
        // Pilar 4 - Governança
        supabase.from("ergonomia_acoes").select("id, status").eq("tenant_id", tenant.id),
        supabase.from("ergonomia_evidencias").select("id").eq("tenant_id", tenant.id),
        // Terceiros cross-module
        supabase.from("terceiros" as never).select("id, status").eq("tenant_id", tenant.id),
        supabase.from("permissoes_trabalho" as never).select("id, status").eq("tenant_id", tenant.id),
      ]);

      // Calcular métricas Pilar 1
      const cargos = cargosRes.count || 0;
      const departamentos = departamentosRes.count || 0;
      const admissoes = admissoesRes.count || 0;
      const scoreOrganizacao = 0;

      // Calcular métricas Pilar 2
      const itensNr17 = itensNr17Res.data || [];
      const itensAtendidos = itensNr17.filter(i => i.status === "atendido").length;
      const itensTotal = itensNr17.length;
      const epis = episRes.data || [];
      const episDisponiveis = epis.filter(e => e.status === "disponivel").length;
      const episBaixoEstoque = epis.filter(e => e.quantidade_estoque <= e.quantidade_minima).length;
      const riscosAtivos = riscosRes.count || 0;
      const scoreCondicoes = 0;

      // Calcular métricas Pilar 3
      const humores = humorRes.data || [];
      const ouvidoriaPendente = ouvidoriaRes.count || 0;
      const feedHoje = feedRes.count || 0;
      const scoreExperiencia = 0;

      // Calcular métricas Pilar 4
      const acoes = acoesRes.data || [];
      const acoesConcluidas = acoes.filter(a => a.status === "concluida").length;
      const acoesEmAndamento = acoes.filter(a => a.status === "em_andamento").length;
      const evidencias = evidenciasRes.count || 0;
      
      // Terceiros metrics
      const terceirosData = (terceirosRes.data as any[]) || [];
      const terceirosAtivos = terceirosData.length;
      const terceirosConformes = terceirosData.filter((t: any) => t.status === "liberado").length;
      const ptsData = (ptsRes.data as any[]) || [];
      const ptsBloqueadas = ptsData.filter((p: any) => p.status === "bloqueada").length;
      
      const scoreGovernanca = 0;

      return {
        organizacao: {
          totalColaboradores: 0, // Será implementado com tabela de colaboradores
          cargosDefinidos: cargos,
          departamentos: departamentos,
          admissoesAndamento: admissoes,
          score: scoreOrganizacao,
        },
        condicoes: {
          itensNr17Atendidos: itensAtendidos,
          itensNr17Total: itensTotal,
          episDisponiveis: episDisponiveis,
          episBaixoEstoque: episBaixoEstoque,
          riscosAtivos: riscosAtivos,
          score: scoreCondicoes,
        },
        experiencia: {
          humorPositivo: 0,
          humorTotal: humores.length,
          ouvidoriaPendente: ouvidoriaPendente,
          feedPostsHoje: feedHoje,
          score: scoreExperiencia,
        },
        governanca: {
          acoesEmAndamento: acoesEmAndamento,
          acoesConcluidas: acoesConcluidas,
          acoesTotal: acoes.length,
          evidenciasEnviadas: evidencias,
          terceirosAtivos,
          terceirosConformes,
          ptsBloqueadas,
          score: scoreGovernanca,
        },
      };
    },
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};
