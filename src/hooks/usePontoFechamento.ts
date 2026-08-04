import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import { format } from "date-fns";

export interface PontoFechamento {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  competencia: string;
  data_fechamento: string | null;
  status: string;
  fechado_por: string | null;
  fechado_por_nome: string | null;
  total_colaboradores: number;
  total_horas_normais_minutos: number;
  total_horas_extras_minutos: number;
  total_adicional_noturno_minutos: number;
  total_faltas: number;
  total_atrasos: number;
  observacoes: string | null;
  created_at: string;
}

export interface PontoEspelho {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  competencia: string;
  total_horas_normais_minutos: number;
  total_horas_extras_50_minutos: number;
  total_horas_extras_100_minutos: number;
  total_adicional_noturno_minutos: number;
  total_faltas: number;
  total_atrasos_minutos: number;
  total_dsr: number;
  banco_horas_saldo_minutos: number;
  // Campos vindos da apuração (ponto_saldo_dias_competencia). Os de cima,
  // de HE 50/100 e adicional noturno, permanecem para não quebrar espelho
  // já emitido, mas a consolidação atual não os preenche.
  total_trabalhado_minutos?: number | null;
  total_jornada_prevista_minutos?: number | null;
  total_creditos_minutos?: number | null;
  total_debitos_minutos?: number | null;
  total_dias_trabalhados?: number | null;
  total_dias_protegidos?: number | null;
  total_excedente_retido_minutos?: number | null;
  dia_equalizacao?: string | null;
  status: string;
  ressalva_texto: string | null;
  data_confirmacao: string | null;
  created_at: string | null;
}

export function usePontoFechamento() {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const useFechamentos = () => {
    return useQuery({
      queryKey: ["ponto-fechamentos", tenantId, empresaAtivaId],
      queryFn: async (): Promise<PontoFechamento[]> => {
        if (!tenantId) return [];
        let query = fromTable("ponto_fechamentos")
          .select("*")
          .eq("tenant_id", tenantId);
        if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);
        const { data, error } = await query.order("competencia", { ascending: false }) as { data: PontoFechamento[] | null; error: Error | null };
        if (error) throw error;
        return data || [];
      },
      enabled: !!tenantId,
    });
  };

  const useEspelhos = (competencia: string) => {
    return useQuery({
      queryKey: ["ponto-espelhos", tenantId, competencia],
      queryFn: async (): Promise<PontoEspelho[]> => {
        if (!tenantId) return [];
        const { data, error } = await fromTable("ponto_espelhos")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("competencia", competencia)
          .order("colaborador_nome") as { data: PontoEspelho[] | null; error: Error | null };
        if (error) throw error;
        return data || [];
      },
      enabled: !!tenantId && !!competencia,
    });
  };

  const fecharPeriodoMutation = useMutation({
    mutationFn: async ({ competencia, observacoes }: { competencia: string; observacoes?: string }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      // Get daily records for the period
      const startDate = `${competencia}-01`;
      const endMonth = parseInt(competencia.split("-")[1]);
      const endYear = parseInt(competencia.split("-")[0]);
      const lastDay = new Date(endYear, endMonth, 0).getDate();
      const endDate = `${competencia}-${lastDay}`;

      const { data: pontos } = await fromTable("ponto_diario")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("data", startDate)
        .lte("data", endDate) as { data: any[] | null };

      const registros = pontos || [];

      // Create/update fechamento
      const { data: fechamento, error: fechError } = await fromTable("ponto_fechamentos")
        .upsert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          competencia,
          data_fechamento: new Date().toISOString(),
          status: "fechado",
          fechado_por: user.id,
          fechado_por_nome: profile?.nome_completo,
          total_colaboradores: new Set(registros.map((r: any) => r.colaborador_cpf)).size,
          total_faltas: registros.filter((r: any) => r.status === "falta").length,
          total_atrasos: registros.filter((r: any) => r.status === "atraso").length,
          observacoes,
        } as never, { onConflict: "tenant_id,empresa_id,competencia" })
        .select()
        .single();

      if (fechError) throw fechError;

      // Generate espelhos for each colaborador
      const colaboradores = new Map<string, any[]>();
      registros.forEach((r: any) => {
        const key = r.colaborador_cpf;
        if (!colaboradores.has(key)) colaboradores.set(key, []);
        colaboradores.get(key)!.push(r);
      });

      // Os totais vêm da APURAÇÃO, não das colunas de ponto_diario. As
      // colunas de HE 50/100, adicional noturno e atraso deixaram de ser
      // preenchidas quando a consolidação foi reescrita — somá-las gerava
      // espelho zerado para todo mundo.
      for (const [cpf, dias] of colaboradores) {
        const primeiro = dias[0];
        const cpfDigits = String(cpf || "").replace(/\D/g, "");

        const { data: resumoRows, error: resumoErr } = await (supabase.rpc as any)(
          "ponto_espelho_resumo",
          { p_tenant_id: tenantId, p_colaborador_cpf: cpfDigits, p_competencia: competencia }
        );
        if (resumoErr) throw resumoErr;
        const r = (resumoRows || [])[0] || {};

        await fromTable("ponto_espelhos")
          .upsert({
            tenant_id: tenantId,
            empresa_id: empresaAtivaId || null,
            fechamento_id: (fechamento as any).id,
            colaborador_id: primeiro.colaborador_id,
            colaborador_nome: primeiro.colaborador_nome,
            colaborador_cpf: cpf,
            competencia,
            total_horas_normais_minutos: Number(r.total_trabalhado_min) || 0,
            total_trabalhado_minutos: Number(r.total_trabalhado_min) || 0,
            total_jornada_prevista_minutos: Number(r.total_jornada_prevista_min) || 0,
            total_creditos_minutos: Number(r.total_creditos_min) || 0,
            total_debitos_minutos: Number(r.total_debitos_min) || 0,
            banco_horas_saldo_minutos: Number(r.saldo_min) || 0,
            total_faltas: Number(r.total_faltas) || 0,
            total_dias_trabalhados: Number(r.dias_trabalhados) || 0,
            total_dias_protegidos: Number(r.dias_protegidos) || 0,
            total_excedente_retido_minutos: Number(r.excedente_retido_min) || 0,
            dia_equalizacao: r.dia_equalizacao || null,
            status: "gerado",
          } as never, { onConflict: "tenant_id,colaborador_cpf,competencia" });
      }

      return fechamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-fechamentos"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-espelhos"] });
      toast.success("Período fechado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao fechar período: " + e.message),
  });

  const confirmarEspelhoMutation = useMutation({
    mutationFn: async ({ espelhoId, ressalva }: { espelhoId: string; ressalva?: string }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await fromTable("ponto_espelhos")
        .update({
          status: ressalva ? "ressalva" : "confirmado",
          ressalva_texto: ressalva || null,
          data_confirmacao: new Date().toISOString(),
          confirmado_por: user.id,
        } as any)
        .eq("id", espelhoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-espelhos"] });
      toast.success("Espelho confirmado!");
    },
    onError: handleMutationError,
  });

  return {
    useFechamentos,
    useEspelhos,
    fecharPeriodo: fecharPeriodoMutation.mutateAsync,
    fechandoPeriodo: fecharPeriodoMutation.isPending,
    confirmarEspelho: confirmarEspelhoMutation.mutateAsync,
    confirmandoEspelho: confirmarEspelhoMutation.isPending,
  };
}
