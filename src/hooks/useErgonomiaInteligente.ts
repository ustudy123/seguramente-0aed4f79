import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { subDays, format } from "date-fns";

export interface RadarData {
  burnout: {
    score: number;
    nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
    fatores: {
      sobrecargaCognitiva: number;
      ritmoTrabalho: number;
      faltaPausas: number;
      humorNegativo: number;
      denuncias: number;
      exigenciasEmocionais: number;
    };
  };
  boreout: {
    score: number;
    nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
    fatores: {
      baixoDesafio: number;
      repetitividade: number;
      faltaSentido: number;
      apatia: number;
      desconexao: number;
    };
  };
  energiaOrganizacional: {
    score: number;
    nivel: 'baixo' | 'moderado' | 'alto' | 'excelente';
    fatores: {
      vitalidade: number;
      engajamento: number;
      presencaPsicologica: number;
      sustentabilidade: number;
    };
  };
}

export interface DadosCognitivos {
  humorUltimos7Dias: {
    positivo: number;
    neutro: number;
    negativo: number;
    total: number;
  };
  denunciasAbertas: number;
  denunciasUltimos30Dias: number;
  riscosAtivos: {
    fisico: number;
    cognitivo: number;
    organizacional: number;
  };
  acoesStatus: {
    pendentes: number;
    emAndamento: number;
    concluidas: number;
  };
  jornadaExcessiva: {
    alertasExcesso: number;
    alertasIntervalo: number;
    alertasInterjornada: number;
    horasExtrasMediaMin: number;
  };
}

