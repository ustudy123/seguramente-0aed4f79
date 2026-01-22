import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

// Tipos
export interface PontoMarcacao {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  data_marcacao: string;
  hora_marcacao: string;
  tipo_marcacao: "entrada" | "saida_almoco" | "retorno_almoco" | "saida";
  ip_origem: string | null;
  user_agent: string | null;
  latitude: number | null;
  longitude: number | null;
  dispositivo: string | null;
  hash_marcacao: string;
  marcacao_original: boolean;
  created_at: string;
  created_by: string | null;
}

export interface PontoDiario {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  data: string;
  entrada: string | null;
  saida_almoco: string | null;
  retorno_almoco: string | null;
  saida: string | null;
  horas_trabalhadas: string | null;
  horas_extras: string | null;
  horas_faltantes: string | null;
  status: "pendente" | "regular" | "atraso" | "falta" | "incompleto" | "ajuste_pendente" | "justificado";
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface PontoAjuste {
  id: string;
  tenant_id: string;
  ponto_diario_id: string | null;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cpf: string;
  data_referencia: string;
  tipo_ajuste: "inclusao" | "correcao" | "justificativa" | "abono";
  tipo_marcacao: "entrada" | "saida_almoco" | "retorno_almoco" | "saida" | null;
  hora_original: string | null;
  hora_solicitada: string | null;
  motivo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  aprovado_por: string | null;
  aprovado_por_nome: string | null;
  data_aprovacao: string | null;
  observacao_aprovador: string | null;
  created_at: string;
  created_by: string | null;
  created_by_nome: string | null;
}

export interface PontoAuditLog {
  id: string;
  tenant_id: string;
  tabela_origem: string;
  registro_id: string;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  ip_origem: string | null;
  user_agent: string | null;
  created_at: string;
}

export const TIPO_MARCACAO_LABELS: Record<string, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída Almoço",
  retorno_almoco: "Retorno Almoço",
  saida: "Saída",
};

export const STATUS_PONTO_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-gray-100 text-gray-800" },
  regular: { label: "Regular", color: "bg-green-100 text-green-800" },
  atraso: { label: "Atraso", color: "bg-yellow-100 text-yellow-800" },
  falta: { label: "Falta", color: "bg-red-100 text-red-800" },
  incompleto: { label: "Incompleto", color: "bg-orange-100 text-orange-800" },
  ajuste_pendente: { label: "Ajuste Pendente", color: "bg-blue-100 text-blue-800" },
  justificado: { label: "Justificado", color: "bg-purple-100 text-purple-800" },
};

