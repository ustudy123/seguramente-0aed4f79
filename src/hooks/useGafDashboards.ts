import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export function useGafDashboards(filters: any = {}) {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  // Dashboard de Absenteísmo
  const { data: absenteismoStats, isLoading: loadingAbs } = useQuery({
    queryKey: ["gaf-absenteismo", tenantId, empresaAtivaId, filters],
    queryFn: async () => {
      // Aqui faríamos queries complexas para os indicadores solicitados
      // Por enquanto retornaremos mocks estruturados baseados nas novas tabelas
      return {
        totalAfastamentos: 0,
        totalTrabalhadoresAfastados: 0,
        totalDiasPerdidos: 0,
        taxaAbsenteísmo: "0%",
        afastamentosPorMes: [],
        afastamentosPorSetor: [],
        reincidencia: [],
        custoEstimado: 0
      };
    },
    enabled: !!tenantId
  });

  // Dashboard de Saúde Mental
  const { data: saudeMentalStats, isLoading: loadingMental } = useQuery({
    queryKey: ["gaf-saude-mental", tenantId, empresaAtivaId, filters],
    queryFn: async () => {
      return {
        totalCIDF: 0,
        diasPerdidosMental: 0,
        evolucaoMensal: [],
        setoresConcentracao: [],
        alertasPadraoColetivo: []
      };
    },
    enabled: !!tenantId
  });

  // Dashboard FAP/RAT
  const { data: fapRatStats, isLoading: loadingFap } = useQuery({
    queryKey: ["gaf-fap-rat", tenantId, empresaAtivaId, filters],
    queryFn: async () => {
      return {
        catsEmitidas: 0,
        catsPendentes: 0,
        b91Ativos: 0,
        ntepSuspeitos: 0,
        riscoImpactoFap: 0,
        impactoFapConfirmado: 0
      };
    },
    enabled: !!tenantId
  });

  // Dashboard de Pendências
  const { data: pendenciasStats, isLoading: loadingPend } = useQuery({
    queryKey: ["gaf-pendencias", tenantId, empresaAtivaId, filters],
    queryFn: async () => {
      const { data } = await supabase
        .from("afastamentos_pendencias")
        .select("*")
        .eq("tenant_id", tenantId!);
      
      const total = data?.length || 0;
      const criticas = data?.filter(p => p.prioridade === 'critica').length || 0;
      const porTipo = data?.reduce((acc: any, curr) => {
        acc[curr.tipo_pendencia] = (acc[curr.tipo_pendencia] || 0) + 1;
        return acc;
      }, {});

      return {
        total,
        criticas,
        porTipo,
        data
      };
    },
    enabled: !!tenantId
  });

  return {
    absenteismoStats,
    saudeMentalStats,
    fapRatStats,
    pendenciasStats,
    isLoading: loadingAbs || loadingMental || loadingFap || loadingPend
  };
}
