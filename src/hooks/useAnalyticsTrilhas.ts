import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TrilhaAnalytics {
  totalTrilhas: number;
  trilhasAtivas: number;
  totalModulos: number;
  totalInscritos: number;
  totalConclusoes: number;
  taxaConclusao: number;
  totalPontosDistribuidos: number;
  totalCertificados: number;
  totalMedalhas: number;
  engajamentoPorTrilha: TrilhaEngajamento[];
  progressoPorColaborador: ColaboradorProgresso[];
  modulosMaisConcluidos: ModuloRank[];
  tendenciaMensal: TendenciaMensal[];
  gatilhosIA: GatilhoIA[];
}

export interface TrilhaEngajamento {
  trilha_id: string;
  trilha_nome: string;
  total_inscritos: number;
  total_concluidos: number;
  taxa_conclusao: number;
  pontos_medio: number;
}

export interface ColaboradorProgresso {
  colaborador_id: string;
  colaborador_nome: string;
  trilhas_iniciadas: number;
  trilhas_concluidas: number;
  pontos_total: number;
  ultima_atividade: string | null;
}

export interface ModuloRank {
  modulo_id: string;
  titulo: string;
  tipo: string;
  conclusoes: number;
  nota_media: number | null;
}

export interface TendenciaMensal {
  mes: string;
  conclusoes: number;
  novos_inscritos: number;
}

export interface GatilhoIA {
  id: string;
  tipo: "irp_alto" | "img_baixo" | "humor_negativo" | "abandono_trilha" | "sem_atividade" | "alta_performance";
  titulo: string;
  descricao: string;
  severidade: "info" | "warning" | "critical";
  trilha_sugerida?: string;
  colaboradores_afetados: number;
  dados: Record<string, unknown>;
}