export function usePonto() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Buscar ponto diário por data
  const usePontoDiario = (data: Date) => {
    const dataStr = format(data, "yyyy-MM-dd");
    return useQuery({
      queryKey: ["ponto-diario", tenantId, dataStr],
      queryFn: async (): Promise<PontoDiario[]> => {
        if (!tenantId) return [];
        
        const { data: pontos, error } = await supabase
          .from("ponto_diario" as never)
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("data", dataStr)
          .order("colaborador_nome") as { data: PontoDiario[] | null; error: Error | null };
        
        if (error) throw error;
        return pontos || [];
      },
      enabled: !!tenantId,
    });
  };

  // Buscar marcações do colaborador hoje
  const useMarcacoesHoje = () => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    return useQuery({
      queryKey: ["ponto-marcacoes-hoje", tenantId, hoje],
      queryFn: async (): Promise<PontoMarcacao[]> => {
        if (!tenantId) return [];
        
        const { data, error } = await supabase
          .from("ponto_marcacoes" as never)
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("data_marcacao", hoje)
          .order("hora_marcacao") as { data: PontoMarcacao[] | null; error: Error | null };
        
        if (error) throw error;
        return data || [];
      },
      enabled: !!tenantId,
      refetchInterval: 30000,
    });
  };

  // Buscar ajustes pendentes
  const useAjustesPendentes = () => {
    return useQuery({
      queryKey: ["ponto-ajustes-pendentes", tenantId],
      queryFn: async (): Promise<PontoAjuste[]> => {
        if (!tenantId) return [];
        
        const { data, error } = await supabase
          .from("ponto_ajustes" as never)
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .order("created_at", { ascending: false }) as { data: PontoAjuste[] | null; error: Error | null };
        
        if (error) throw error;
        return data || [];
      },
      enabled: !!tenantId,
    });
  };

  // Buscar audit log
  const useAuditLog = (limite = 100) => {
    return useQuery({
      queryKey: ["ponto-audit-log", tenantId, limite],
      queryFn: async (): Promise<PontoAuditLog[]> => {
        if (!tenantId) return [];
        
        const { data, error } = await supabase
          .from("ponto_audit_log" as never)
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limite) as { data: PontoAuditLog[] | null; error: Error | null };
        
        if (error) throw error;
        return data || [];
      },
      enabled: !!tenantId,
    });
  };

  // Registrar marcação de ponto
  const registrarPontoMutation = useMutation({
    mutationFn: async ({
      colaboradorId,
      colaboradorNome,
      colaboradorCpf,
      tipoMarcacao,
      latitude,
      longitude,
    }: {
      colaboradorId: string;
      colaboradorNome: string;
      colaboradorCpf: string;
      tipoMarcacao: "entrada" | "saida_almoco" | "retorno_almoco" | "saida";
      latitude?: number;
      longitude?: number;
    }) => {
      if (!tenantId || !user) throw new Error("Usuário não autenticado");

      const agora = new Date();
      const userAgent = navigator.userAgent;
      const dispositivo = /Mobile|Android|iPhone/i.test(userAgent) ? "Mobile" : "Desktop";

      const { data, error } = await supabase
        .from("ponto_marcacoes" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          colaborador_nome: colaboradorNome,
          colaborador_cpf: colaboradorCpf,
          data_marcacao: format(agora, "yyyy-MM-dd"),
          hora_marcacao: format(agora, "HH:mm:ss"),
          tipo_marcacao: tipoMarcacao,
          user_agent: userAgent,
          dispositivo,
          latitude,
          longitude,
          created_by: user.id,
          hash_marcacao: "placeholder",
        } as never)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error(`Já existe uma marcação de ${TIPO_MARCACAO_LABELS[tipoMarcacao]} para hoje.`);
        }
        throw error;
      }
      return data as PontoMarcacao;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ponto-marcacoes-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-diario"] });
      toast.success(`${TIPO_MARCACAO_LABELS[variables.tipoMarcacao]} registrada com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Solicitar ajuste
  const solicitarAjusteMutation = useMutation({
    mutationFn: async ({
      colaboradorId,
      colaboradorNome,
      colaboradorCpf,
      dataReferencia,
      tipoAjuste,
      tipoMarcacao,
      horaOriginal,
      horaSolicitada,
      motivo,
    }: {
      colaboradorId: string;
      colaboradorNome: string;
      colaboradorCpf: string;
      dataReferencia: string;
      tipoAjuste: "inclusao" | "correcao" | "justificativa" | "abono";
      tipoMarcacao?: "entrada" | "saida_almoco" | "retorno_almoco" | "saida";
      horaOriginal?: string;
      horaSolicitada?: string;
      motivo: string;
    }) => {
      if (!tenantId || !user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("ponto_ajustes" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          colaborador_nome: colaboradorNome,
          colaborador_cpf: colaboradorCpf,
          data_referencia: dataReferencia,
          tipo_ajuste: tipoAjuste,
          tipo_marcacao: tipoMarcacao,
          hora_original: horaOriginal,
          hora_solicitada: horaSolicitada,
          motivo,
          created_by: user.id,
          created_by_nome: profile?.nome_completo,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data as PontoAjuste;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-ajustes"] });
      toast.success("Solicitação de ajuste enviada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao solicitar ajuste: " + error.message);
    },
  });

  // Aprovar/Rejeitar ajuste
  const processarAjusteMutation = useMutation({
    mutationFn: async ({
      ajusteId,
      aprovado,
      observacao,
    }: {
      ajusteId: string;
      aprovado: boolean;
      observacao?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("ponto_ajustes" as never)
        .update({
          status: aprovado ? "aprovado" : "rejeitado",
          aprovado_por: user.id,
          aprovado_por_nome: profile?.nome_completo,
          data_aprovacao: new Date().toISOString(),
          observacao_aprovador: observacao,
        } as never)
        .eq("id", ajusteId)
        .select()
        .single();

      if (error) throw error;
      
      const ajuste = data as PontoAjuste;

      // Se aprovado e for inclusão/correção, criar nova marcação
      if (aprovado && ajuste.tipo_ajuste !== "justificativa" && ajuste.tipo_ajuste !== "abono" && ajuste.tipo_marcacao && ajuste.hora_solicitada) {
        await supabase.from("ponto_marcacoes" as never).insert({
          tenant_id: tenantId,
          colaborador_id: ajuste.colaborador_id,
          colaborador_nome: ajuste.colaborador_nome,
          colaborador_cpf: ajuste.colaborador_cpf,
          data_marcacao: ajuste.data_referencia,
          hora_marcacao: ajuste.hora_solicitada,
          tipo_marcacao: ajuste.tipo_marcacao,
          marcacao_original: false,
          created_by: user.id,
          hash_marcacao: "placeholder",
        } as never);
      }

      return ajuste;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ponto-ajustes"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-diario"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-marcacoes"] });
      toast.success(`Ajuste ${variables.aprovado ? "aprovado" : "rejeitado"} com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error("Erro ao processar ajuste: " + error.message);
    },
  });

  return {
    // Hooks de query
    usePontoDiario,
    useMarcacoesHoje,
    useAjustesPendentes,
    useAuditLog,

    // Mutations
    registrarPonto: registrarPontoMutation.mutateAsync,
    registrandoPonto: registrarPontoMutation.isPending,
    
    solicitarAjuste: solicitarAjusteMutation.mutateAsync,
    solicitandoAjuste: solicitarAjusteMutation.isPending,
    
    processarAjuste: processarAjusteMutation.mutateAsync,
    processandoAjuste: processarAjusteMutation.isPending,
  };
}