export function useErgonomiaInteligente() {
  const { tenantId } = useTenant();
  
  const { data: dadosCognitivos, isLoading: isLoadingCognitivos } = useQuery({
    queryKey: ["ergonomia-dados-cognitivos", tenantId],
    queryFn: async (): Promise<DadosCognitivos> => {
      if (!tenantId) {
        return getDefaultDadosCognitivos();
      }

      const hoje = new Date();
      const seteDiasAtras = format(subDays(hoje, 7), 'yyyy-MM-dd');
      const trintaDiasAtras = format(subDays(hoje, 30), 'yyyy-MM-dd');

      // Buscar humor dos últimos 7 dias
      const { data: humorData } = await supabase
        .from("humor_diario")
        .select("humor")
        .eq("tenant_id", tenantId)
        .gte("data", seteDiasAtras);

      const humorPositivo = humorData?.filter(h => 
        ['Bem', 'Animado', 'Motivado'].includes(h.humor)
      ).length || 0;
      const humorNeutro = humorData?.filter(h => 
        ['Neutro'].includes(h.humor)
      ).length || 0;
      const humorNegativo = humorData?.filter(h => 
        ['Cansado', 'Estressado', 'Ansioso', 'Desanimado'].includes(h.humor)
      ).length || 0;

      // Buscar denúncias
      const { data: denunciasAbertasData, count: denunciasAbertasCount } = await supabase
        .from("ouvidoria")
        .select("id", { count: 'exact' })
        .eq("tenant_id", tenantId)
        .in("status", ["pendente", "em_analise"]);

      const { data: denuncias30Data, count: denuncias30Count } = await supabase
        .from("ouvidoria")
        .select("id", { count: 'exact' })
        .eq("tenant_id", tenantId)
        .gte("created_at", trintaDiasAtras);

      // Buscar riscos ativos por eixo
      const { data: riscosData } = await supabase
        .from("ergonomia_riscos")
        .select("eixo")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);

      const riscosFisico = riscosData?.filter(r => r.eixo === 'fisico').length || 0;
      const riscosCognitivo = riscosData?.filter(r => r.eixo === 'cognitivo').length || 0;
      const riscosOrganizacional = riscosData?.filter(r => r.eixo === 'organizacional').length || 0;

      // Buscar ações
      const { data: acoesData } = await supabase
        .from("ergonomia_acoes")
        .select("status")
        .eq("tenant_id", tenantId);

      const acoesPendentes = acoesData?.filter(a => a.status === 'pendente').length || 0;
      const acoesEmAndamento = acoesData?.filter(a => a.status === 'em_andamento').length || 0;
      const acoesConcluidas = acoesData?.filter(a => a.status === 'concluida').length || 0;

      // Buscar alertas de ponto (jornada excessiva) dos últimos 30 dias
      const { data: alertasPonto } = await supabase
        .from("ponto_alertas" as never)
        .select("tipo, severidade")
        .eq("tenant_id", tenantId)
        .gte("created_at", trintaDiasAtras) as { data: any[] | null };

      const alertasExcesso = (alertasPonto || []).filter((a: any) => a.tipo === 'excesso_jornada').length;
      const alertasIntervalo = (alertasPonto || []).filter((a: any) => a.tipo === 'intervalo_suprimido').length;
      const alertasInterjornada = (alertasPonto || []).filter((a: any) => a.tipo === 'interjornada_insuficiente').length;

      // Buscar média de HE dos últimos 30 dias
      const { data: pontoDiarioData } = await supabase
        .from("ponto_diario" as never)
        .select("horas_extras_50_minutos, horas_extras_100_minutos")
        .eq("tenant_id", tenantId)
        .gte("data", trintaDiasAtras) as { data: any[] | null };

      const totalHE = (pontoDiarioData || []).reduce((sum: number, p: any) =>
        sum + (p.horas_extras_50_minutos || 0) + (p.horas_extras_100_minutos || 0), 0);
      const mediaHE = pontoDiarioData && pontoDiarioData.length > 0 ? totalHE / pontoDiarioData.length : 0;

      return {
        humorUltimos7Dias: {
          positivo: humorPositivo,
          neutro: humorNeutro,
          negativo: humorNegativo,
          total: (humorData?.length || 0),
        },
        denunciasAbertas: denunciasAbertasCount || 0,
        denunciasUltimos30Dias: denuncias30Count || 0,
        riscosAtivos: {
          fisico: riscosFisico,
          cognitivo: riscosCognitivo,
          organizacional: riscosOrganizacional,
        },
        acoesStatus: {
          pendentes: acoesPendentes,
          emAndamento: acoesEmAndamento,
          concluidas: acoesConcluidas,
        },
        jornadaExcessiva: {
          alertasExcesso,
          alertasIntervalo,
          alertasInterjornada,
          horasExtrasMediaMin: Math.round(mediaHE),
        },
      };
    },
    enabled: !!tenantId,
  });

  // Calcular Radares baseado nos dados
  const calcularRadares = (dados: DadosCognitivos): RadarData => {
    const totalHumor = dados.humorUltimos7Dias.total || 1;
    const percNegativo = (dados.humorUltimos7Dias.negativo / totalHumor) * 100;
    const percPositivo = (dados.humorUltimos7Dias.positivo / totalHumor) * 100;
    
    const totalRiscos = dados.riscosAtivos.fisico + dados.riscosAtivos.cognitivo + dados.riscosAtivos.organizacional;
    const totalAcoes = dados.acoesStatus.pendentes + dados.acoesStatus.emAndamento + dados.acoesStatus.concluidas;

    // BURNOUT: Alta sobrecarga + humor negativo + denúncias + jornada excessiva
    const jornadaFator = Math.min(100, dados.jornadaExcessiva.alertasExcesso * 20 + dados.jornadaExcessiva.horasExtrasMediaMin * 2);
    const intervaloFator = Math.min(100, (dados.jornadaExcessiva.alertasIntervalo + dados.jornadaExcessiva.alertasInterjornada) * 15);
    const fatoresBurnout = {
      sobrecargaCognitiva: Math.min(100, dados.riscosAtivos.cognitivo * 20 + jornadaFator * 0.3),
      ritmoTrabalho: Math.min(100, dados.riscosAtivos.organizacional * 15 + jornadaFator * 0.5),
      faltaPausas: Math.min(100, dados.acoesStatus.pendentes * 10 + intervaloFator * 0.6),
      humorNegativo: percNegativo,
      denuncias: Math.min(100, dados.denunciasAbertas * 25),
      exigenciasEmocionais: Math.min(100, (percNegativo + dados.riscosAtivos.cognitivo * 10 + jornadaFator * 0.2) / 2),
    };
    const scoreBurnout = Math.round(
      Object.values(fatoresBurnout).reduce((a, b) => a + b, 0) / 6
    );

    // BOREOUT: Subcarga + apatia + falta de desafio (inversamente correlacionado com HE)
    const baixaAtividade = Math.max(0, 100 - jornadaFator); // Pouca HE pode indicar baixa atividade
    const fatoresBoreout = {
      baixoDesafio: Math.max(0, 100 - totalRiscos * 10 - totalAcoes * 5 + baixaAtividade * 0.2),
      repetitividade: Math.max(0, 50 - dados.riscosAtivos.cognitivo * 10 + baixaAtividade * 0.1),
      faltaSentido: Math.max(0, percNegativo / 2),
      apatia: Math.max(0, dados.humorUltimos7Dias.neutro / totalHumor * 100),
      desconexao: Math.max(0, 100 - percPositivo),
    };
    const scoreBoreout = Math.round(
      Object.values(fatoresBoreout).reduce((a, b) => a + b, 0) / 5
    );

    // ENERGIA ORGANIZACIONAL: Positivo + engajamento + ações concluídas
    const percConcluidas = totalAcoes > 0 ? (dados.acoesStatus.concluidas / totalAcoes) * 100 : 50;
    const fatoresEnergia = {
      vitalidade: percPositivo,
      engajamento: Math.min(100, percConcluidas + (100 - percNegativo) / 2),
      presencaPsicologica: Math.max(0, 100 - percNegativo - dados.denunciasAbertas * 10),
      sustentabilidade: Math.max(0, 100 - scoreBurnout),
    };
    const scoreEnergia = Math.round(
      Object.values(fatoresEnergia).reduce((a, b) => a + b, 0) / 4
    );

    return {
      burnout: {
        score: scoreBurnout,
        nivel: scoreBurnout >= 70 ? 'critico' : scoreBurnout >= 50 ? 'alto' : scoreBurnout >= 30 ? 'moderado' : 'baixo',
        fatores: fatoresBurnout,
      },
      boreout: {
        score: scoreBoreout,
        nivel: scoreBoreout >= 70 ? 'critico' : scoreBoreout >= 50 ? 'alto' : scoreBoreout >= 30 ? 'moderado' : 'baixo',
        fatores: fatoresBoreout,
      },
      energiaOrganizacional: {
        score: scoreEnergia,
        nivel: scoreEnergia >= 70 ? 'excelente' : scoreEnergia >= 50 ? 'alto' : scoreEnergia >= 30 ? 'moderado' : 'baixo',
        fatores: fatoresEnergia,
      },
    };
  };

  const radares = dadosCognitivos ? calcularRadares(dadosCognitivos) : null;

  return {
    dadosCognitivos: dadosCognitivos || getDefaultDadosCognitivos(),
    radares,
    isLoading: isLoadingCognitivos,
  };
}

function getDefaultDadosCognitivos(): DadosCognitivos {
  return {
    humorUltimos7Dias: { positivo: 0, neutro: 0, negativo: 0, total: 0 },
    denunciasAbertas: 0,
    denunciasUltimos30Dias: 0,
    riscosAtivos: { fisico: 0, cognitivo: 0, organizacional: 0 },
    acoesStatus: { pendentes: 0, emAndamento: 0, concluidas: 0 },
    jornadaExcessiva: { alertasExcesso: 0, alertasIntervalo: 0, alertasInterjornada: 0, horasExtrasMediaMin: 0 },
  };
}
