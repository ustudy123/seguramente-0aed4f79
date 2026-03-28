/**
 * RN-016 — Índice de Confiabilidade Psicossocial
 *
 * Cruza resultados psicossociais com dados organizacionais reais para
 * validar se os indicadores psicossociais refletem a realidade operacional.
 *
 * Fontes cruzadas:
 * 1. Absenteísmo (atestados nos últimos 90 dias)
 * 2. Acidentes/CAT (desvios de segurança)
 * 3. Turnover (desligamentos recentes)
 * 4. Humor diário (tendências de humor)
 * 5. Denúncias (ouvidoria)
 * 6. Afastamentos (> 15 dias)
 *
 * Score final: 0-100 (quanto maior, mais confiável o diagnóstico psicossocial)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface FonteConfiabilidade {
  fonte: string;
  descricao: string;
  score: number; // 0-100
  totalRegistros: number;
  convergencia: "convergente" | "divergente" | "neutro";
  icone: string;
}

export interface IndiceConfiabilidade {
  indice: number; // 0-100
  classificacao: "alta" | "moderada" | "baixa" | "insuficiente";
  fontes: FonteConfiabilidade[];
  calculadoEm: string;
  periodoInicio: string;
  periodoFim: string;
}

/**
 * Classificação da confiabilidade
 * >= 75: Alta — forte convergência entre dados psicossociais e indicadores reais
 * 50-74: Moderada — convergência parcial, investigar divergências
 * 25-49: Baixa — divergência significativa, pode indicar subnotificação ou viés
 * < 25: Insuficiente — dados insuficientes para validar
 */
function classificar(score: number): IndiceConfiabilidade["classificacao"] {
  if (score >= 75) return "alta";
  if (score >= 50) return "moderada";
  if (score >= 25) return "baixa";
  return "insuficiente";
}