export function useAnalyticsTrilhas() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["trilha_analytics", tenantId],
    queryFn: async (): Promise<TrilhaAnalytics> => {
      if (!tenantId) throw new Error("Sem tenant");

      // Parallel fetches
      const [trilhasRes, modulosRes, progressoRes, certsRes, medalhasRes, humorRes] = await Promise.all([
        supabase.from("trilhas" as never).select("id, nome, status, total_modulos").eq("tenant_id", tenantId) as any,
        supabase.from("trilha_modulos" as never).select("id, trilha_id, titulo, tipo, pontuacao, ativo").eq("tenant_id", tenantId) as any,
        supabase.from("trilha_progresso" as never).select("*").eq("tenant_id", tenantId) as any,
        supabase.from("trilha_certificados" as never).select("id, colaborador_id, trilha_id, data_conclusao").eq("tenant_id", tenantId) as any,
        supabase.from("trilha_medalhas_colaboradores" as never).select("id, colaborador_id").eq("tenant_id", tenantId) as any,
        supabase.from("humor_registros" as never).select("colaborador_id, humor, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500) as any,
      ]);

      const trilhas: any[] = trilhasRes.data || [];
      const modulos: any[] = modulosRes.data || [];
      const progresso: any[] = progressoRes.data || [];
      const certs: any[] = certsRes.data || [];
      const medalhas: any[] = medalhasRes.data || [];
      const humores: any[] = humorRes.data || [];

      const trilhasAtivas = trilhas.filter((t) => t.status === "ativa");
      const concluidos = progresso.filter((p) => p.status === "concluido");
      const colaboradoresUnicos = new Set(progresso.map((p) => p.colaborador_id));
      const totalPontos = concluidos.reduce((s: number, p: any) => s + (p.pontos_obtidos || 0), 0);

      // Engajamento por trilha
      const engajamentoPorTrilha: TrilhaEngajamento[] = trilhasAtivas.map((t) => {
        const progressoTrilha = progresso.filter((p) => p.trilha_id === t.id);
        const colabsInscritos = new Set(progressoTrilha.map((p) => p.colaborador_id));
        const certsTrilha = certs.filter((c) => c.trilha_id === t.id);
        const colabsConcluidos = new Set(certsTrilha.map((c) => c.colaborador_id));
        const pontosMedia = progressoTrilha.length > 0
          ? progressoTrilha.reduce((s: number, p: any) => s + (p.pontos_obtidos || 0), 0) / colabsInscritos.size
          : 0;
        return {
          trilha_id: t.id,
          trilha_nome: t.nome,
          total_inscritos: colabsInscritos.size,
          total_concluidos: colabsConcluidos.size,
          taxa_conclusao: colabsInscritos.size > 0 ? Math.round((colabsConcluidos.size / colabsInscritos.size) * 100) : 0,
          pontos_medio: Math.round(pontosMedia),
        };
      });

      // Progresso por colaborador
      const colabMap = new Map<string, ColaboradorProgresso>();
      for (const p of progresso) {
        const existing = colabMap.get(p.colaborador_id);
        if (!existing) {
          colabMap.set(p.colaborador_id, {
            colaborador_id: p.colaborador_id,
            colaborador_nome: p.colaborador_nome,
            trilhas_iniciadas: 1,
            trilhas_concluidas: 0,
            pontos_total: p.pontos_obtidos || 0,
            ultima_atividade: p.updated_at,
          });
        } else {
          existing.pontos_total += p.pontos_obtidos || 0;
          if (p.updated_at > (existing.ultima_atividade || "")) existing.ultima_atividade = p.updated_at;
        }
      }
      // Count unique trilhas per colab
      const colabTrilhas = new Map<string, Set<string>>();
      for (const p of progresso) {
        if (!colabTrilhas.has(p.colaborador_id)) colabTrilhas.set(p.colaborador_id, new Set());
        colabTrilhas.get(p.colaborador_id)!.add(p.trilha_id);
      }
      for (const [id, entry] of colabMap) {
        entry.trilhas_iniciadas = colabTrilhas.get(id)?.size || 0;
        entry.trilhas_concluidas = certs.filter((c) => c.colaborador_id === id).length;
      }
      const progressoPorColaborador = Array.from(colabMap.values()).sort((a, b) => b.pontos_total - a.pontos_total);

      // Módulos mais concluídos
      const moduloConclMap = new Map<string, number>();
      const moduloNotaMap = new Map<string, number[]>();
      for (const p of concluidos) {
        moduloConclMap.set(p.modulo_id, (moduloConclMap.get(p.modulo_id) || 0) + 1);
        if (p.nota != null) {
          if (!moduloNotaMap.has(p.modulo_id)) moduloNotaMap.set(p.modulo_id, []);
          moduloNotaMap.get(p.modulo_id)!.push(p.nota);
        }
      }
      const modulosMaisConcluidos: ModuloRank[] = modulos
        .filter((m) => moduloConclMap.has(m.id))
        .map((m) => ({
          modulo_id: m.id,
          titulo: m.titulo,
          tipo: m.tipo,
          conclusoes: moduloConclMap.get(m.id) || 0,
          nota_media: moduloNotaMap.has(m.id) ? Math.round(moduloNotaMap.get(m.id)!.reduce((a, b) => a + b, 0) / moduloNotaMap.get(m.id)!.length * 10) / 10 : null,
        }))
        .sort((a, b) => b.conclusoes - a.conclusoes)
        .slice(0, 10);

      // Tendência mensal (últimos 6 meses)
      const tendenciaMensal: TendenciaMensal[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const concMes = concluidos.filter((p) => p.data_conclusao?.startsWith(mesKey)).length;
        const inscMes = progresso.filter((p) => p.created_at?.startsWith(mesKey)).length;
        tendenciaMensal.push({ mes: mesKey, conclusoes: concMes, novos_inscritos: inscMes });
      }

      // === GATILHOS IA ===
      const gatilhosIA: GatilhoIA[] = [];

      // 1. Colaboradores com trilhas abandonadas (>14 dias sem atividade)
      const agora = Date.now();
      const abandonados = progressoPorColaborador.filter((c) => {
        if (c.trilhas_concluidas >= c.trilhas_iniciadas) return false;
        if (!c.ultima_atividade) return true;
        const diff = (agora - new Date(c.ultima_atividade).getTime()) / (1000 * 60 * 60 * 24);
        return diff > 14;
      });
      if (abandonados.length > 0) {
        gatilhosIA.push({
          id: "abandono",
          tipo: "abandono_trilha",
          titulo: "Trilhas Abandonadas",
          descricao: `${abandonados.length} colaborador(es) não interagem com suas trilhas há mais de 14 dias. Considere enviar lembretes ou simplificar o conteúdo.`,
          severidade: "warning",
          colaboradores_afetados: abandonados.length,
          dados: { colaboradores: abandonados.slice(0, 5).map((c) => c.colaborador_nome) },
        });
      }

      // 2. Trilhas com baixa taxa de conclusão (<30% e >3 inscritos)
      const trilhasBaixaConclusao = engajamentoPorTrilha.filter((t) => t.taxa_conclusao < 30 && t.total_inscritos >= 3);
      if (trilhasBaixaConclusao.length > 0) {
        gatilhosIA.push({
          id: "baixa_conclusao",
          tipo: "img_baixo",
          titulo: "Trilhas com Baixa Conclusão",
          descricao: `${trilhasBaixaConclusao.length} trilha(s) têm taxa de conclusão inferior a 30%. Revise a dificuldade, duração ou relevância do conteúdo.`,
          severidade: "warning",
          colaboradores_afetados: trilhasBaixaConclusao.reduce((s, t) => s + t.total_inscritos, 0),
          dados: { trilhas: trilhasBaixaConclusao.map((t) => t.trilha_nome) },
        });
      }

      // 3. Humor negativo persistente → sugerir trilha de saúde/ergonomia
      const humorNegativo = humores.filter((h) => ["triste", "ansioso", "frustrado", "exausto", "estressado"].includes(h.humor));
      const colabsHumorNeg = new Set(humorNegativo.map((h) => h.colaborador_id));
      // Colaboradores com 3+ registros negativos
      const colabsReincidentes = Array.from(colabsHumorNeg).filter(
        (id) => humorNegativo.filter((h) => h.colaborador_id === id).length >= 3
      );
      if (colabsReincidentes.length > 0) {
        const trilhaErgonomia = trilhasAtivas.find((t) => t.nome?.toLowerCase().includes("ergonomia") || t.nome?.toLowerCase().includes("saúde") || t.nome?.toLowerCase().includes("bem-estar"));
        gatilhosIA.push({
          id: "humor_neg",
          tipo: "humor_negativo",
          titulo: "Humor Negativo Recorrente",
          descricao: `${colabsReincidentes.length} colaborador(es) apresentam padrão de humor negativo recorrente. Recomenda-se atribuir trilhas de Ergonomia & Saúde ou Bem-Estar.`,
          severidade: "critical",
          trilha_sugerida: trilhaErgonomia?.nome,
          colaboradores_afetados: colabsReincidentes.length,
          dados: {},
        });
      }

      // 4. Colaboradores sem atividade alguma
      const colabsSemAtividade = progressoPorColaborador.filter((c) => c.trilhas_iniciadas === 0);
      // We can't detect this from progress alone—skip if no collaborators in the org without progress
      // Instead: detect active trilhas with 0 inscritos
      const trilhasSemInscritos = engajamentoPorTrilha.filter((t) => t.total_inscritos === 0);
      if (trilhasSemInscritos.length > 0) {
        gatilhosIA.push({
          id: "sem_inscritos",
          tipo: "sem_atividade",
          titulo: "Trilhas sem Participantes",
          descricao: `${trilhasSemInscritos.length} trilha(s) ativa(s) ainda não possuem participantes. Configure atribuições ou promova estas trilhas.`,
          severidade: "info",
          colaboradores_afetados: 0,
          dados: { trilhas: trilhasSemInscritos.map((t) => t.trilha_nome) },
        });
      }

      // 5. Alta performance → reconhecimento
      const altaPerformance = progressoPorColaborador.filter((c) => c.trilhas_concluidas >= 3);
      if (altaPerformance.length > 0) {
        gatilhosIA.push({
          id: "alta_perf",
          tipo: "alta_performance",
          titulo: "Colaboradores Destaque",
          descricao: `${altaPerformance.length} colaborador(es) concluíram 3 ou mais trilhas. Considere reconhecimento formal ou atribuição de trilhas avançadas.`,
          severidade: "info",
          colaboradores_afetados: altaPerformance.length,
          dados: { colaboradores: altaPerformance.slice(0, 5).map((c) => c.colaborador_nome) },
        });
      }

      return {
        totalTrilhas: trilhas.length,
        trilhasAtivas: trilhasAtivas.length,
        totalModulos: modulos.filter((m) => m.ativo).length,
        totalInscritos: colaboradoresUnicos.size,
        totalConclusoes: certs.length,
        taxaConclusao: colaboradoresUnicos.size > 0 ? Math.round((certs.length / colaboradoresUnicos.size) * 100) : 0,
        totalPontosDistribuidos: totalPontos,
        totalCertificados: certs.length,
        totalMedalhas: medalhas.length,
        engajamentoPorTrilha,
        progressoPorColaborador,
        modulosMaisConcluidos,
        tendenciaMensal,
        gatilhosIA,
      };
    },
    enabled: !!tenantId,
  });
}
