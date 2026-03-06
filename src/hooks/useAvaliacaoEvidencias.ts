import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface EvidenciaColaborador {
  feedbacks: {
    id: string;
    categoria: string;
    descricao: string;
    created_at: string;
    registrado_por_nome: string | null;
  }[];
  ocorrencias: {
    id: string;
    tipo: string;
    descricao: string;
    created_at: string;
    is_advertencia: boolean;
  }[];
  metas: {
    id: string;
    titulo: string;
    progresso: number;
    status: string;
  }[];
  trilhas: {
    id: string;
    nome: string;
    percentual: number;
    status: "concluida" | "em_andamento" | "nao_iniciada";
  }[];
  acoes: {
    id: string;
    titulo: string;
    status: string;
    progresso: number;
  }[];
  risco: {
    burnout: "baixo" | "moderado" | "alto" | null;
    boreout: "baixo" | "moderado" | "alto" | null;
    irp: number | null;
    campanha_nome: string | null;
  };
}

export function useAvaliacaoEvidencias(colaboradorId: string | null, dataInicio?: string, dataFim?: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["avaliacao-evidencias", tenantId, colaboradorId, dataInicio, dataFim],
    queryFn: async (): Promise<EvidenciaColaborador> => {
      if (!tenantId || !colaboradorId) {
        return { feedbacks: [], ocorrencias: [], metas: [], trilhas: [], acoes: [], risco: { burnout: null, boreout: null, irp: null, campanha_nome: null } };
      }

      const di = dataInicio || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const df = dataFim || new Date().toISOString();

      // Buscar profile do colaborador para obter user_id e nome
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .eq("tenant_id", tenantId)
        .eq("user_id", colaboradorId)
        .maybeSingle();

      const colaboradorNome = profile?.nome_completo || "";

      // Executar queries em paralelo
      const [feedbacksRes, ocorrenciasRes, metasRes, trilhasRes, acoesRes, psicossocialRes] = await Promise.all([
        // Feedbacks do colaborador no período
        supabase
          .from("feedbacks" as never)
          .select("id, categoria, descricao, created_at, registrado_por_nome")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .gte("created_at", di)
          .lte("created_at", df)
          .order("created_at", { ascending: false })
          .limit(20) as any,

        // Ocorrências do colaborador no período
        supabase
          .from("ocorrencias" as never)
          .select("id, tipo, descricao, created_at, is_advertencia")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .gte("created_at", di)
          .lte("created_at", df)
          .order("created_at", { ascending: false })
          .limit(20) as any,

        // Metas do colaborador
        supabase
          .from("metas")
          .select("id, titulo, progresso, status")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .order("created_at", { ascending: false })
          .limit(10),

        // Progresso em trilhas
        supabase
          .from("trilha_progresso" as never)
          .select("trilha_id, status, trilhas:trilha_id(nome, total_modulos)")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .order("updated_at", { ascending: false }) as any,

        // Ações do colaborador
        supabase
          .from("plano_acoes")
          .select("id, titulo, status, progresso")
          .eq("tenant_id", tenantId)
          .eq("responsavel_id", colaboradorId)
          .order("created_at", { ascending: false })
          .limit(10),

        // Indicadores psicossociais — última campanha com respostas do colaborador
        supabase
          .from("psicossocial_convites" as never)
          .select("id, status, respostas:psicossocial_respostas(respostas_json), campanha:psicossocial_campanhas(nome)")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", colaboradorId)
          .eq("status", "respondido")
          .order("created_at", { ascending: false })
          .limit(1) as any,
      ]);

      // Processar trilhas — agrupar por trilha_id e calcular percentual
      const trilhasMap = new Map<string, { nome: string; concluidos: number; total: number }>();
      if (trilhasRes.data) {
        for (const p of trilhasRes.data as any[]) {
          const tid = p.trilha_id;
          const trilhaNome = (p.trilhas as any)?.nome || "";
          const totalModulos = (p.trilhas as any)?.total_modulos || 1;
          if (!trilhasMap.has(tid)) {
            trilhasMap.set(tid, { nome: trilhaNome, concluidos: 0, total: totalModulos });
          }
          if (p.status === "concluido") {
            trilhasMap.get(tid)!.concluidos++;
          }
        }
      }
      const trilhas = Array.from(trilhasMap.entries()).map(([id, t]) => ({
        id,
        nome: t.nome,
        percentual: Math.round((t.concluidos / t.total) * 100),
        status: (t.concluidos >= t.total ? "concluida" : t.concluidos > 0 ? "em_andamento" : "nao_iniciada") as "concluida" | "em_andamento" | "nao_iniciada",
      })).slice(0, 8);

      // Processar indicadores psicossociais
      let risco: EvidenciaColaborador["risco"] = { burnout: null, boreout: null, irp: null, campanha_nome: null };
      if (psicossocialRes.data && psicossocialRes.data.length > 0) {
        const convite = psicossocialRes.data[0] as any;
        const respostas = convite.respostas?.[0]?.respostas_json as Record<string, number> | null;
        const campanhaNome = (convite.campanha as any)?.nome || null;

        if (respostas) {
          // Cálculo simplificado dos índices (0-4 escala)
          const valores = Object.values(respostas) as number[];
          const media = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 2;
          const irp = parseFloat(media.toFixed(2));

          const toBurnoutLevel = (v: number): "baixo" | "moderado" | "alto" => {
            if (v <= 1.5) return "baixo";
            if (v <= 2.5) return "moderado";
            return "alto";
          };

          risco = {
            burnout: toBurnoutLevel(media),
            boreout: toBurnoutLevel(4 - media),
            irp,
            campanha_nome: campanhaNome,
          };
        }
      }

      return {
        feedbacks: (feedbacksRes.data || []) as EvidenciaColaborador["feedbacks"],
        ocorrencias: (ocorrenciasRes.data || []) as EvidenciaColaborador["ocorrencias"],
        metas: (metasRes.data || []) as EvidenciaColaborador["metas"],
        trilhas,
        acoes: (acoesRes.data || []) as EvidenciaColaborador["acoes"],
        risco,
      };
    },
    enabled: !!tenantId && !!colaboradorId,
  });
}