export function useIndiceConfiabilidade(campanhaId?: string) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();

  // Buscar índice já calculado
  const { data: indiceExistente, isLoading } = useQuery({
    queryKey: ["indice-confiabilidade", campanhaId],
    queryFn: async () => {
      if (!campanhaId || !tenantId) return null;

      const { data, error } = await supabase
        .from("psicossocial_indice_confiabilidade" as any)
        .select("*")
        .eq("campanha_id", campanhaId)
        .eq("tenant_id", tenantId)
        .order("calculado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      const row = data as any;

      const fontes: FonteConfiabilidade[] = [];
      const detalhes = row.detalhes || {};

      const addFonte = (
        key: string,
        nome: string,
        icone: string,
        scoreVal: number
      ) => {
        fontes.push({
          fonte: nome,
          descricao: detalhes[key]?.descricao || "",
          score: scoreVal,
          totalRegistros: detalhes[key]?.total || 0,
          convergencia:
            scoreVal >= 60
              ? "convergente"
              : scoreVal >= 30
              ? "neutro"
              : "divergente",
          icone,
        });
      };

      addFonte("absenteismo", "Absenteísmo", "🏥", Number(row.score_absenteismo));
      addFonte("acidentes", "Acidentes/CAT", "⚠️", Number(row.score_acidentes));
      addFonte("turnover", "Turnover", "🚪", Number(row.score_turnover));
      addFonte("humor", "Humor Diário", "😊", Number(row.score_humor));
      addFonte("denuncias", "Denúncias", "📢", Number(row.score_denuncias));
      addFonte("afastamentos", "Afastamentos", "🏠", Number(row.score_afastamentos));

      return {
        indice: Number(row.indice_confiabilidade),
        classificacao: row.classificacao as IndiceConfiabilidade["classificacao"],
        fontes,
        calculadoEm: row.calculado_em,
        periodoInicio: row.periodo_inicio,
        periodoFim: row.periodo_fim,
      } as IndiceConfiabilidade;
    },
    enabled: !!campanhaId && !!tenantId,
  });

  // Calcular e salvar índice
  const calcular = useMutation({
    mutationFn: async ({
      campanhaId: cId,
      ipsScore,
    }: {
      campanhaId: string;
      ipsScore: number;
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const agora = new Date();
      const inicio90 = new Date(agora);
      inicio90.setDate(inicio90.getDate() - 90);
      const periodoInicio = inicio90.toISOString().split("T")[0];
      const periodoFim = agora.toISOString().split("T")[0];

      // 1. Absenteísmo — atestados nos últimos 90 dias
      const { data: atestados } = await supabase
        .from("atestados")
        .select("id, dias_afastamento")
        .eq("tenant_id", tenantId)
        .gte("data_emissao", periodoInicio);

      const totalAtestados = atestados?.length || 0;
      const diasTotalAfastamento = (atestados || []).reduce(
        (s, a) => s + (a.dias_afastamento || 0),
        0
      );
      // Se IPS baixo E muitos atestados → convergente (score alto)
      // Se IPS alto E muitos atestados → divergente (score baixo)
      const taxaAtestadoPorDia = diasTotalAfastamento / 90;
      const scoreAbsenteismo = calcularConvergencia(ipsScore, taxaAtestadoPorDia, 0.1, true);

      // 2. Acidentes — desvios de segurança
      const { data: desvios } = await supabase
        .from("desvios_seguranca")
        .select("id")
        .eq("tenant_id", tenantId)
        .gte("created_at", periodoInicio);
      const totalDesvios = desvios?.length || 0;
      const scoreAcidentes = calcularConvergencia(ipsScore, totalDesvios, 3, true);

      // 3. Turnover — desligamentos
      const { data: desligamentos } = await supabase
        .from("admissoes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "desligado")
        .gte("data_desligamento", periodoInicio);
      const totalDesligamentos = desligamentos?.length || 0;
      const scoreTurnover = calcularConvergencia(ipsScore, totalDesligamentos, 5, true);

      // 4. Humor — tendências de humor negativo
      const { data: humores } = await supabase
        .from("humor_diario" as any)
        .select("humor")
        .eq("tenant_id", tenantId)
        .gte("created_at", periodoInicio);
      const totalHumores = (humores as any[])?.length || 0;
      const negativos = ["estressado", "ansioso", "desanimado"];
      const pctNegativo =
        totalHumores > 0
          ? (humores as any[]).filter((h: any) => negativos.includes(h.humor)).length /
            totalHumores
          : -1; // -1 = sem dados
      const scoreHumor =
        pctNegativo >= 0
          ? calcularConvergencia(ipsScore, pctNegativo, 0.3, true)
          : 50; // Neutro se sem dados

      // 5. Denúncias — ouvidoria
      const { data: denuncias } = await supabase
        .from("ouvidoria" as any)
        .select("id")
        .eq("tenant_id", tenantId)
        .gte("created_at", periodoInicio);
      const totalDenuncias = (denuncias as any[])?.length || 0;
      const scoreDenuncias = calcularConvergencia(ipsScore, totalDenuncias, 3, true);

      // 6. Afastamentos > 15 dias
      const { data: afastamentos } = await supabase
        .from("afastamentos")
        .select("id, dias_totais")
        .eq("tenant_id", tenantId)
        .gte("data_inicio", periodoInicio);
      const afastLongos = (afastamentos || []).filter(
        (a) => (a.dias_totais || 0) >= 15
      ).length;
      const scoreAfastamentos = calcularConvergencia(ipsScore, afastLongos, 2, true);

      // Índice final: média ponderada
      const pesos = { absenteismo: 20, acidentes: 15, turnover: 20, humor: 20, denuncias: 10, afastamentos: 15 };
      const somaScore =
        scoreAbsenteismo * pesos.absenteismo +
        scoreAcidentes * pesos.acidentes +
        scoreTurnover * pesos.turnover +
        scoreHumor * pesos.humor +
        scoreDenuncias * pesos.denuncias +
        scoreAfastamentos * pesos.afastamentos;
      const somaPesos = Object.values(pesos).reduce((s, p) => s + p, 0);
      const indiceFinal = Math.round(somaScore / somaPesos);
      const classificacao = classificar(indiceFinal);

      const detalhes = {
        absenteismo: { total: totalAtestados, dias: diasTotalAfastamento, descricao: `${totalAtestados} atestado(s), ${diasTotalAfastamento} dia(s) de afastamento` },
        acidentes: { total: totalDesvios, descricao: `${totalDesvios} desvio(s) de segurança registrado(s)` },
        turnover: { total: totalDesligamentos, descricao: `${totalDesligamentos} desligamento(s) no período` },
        humor: { total: totalHumores, pctNegativo: pctNegativo >= 0 ? Math.round(pctNegativo * 100) : null, descricao: totalHumores > 0 ? `${Math.round((pctNegativo >= 0 ? pctNegativo : 0) * 100)}% humor negativo em ${totalHumores} registro(s)` : "Sem dados de humor no período" },
        denuncias: { total: totalDenuncias, descricao: `${totalDenuncias} denúncia(s) no período` },
        afastamentos: { total: afastLongos, descricao: `${afastLongos} afastamento(s) > 15 dias` },
      };

      // Upsert
      const { error } = await supabase
        .from("psicossocial_indice_confiabilidade" as any)
        .upsert(
          {
            campanha_id: cId,
            tenant_id: tenantId,
            score_absenteismo: scoreAbsenteismo,
            score_acidentes: scoreAcidentes,
            score_turnover: scoreTurnover,
            score_humor: scoreHumor,
            score_denuncias: scoreDenuncias,
            score_afastamentos: scoreAfastamentos,
            indice_confiabilidade: indiceFinal,
            classificacao,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            detalhes,
            calculado_em: new Date().toISOString(),
          } as any,
          { onConflict: "campanha_id" as any }
        );

      if (error) {
        // If upsert fails (no unique constraint), do insert
        await supabase
          .from("psicossocial_indice_confiabilidade" as any)
          .insert({
            campanha_id: cId,
            tenant_id: tenantId,
            score_absenteismo: scoreAbsenteismo,
            score_acidentes: scoreAcidentes,
            score_turnover: scoreTurnover,
            score_humor: scoreHumor,
            score_denuncias: scoreDenuncias,
            score_afastamentos: scoreAfastamentos,
            indice_confiabilidade: indiceFinal,
            classificacao,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            detalhes,
            calculado_em: new Date().toISOString(),
          } as any);
      }

      return {
        indice: indiceFinal,
        classificacao,
        fontes: Object.entries(detalhes).map(([key, val]) => ({
          fonte: key,
          descricao: val.descricao,
          score: key === "absenteismo" ? scoreAbsenteismo : key === "acidentes" ? scoreAcidentes : key === "turnover" ? scoreTurnover : key === "humor" ? scoreHumor : key === "denuncias" ? scoreDenuncias : scoreAfastamentos,
          totalRegistros: val.total,
          convergencia: "neutro" as const,
          icone: "",
        })),
        calculadoEm: new Date().toISOString(),
        periodoInicio,
        periodoFim,
      } as IndiceConfiabilidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indice-confiabilidade"] });
    },
  });

  return {
    indice: indiceExistente,
    isLoading,
    calcular: calcular.mutateAsync,
    isCalculating: calcular.isPending,
  };
}

/**
 * Calcula score de convergência entre o IPS e um indicador externo.
 *
 * Lógica: Se IPS é baixo (ambiente ruim) e o indicador externo confirma
 * (muitos atestados, acidentes, etc.), há convergência → score alto.
 * Se IPS é alto (ambiente bom) mas indicador externo é alto → divergência → score baixo.
 *
 * @param ipsScore - Score IPS da campanha (0-100, maior = melhor)
 * @param indicadorValor - Valor do indicador externo
 * @param limiarAlto - Limiar considerado "alto" para o indicador
 * @param indicadorEhNegativo - true se valor alto do indicador = ruim
 */
function calcularConvergencia(
  ipsScore: number,
  indicadorValor: number,
  limiarAlto: number,
  indicadorEhNegativo: boolean
): number {
  // Normalizar indicador para 0-1
  const indicadorNorm = Math.min(1, indicadorValor / limiarAlto);

  // IPS normalizado (0-1, onde 1 = ambiente saudável)
  const ipsNorm = ipsScore / 100;

  if (indicadorEhNegativo) {
    // Convergência: IPS baixo + indicador alto, OU IPS alto + indicador baixo
    const convergencia = 1 - Math.abs(ipsNorm - (1 - indicadorNorm));
    return Math.round(convergencia * 100);
  } else {
    // Convergência: IPS alto + indicador alto
    const convergencia = 1 - Math.abs(ipsNorm - indicadorNorm);
    return Math.round(convergencia * 100);
  }
}
