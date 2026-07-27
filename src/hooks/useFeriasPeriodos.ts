/**
 * Saldos de férias vindos do motor real (ferias_periodos_aquisitivos), no lugar
 * do "30 fixo" que a tela usava. Também expõe a fila de períodos pendentes de
 * validação (zeragem por excesso de faltas do art. 130) e as ações de resolvê-la.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface PeriodoAquisitivo {
  id: string;
  colaboradorCpf: string;
  colaboradorNome: string;
  colaboradorId: string | null;
  dataAdmissao: string;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  faltasCarga: number;
  faltasConsideradas: number;
  fonteFaltas: "carga" | "ponto";
  diasDireito: number;
  diasGozados: number;
  diasSaldo: number;
  status: "ativo" | "pendente_validacao" | "zerado_confirmado" | "encerrado";
  validacaoMotivo: string | null;
}

/** Saldo consolidado de um colaborador (soma dos períodos não encerrados). */
export interface SaldoColaborador {
  cpf: string;
  nome: string;
  colaboradorId: string | null;
  diasDireitoTotal: number;
  diasGozadosTotal: number;
  diasSaldoTotal: number;
  periodosAbertos: number;
  temPendencia: boolean;
  /** Período aquisitivo em curso (o mais recente). */
  periodoAtual?: PeriodoAquisitivo;
}

function mapRow(r: Record<string, unknown>): PeriodoAquisitivo {
  return {
    id: String(r.id),
    colaboradorCpf: String(r.colaborador_cpf ?? ""),
    colaboradorNome: String(r.colaborador_nome ?? ""),
    colaboradorId: (r.colaborador_id as string) ?? null,
    dataAdmissao: String(r.data_admissao ?? ""),
    aquisitivoInicio: String(r.aquisitivo_inicio ?? ""),
    aquisitivoFim: String(r.aquisitivo_fim ?? ""),
    faltasCarga: Number(r.faltas_carga ?? 0),
    faltasConsideradas: Number(r.faltas_consideradas ?? 0),
    fonteFaltas: (r.fonte_faltas as "carga" | "ponto") ?? "carga",
    diasDireito: Number(r.dias_direito ?? 0),
    diasGozados: Number(r.dias_gozados ?? 0),
    diasSaldo: Number(r.dias_saldo ?? 0),
    status: (r.status as PeriodoAquisitivo["status"]) ?? "ativo",
    validacaoMotivo: (r.validacao_motivo as string) ?? null,
  };
}

export function useFeriasPeriodos() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const { user } = useAuth();
  const qc = useQueryClient();

  const periodosQuery = useQuery({
    queryKey: ["ferias-periodos", tenantId, empresaAtivaId],
    enabled: !!tenantId,
    queryFn: async (): Promise<PeriodoAquisitivo[]> => {
      let q = fromTable("ferias_periodos_aquisitivos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("colaborador_nome", { ascending: true })
        .order("aquisitivo_inicio", { ascending: true });
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });

  const periodos = periodosQuery.data ?? [];

  // Saldo consolidado por colaborador (chave: CPF)
  const saldosPorCpf = new Map<string, SaldoColaborador>();
  for (const p of periodos) {
    if (p.status === "encerrado") continue;
    const atual = saldosPorCpf.get(p.colaboradorCpf);
    if (!atual) {
      saldosPorCpf.set(p.colaboradorCpf, {
        cpf: p.colaboradorCpf,
        nome: p.colaboradorNome,
        colaboradorId: p.colaboradorId,
        diasDireitoTotal: p.diasDireito,
        diasGozadosTotal: p.diasGozados,
        diasSaldoTotal: p.diasSaldo,
        periodosAbertos: 1,
        temPendencia: p.status === "pendente_validacao",
        periodoAtual: p,
      });
    } else {
      atual.diasDireitoTotal += p.diasDireito;
      atual.diasGozadosTotal += p.diasGozados;
      atual.diasSaldoTotal += p.diasSaldo;
      atual.periodosAbertos += 1;
      atual.temPendencia = atual.temPendencia || p.status === "pendente_validacao";
      // "periodoAtual" = o mais recente (a lista vem ordenada asc)
      atual.periodoAtual = p;
    }
  }

  const pendentesValidacao = periodos.filter(p => p.status === "pendente_validacao");

  // Resolver a fila de zeragem: confirmar (mantém 0) ou contestar (reverte a ativo)
  const resolverValidacao = useMutation({
    mutationFn: async ({
      periodoId,
      acao,
    }: {
      periodoId: string;
      acao: "confirmar" | "contestar";
    }) => {
      if (acao === "confirmar") {
        const { error } = await fromTable("ferias_periodos_aquisitivos")
          .update({
            status: "zerado_confirmado",
            validado_por: user?.id ?? null,
            validado_em: new Date().toISOString(),
          })
          .eq("id", periodoId);
        if (error) throw error;
      } else {
        // Contestar: RH assume que as faltas não procedem. Zera as faltas de
        // carga e recalcula — o período volta a 'ativo' com o direito integral.
        const { error } = await fromTable("ferias_periodos_aquisitivos")
          .update({
            faltas_carga: 0,
            status: "ativo",
            validacao_motivo: null,
            validado_por: user?.id ?? null,
            validado_em: new Date().toISOString(),
          })
          .eq("id", periodoId);
        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.rpc as any)("ferias_recalcular_periodo", { p_periodo_id: periodoId });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ferias-periodos"] });
      toast.success(
        vars.acao === "confirmar"
          ? "Período confirmado sem direito a férias."
          : "Faltas desconsideradas — direito recalculado.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao resolver validação"),
  });

  return {
    periodos,
    saldosPorCpf,
    pendentesValidacao,
    isLoading: periodosQuery.isLoading,
    temDadosImportados: periodos.length > 0,
    resolverValidacao,
  };
}
