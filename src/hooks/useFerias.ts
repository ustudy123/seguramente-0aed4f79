import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface FeriasSolicitacao {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  departamento: string | null;
  cargo: string | null;
  data_inicio: string;
  data_fim: string;
  dias_solicitados: number;
  saldo_dias: number;
  status: "pendente" | "aprovado" | "recusado" | "cancelado" | "em_gozo" | "concluido";
  abono_pecuniario: boolean;
  dias_abono: number;
  salario_base: number;
  periodo_aquisitivo_inicio: string | null;
  periodo_aquisitivo_fim: string | null;
  aprovado_por: string | null;
  aprovado_por_nome: string | null;
  data_aprovacao: string | null;
  motivo_recusa: string | null;
  valor_ferias: number | null;
  valor_terco: number | null;
  valor_abono: number | null;
  valor_total_bruto: number | null;
  registro_financeiro_id: string | null;
  aviso_gerado: boolean;
  recibo_gerado: boolean;
  assinatura_link_id: string | null;
  assinatura_status: string | null;
  inr_score_momento: number | null;
  inr_nivel_momento: string | null;
  acao_preventiva: boolean;
  acao_preventiva_id: string | null;
  mensagem_pre_ferias: string | null;
  mensagem_pre_ferias_enviada: boolean;
  checkin_retorno_enviado: boolean;
  checkin_retorno_respondido: boolean;
  checkin_retorno_respostas: any;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeriasHistorico {
  id: string;
  solicitacao_id: string;
  acao: string;
  descricao: string | null;
  usuario_nome: string | null;
  created_at: string;
}

export interface CriarFeriasInput {
  colaborador_nome: string;
  colaborador_cpf?: string | null;
  colaborador_id?: string | null;
  departamento?: string;
  cargo?: string;
  data_inicio: string;
  data_fim: string;
  dias_solicitados: number;
  abono_pecuniario?: boolean;
  dias_abono?: number;
  salario_base?: number;
  periodo_aquisitivo_inicio?: string;
  periodo_aquisitivo_fim?: string;
  inr_score_momento?: number;
  inr_nivel_momento?: string;
  acao_preventiva?: boolean;
  observacoes?: string;
}

export function useFerias() {
  const { tenantId, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["ferias_solicitacoes", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("ferias_solicitacoes" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FeriasSolicitacao[];
    },
    enabled: !!tenantId,
  });

  const criarSolicitacao = useMutation({
    mutationFn: async (input: CriarFeriasInput) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const salarioBase = input.salario_base || 0;
      const salarioDia = salarioBase / 30;
      const valorFerias = salarioDia * input.dias_solicitados;
      const valorTerco = valorFerias / 3;
      const valorAbono = input.abono_pecuniario ? salarioDia * (input.dias_abono || 0) : 0;

      const { data, error } = await supabase
        .from("ferias_solicitacoes" as any)
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          colaborador_nome: input.colaborador_nome,
          colaborador_cpf: input.colaborador_cpf || null,
          colaborador_id: input.colaborador_id || null,
          departamento: input.departamento || null,
          cargo: input.cargo || null,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim,
          dias_solicitados: input.dias_solicitados,
          abono_pecuniario: input.abono_pecuniario || false,
          dias_abono: input.dias_abono || 0,
          salario_base: salarioBase,
          periodo_aquisitivo_inicio: input.periodo_aquisitivo_inicio || null,
          periodo_aquisitivo_fim: input.periodo_aquisitivo_fim || null,
          valor_ferias: valorFerias,
          valor_terco: valorTerco,
          valor_abono: valorAbono,
          valor_total_bruto: valorFerias + valorTerco + valorAbono,
          inr_score_momento: input.inr_score_momento || null,
          inr_nivel_momento: input.inr_nivel_momento || null,
          acao_preventiva: input.acao_preventiva || false,
          observacoes: input.observacoes || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias_solicitacoes"] });
      toast.success("Solicitação de férias criada com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar solicitação"),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase
        .from("ferias_solicitacoes" as any)
        .update({
          status: "aprovado",
          aprovado_por_nome: profile?.nome_completo || "Gestor",
          data_aprovacao: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias_solicitacoes"] });
      toast.success("Férias aprovadas!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const recusar = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { error } = await supabase
        .from("ferias_solicitacoes" as any)
        .update({ status: "recusado", motivo_recusa: motivo || null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ferias_solicitacoes"] });
      toast.error("Férias recusadas.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const atualizarCampo = useMutation({
    mutationFn: async ({ id, campo, valor }: { id: string; campo: string; valor: any }) => {
      const { error } = await supabase
        .from("ferias_solicitacoes" as any)
        .update({ [campo]: valor } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ferias_solicitacoes"] }),
  });

  // Buscar histórico de uma solicitação
  const useHistorico = (solicitacaoId: string | null) =>
    useQuery({
      queryKey: ["ferias_historico", solicitacaoId],
      queryFn: async () => {
        if (!solicitacaoId) return [];
        const { data, error } = await supabase
          .from("ferias_historico" as any)
          .select("*")
          .eq("solicitacao_id", solicitacaoId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []) as unknown as FeriasHistorico[];
      },
      enabled: !!solicitacaoId,
    });

  // Stats computed
  const stats = {
    pendentes: solicitacoes.filter((s) => s.status === "pendente").length,
    aprovados: solicitacoes.filter((s) => s.status === "aprovado").length,
    emGozo: solicitacoes.filter((s) => s.status === "em_gozo").length,
    concluidos: solicitacoes.filter((s) => s.status === "concluido").length,
    comAbono: solicitacoes.filter((s) => s.abono_pecuniario).length,
    totalDiasConcedidos: solicitacoes
      .filter((s) => ["aprovado", "em_gozo", "concluido"].includes(s.status))
      .reduce((sum, s) => sum + s.dias_solicitados, 0),
    custoTotal: solicitacoes
      .filter((s) => ["aprovado", "em_gozo", "concluido"].includes(s.status))
      .reduce((sum, s) => sum + (s.valor_total_bruto || 0), 0),
    acoesPreventivas: solicitacoes.filter((s) => s.acao_preventiva).length,
  };

  return {
    solicitacoes,
    isLoading,
    criarSolicitacao,
    aprovar,
    recusar,
    atualizarCampo,
    useHistorico,
    stats,
  };
}
