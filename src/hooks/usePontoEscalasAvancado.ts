import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface PadraoEscala {
  id: string;
  tenant_id: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  estrutura: any;
  exemplo_descricao: string | null;
  ativo: boolean;
}

export interface EscalaPeriodo {
  id?: string;
  escala_id?: string;
  dia_semana: string;
  ordem_bloco: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface EscalaRecorrencia {
  id?: string;
  escala_id?: string;
  descricao: string | null;
  ordinal_mes: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fim: string;
  observacao?: string | null;
}

interface SalvarEstruturaArgs {
  escalaId: string;
  periodos: Omit<EscalaPeriodo, "escala_id" | "id">[];
  recorrencias: Omit<EscalaRecorrencia, "escala_id" | "id">[];
  historico: {
    entrada_original: string;
    origem_input: "texto" | "audio";
    transcricao_audio?: string | null;
    saida_ia: any;
    nivel_confianca?: string;
    descricao_contratual?: string;
    alertas?: any;
  };
}

export function usePontoEscalasAvancado() {
  const { tenantId, user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const padroesQuery = useQuery({
    queryKey: ["ponto-escala-padroes", tenantId],
    queryFn: async (): Promise<PadraoEscala[]> => {
      const { data, error } = await fromTable("ponto_escala_padroes")
        .select("*")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data || []) as PadraoEscala[];
    },
    enabled: !!tenantId,
  });

  const salvarEstruturaCompleta = useMutation({
    mutationFn: async (args: SalvarEstruturaArgs) => {
      if (!tenantId) throw new Error("Não autenticado");

      // 1. Inserir períodos
      if (args.periodos.length > 0) {
        const periodosPayload = args.periodos.map((p) => ({
          ...p,
          escala_id: args.escalaId,
          tenant_id: tenantId,
        }));
        const { error: pErr } = await fromTable("ponto_escala_periodos").insert(periodosPayload as any);
        if (pErr) console.error("Erro ao salvar períodos:", pErr);
      }

      // 2. Inserir recorrências
      if (args.recorrencias.length > 0) {
        const recPayload = args.recorrencias.map((r) => ({
          ...r,
          escala_id: args.escalaId,
          tenant_id: tenantId,
        }));
        const { error: rErr } = await fromTable("ponto_escala_recorrencias").insert(recPayload as any);
        if (rErr) console.error("Erro ao salvar recorrências:", rErr);
      }

      // 3. Inserir histórico de interpretação
      const { error: hErr } = await fromTable("ponto_escala_historico_interpretacao").insert({
        tenant_id: tenantId,
        escala_id: args.escalaId,
        entrada_original: args.historico.entrada_original,
        origem_input: args.historico.origem_input,
        transcricao_audio: args.historico.transcricao_audio || null,
        saida_ia: args.historico.saida_ia,
        nivel_confianca: args.historico.nivel_confianca || null,
        descricao_contratual: args.historico.descricao_contratual || null,
        alertas: args.historico.alertas || null,
        user_id: user?.id || null,
      } as any);
      if (hErr) console.error("Erro ao salvar histórico:", hErr);

      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-escalas"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-escala-periodos"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-escala-recorrencias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    padroes: padroesQuery.data || [],
    loadingPadroes: padroesQuery.isLoading,
    salvarEstruturaCompleta: salvarEstruturaCompleta.mutateAsync,
    salvandoEstrutura: salvarEstruturaCompleta.isPending,
  };
}
