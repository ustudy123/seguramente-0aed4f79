/**
 * RN17 — excedente diário acima da jornada + 2h suplementares.
 *
 * O que passa do teto (art. 59, caput, CLT) não entra no banco de horas
 * automaticamente: fica retido até o RH decidir. Este hook expõe a fila de
 * pendências da competência e o registro da decisão.
 *
 * Duas saídas, ambas exigindo justificativa:
 *  - 'liberado'       → crédito integral, com data no próprio dia trabalhado;
 *  - 'irregularidade' → não credita; as horas seguem para pagamento e o dia
 *                       fica marcado no relatório de conformidade.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type DecisaoExcedente = "liberado" | "irregularidade";

export interface ExcedentePendente {
  colaborador_cpf: string;
  colaborador_nome: string | null;
  dia: string;
  trabalhado_min: number;
  jornada_min: number;
  excedente_retido_min: number;
  /** Motivo declarado no ajuste de ponto do dia, quando houver. */
  motivo_ajuste: string | null;
  /** Há quantos dias a pendência está sem decisão. */
  dias_parado: number;
}

export function usePontoExcedente(competencia: string) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["ponto-excedente-pendentes", tenantId, competencia];

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey,
    enabled: !!tenantId && !!competencia,
    queryFn: async (): Promise<ExcedentePendente[]> => {
      const { data, error } = await (supabase.rpc as any)("ponto_excedente_pendentes", {
        p_tenant_id: tenantId,
        p_competencia: competencia,
      });
      if (error) throw error;
      return ((data || []) as any[]).map((d) => ({
        colaborador_cpf: String(d.colaborador_cpf || ""),
        colaborador_nome: d.colaborador_nome ?? null,
        dia: String(d.dia),
        trabalhado_min: Number(d.trabalhado_min) || 0,
        jornada_min: Number(d.jornada_min) || 0,
        excedente_retido_min: Number(d.excedente_retido_min) || 0,
        motivo_ajuste: d.motivo_ajuste ?? null,
        dias_parado: Number(d.dias_parado) || 0,
      }));
    },
  });

  const decidir = useMutation({
    mutationFn: async (p: {
      cpf: string;
      dia: string;
      decisao: DecisaoExcedente;
      justificativa: string;
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { error } = await (supabase.rpc as any)("ponto_excedente_decidir", {
        p_tenant_id: tenantId,
        p_colaborador_cpf: p.cpf,
        p_dia: p.dia,
        p_decisao: p.decisao,
        p_justificativa: p.justificativa,
      });
      if (error) throw error;
      return p.decisao;
    },
    onSuccess: (decisao) => {
      queryClient.invalidateQueries({ queryKey });
      // A decisão muda o saldo do dia — recarrega banco e dias.
      queryClient.invalidateQueries({ queryKey: ["banco-horas-dias"] });
      queryClient.invalidateQueries({ queryKey: ["ponto-banco-horas"] });
      toast.success(
        decisao === "liberado"
          ? "Excedente liberado — creditado no dia trabalhado"
          : "Excedente marcado como irregularidade — encaminhado para pagamento",
      );
    },
    onError: (e: Error) => toast.error(`Erro ao registrar decisão: ${e.message}`),
  });

  const totalRetidoMin = pendentes.reduce((acc, p) => acc + p.excedente_retido_min, 0);

  return { pendentes, isLoading, decidir, totalRetidoMin };
}
