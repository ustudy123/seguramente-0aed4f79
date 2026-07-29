/**
 * Financeiro de férias (Fase 2, A-05): provisão, desembolso projetado e passivo
 * em dobro, tudo como ESTIMATIVA parametrizável. Junta os períodos do motor
 * (Fase 1), o salário das admissões e a config de encargos por empresa.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useFeriasPeriodos } from "@/hooks/useFeriasPeriodos";
import {
  provisaoColaborador,
  passivoDobro,
  desembolsoPeriodo,
  fluxoDesembolso12Meses,
  taxaEncargos,
  ENCARGOS_PADRAO,
  type EncargosConfig,
  type ProvisaoColaborador,
  type PassivoDobroItem,
} from "@/lib/feriasFinanceiro";
import { toast } from "sonner";

const EMPTY_SAL = new Map<string, { salario: number; dependentes: number }>();

export function useFeriasFinanceiro() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();
  const { periodos } = useFeriasPeriodos();

  // ── Config de encargos da empresa (fallback: padrão da seção 7.4) ──────────
  const encargosQuery = useQuery({
    queryKey: ["ferias-encargos", tenantId, empresaAtivaId],
    enabled: !!tenantId,
    queryFn: async (): Promise<EncargosConfig & { id?: string }> => {
      let q = fromTable("ferias_config").select("*").eq("tenant_id", tenantId);
      q = empresaAtivaId ? q.eq("empresa_id", empresaAtivaId) : q.is("empresa_id", null);
      const { data } = await q.maybeSingle();
      if (!data) return { ...ENCARGOS_PADRAO };
      return {
        id: data.id,
        inssPatronal: Number(data.encargo_inss_patronal ?? 20),
        ratFap: Number(data.encargo_rat_fap ?? 2),
        terceiros: Number(data.encargo_terceiros ?? 5.8),
        fgts: Number(data.encargo_fgts ?? 8),
        simplesDispensaPatronal: !!data.simples_dispensa_patronal,
      };
    },
  });

  const encargos = encargosQuery.data ?? ENCARGOS_PADRAO;

  // ── Salários das admissões (por CPF) ───────────────────────────────────────
  const salariosQuery = useQuery({
    queryKey: ["ferias-salarios", tenantId, empresaAtivaId],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = fromTable("admissoes")
        .select("cpf, salario_base, dependentes_irrf")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido");
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data } = await q;
      const map = new Map<string, { salario: number; dependentes: number }>();
      for (const a of data ?? []) {
        const cpf = String(a.cpf ?? "").replace(/\D/g, "");
        if (cpf) map.set(cpf, {
          salario: Number(a.salario_base ?? 0),
          dependentes: Number(a.dependentes_irrf ?? 0),
        });
      }
      return map;
    },
  });

  const salarios = salariosQuery.data ?? EMPTY_SAL;

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const resultado = useMemo(() => {
    const provisoes: ProvisaoColaborador[] = [];
    const passivos: PassivoDobroItem[] = [];
    const desembolsos: ReturnType<typeof desembolsoPeriodo>[] = [];

    // Provisão e passivo são por período em aberto (saldo > 0).
    for (const p of periodos) {
      if (p.status === "encerrado") continue;
      const info = salarios.get(p.colaboradorCpf.replace(/\D/g, ""));
      const salario = info?.salario ?? 0;
      if (salario <= 0) continue; // sem salário não há como estimar

      if (p.diasSaldo > 0) {
        provisoes.push(provisaoColaborador({
          cpf: p.colaboradorCpf,
          nome: p.colaboradorNome,
          remuneracaoMensal: salario,
          diasDireitoAcumulados: p.diasSaldo,
          encargos,
        }));

        const dobra = passivoDobro({
          cpf: p.colaboradorCpf,
          nome: p.colaboradorNome,
          remuneracaoMensal: salario,
          aquisitivoFim: p.aquisitivoFim,
          diasSaldo: p.diasSaldo,
          encargos,
        });
        if (dobra) passivos.push(dobra);
      }

      // Desembolso projetado: dias já gozados no período (proxy de caixa).
      // Quando a aba Programação existir (Fase 3), virá dos períodos programados.
      if (p.diasGozados > 0) {
        desembolsos.push(desembolsoPeriodo({
          cpf: p.colaboradorCpf,
          nome: p.colaboradorNome,
          remuneracaoMensal: salario,
          dataInicio: p.aquisitivoInicio,
          dataFim: p.aquisitivoFim,
          diasGozados: p.diasGozados,
          dependentes: info?.dependentes ?? 0,
        }));
      }
    }

    const provisaoTotal = provisoes.reduce((s, p) => s + p.total, 0);
    const passivoDobroTotal = passivos.reduce((s, p) => s + p.valorDobra, 0);
    const fluxo = fluxoDesembolso12Meses(desembolsos);
    const desembolsoTotal = desembolsos.reduce((s, d) => s + d.liquido, 0);

    return {
      provisoes,
      passivos,
      provisaoTotal,
      passivoDobroTotal,
      fluxo,
      desembolsoTotal,
      taxaEncargosPct: taxaEncargos(encargos) * 100,
      semSalario: periodos.filter(
        p => p.status !== "encerrado" &&
          (salarios.get(p.colaboradorCpf.replace(/\D/g, ""))?.salario ?? 0) <= 0,
      ).length,
    };
  }, [periodos, salarios, encargos]);

  // ── Salvar config de encargos ──────────────────────────────────────────────
  const salvarEncargos = useMutation({
    mutationFn: async (novo: EncargosConfig) => {
      const payload = {
        tenant_id: tenantId,
        empresa_id: empresaAtivaId ?? null,
        encargo_inss_patronal: novo.inssPatronal,
        encargo_rat_fap: novo.ratFap,
        encargo_terceiros: novo.terceiros,
        encargo_fgts: novo.fgts,
        simples_dispensa_patronal: novo.simplesDispensaPatronal,
      };
      const { error } = await fromTable("ferias_config").upsert(payload, {
        onConflict: "tenant_id,empresa_id",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ferias-encargos"] });
      toast.success("Parâmetros de encargos salvos.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return {
    ...resultado,
    encargos,
    salvarEncargos,
    isLoading: encargosQuery.isLoading || salariosQuery.isLoading,
  };
}
