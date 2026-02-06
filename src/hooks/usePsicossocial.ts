import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type {
  CampanhaPsicossocial,
  ConvitePsicossocial,
  RespostaPsicossocial,
  NovaCampanha,
  GerarConvitesInput,
  EstatisticasCampanha,
  IndicadoresPsicossociais,
  BLOCOS_PSICOSSOCIAL,
  obterTodasPerguntas,
} from "@/types/psicossocial";

// Gerar token único
function gerarToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

// Calcular indicadores a partir das respostas
export function calcularIndicadores(
  respostas: Record<string, number>,
  blocosDinamicos?: string[]
): IndicadoresPsicossociais {
  const { BLOCOS_PSICOSSOCIAL, obterTodasPerguntas } = require("@/types/psicossocial");
  
  const blocos = BLOCOS_PSICOSSOCIAL as typeof import("@/types/psicossocial").BLOCOS_PSICOSSOCIAL;
  
  // Calcular média por bloco
  const mediasPorBloco: { bloco: string; media: number; nivel: 'baixo' | 'moderado' | 'alto' | 'critico' }[] = [];
  
  for (const bloco of blocos) {
    const valoresBloco = bloco.perguntas.map(p => {
      const valor = respostas[p.id] || 3; // Default neutro
      // Inverter se necessário (para perguntas positivas, maior = melhor)
      return p.invertida ? (6 - valor) : valor;
    });
    
    const media = valoresBloco.length > 0 
      ? valoresBloco.reduce((a, b) => a + b, 0) / valoresBloco.length 
      : 3;
    
    let nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
    if (media <= 2) nivel = 'baixo';
    else if (media <= 3) nivel = 'moderado';
    else if (media <= 4) nivel = 'alto';
    else nivel = 'critico';
    
    mediasPorBloco.push({ bloco: bloco.titulo, media, nivel });
  }
  
  // IRP-S: Índice Risco Psicossocial (média geral dos blocos 1-6)
  const blocosRisco = mediasPorBloco.slice(0, 6);
  const IRP_S = blocosRisco.length > 0 
    ? blocosRisco.reduce((a, b) => a + b.media, 0) / blocosRisco.length 
    : 3;
  
  // IBO-S: Índice Burnout (blocos 1, 2, 3 - sobrecarga + exaustão)
  const blocosBurnout = mediasPorBloco.slice(0, 3);
  const IBO_S = blocosBurnout.length > 0 
    ? blocosBurnout.reduce((a, b) => a + b.media, 0) / blocosBurnout.length 
    : 3;
  
  // IBD-S: Índice Boreout (blocos 4, 5, 8 invertidos - falta autonomia, clareza, engajamento)
  const blocosBoreout = [mediasPorBloco[3], mediasPorBloco[4], mediasPorBloco[7]].filter(Boolean);
  const IBD_S = blocosBoreout.length > 0 
    ? 6 - (blocosBoreout.reduce((a, b) => a + b.media, 0) / blocosBoreout.length)
    : 3;
  
  // IREC-S: Índice Recuperação (bloco 9)
  const IREC_S = mediasPorBloco[8]?.media || 3;
  
  // ICOP-S: Índice Clareza Organizacional (blocos 5, 6)
  const blocosClareza = [mediasPorBloco[4], mediasPorBloco[5]].filter(Boolean);
  const ICOP_S = blocosClareza.length > 0 
    ? 6 - (blocosClareza.reduce((a, b) => a + b.media, 0) / blocosClareza.length)
    : 3;
  
  return {
    IRP_S: Number(IRP_S.toFixed(2)),
    IBO_S: Number(IBO_S.toFixed(2)),
    IBD_S: Number(IBD_S.toFixed(2)),
    IREC_S: Number(IREC_S.toFixed(2)),
    ICOP_S: Number(ICOP_S.toFixed(2)),
    detalhes: mediasPorBloco,
  };
}

export function usePsicossocial() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  // ==================== CAMPANHAS ====================

  // Buscar todas as campanhas
  const { data: campanhas = [], isLoading: isLoadingCampanhas, refetch: refetchCampanhas } = useQuery({
    queryKey: ["psicossocial-campanhas", tenantId],
    queryFn: async (): Promise<CampanhaPsicossocial[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("questionario_psicossocial_campanhas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CampanhaPsicossocial[];
    },
    enabled: !!tenantId,
  });

  // Criar nova campanha
  const criarCampanha = useMutation({
    mutationFn: async (dados: NovaCampanha): Promise<CampanhaPsicossocial> => {
      if (!tenantId || !user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("questionario_psicossocial_campanhas")
        .insert({
          tenant_id: tenantId,
          nome: dados.nome,
          descricao: dados.descricao,
          data_inicio: dados.data_inicio,
          data_fim: dados.data_fim,
          anonimo: dados.anonimo,
          departamentos_ids: dados.departamentos_ids,
          cargos_ids: dados.cargos_ids,
          blocos_dinamicos: dados.blocos_dinamicos,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
          status: 'rascunho',
        })
        .select()
        .single();

      if (error) throw error;
      return data as CampanhaPsicossocial;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["psicossocial-campanhas"] });
      toast.success("Campanha criada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar campanha: ${error.message}`);
    },
  });

  // Atualizar status da campanha
  const atualizarStatusCampanha = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CampanhaPsicossocial['status'] }) => {
      const { error } = await supabase
        .from("questionario_psicossocial_campanhas")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["psicossocial-campanhas"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // ==================== CONVITES ====================

  // Buscar convites de uma campanha
  const buscarConvites = async (campanhaId: string): Promise<ConvitePsicossocial[]> => {
    const { data, error } = await supabase
      .from("questionario_psicossocial_convites")
      .select("*")
      .eq("campanha_id", campanhaId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ConvitePsicossocial[];
  };

  // Hook para convites de uma campanha específica
  const useConvitesCampanha = (campanhaId?: string) => {
    return useQuery({
      queryKey: ["psicossocial-convites", campanhaId],
      queryFn: () => buscarConvites(campanhaId!),
      enabled: !!campanhaId,
    });
  };

  // Gerar convites para colaboradores
  const gerarConvites = useMutation({
    mutationFn: async (input: GerarConvitesInput): Promise<ConvitePsicossocial[]> => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Buscar a campanha para pegar o tenant_id
      const { data: campanha, error: erroC } = await supabase
        .from("questionario_psicossocial_campanhas")
        .select("tenant_id")
        .eq("id", input.campanha_id)
        .single();

      if (erroC) throw erroC;

      const convites = input.colaboradores.map(colab => ({
        tenant_id: campanha.tenant_id,
        campanha_id: input.campanha_id,
        colaborador_id: colab.id || null,
        colaborador_nome: colab.nome,
        colaborador_cpf: colab.cpf || null,
        colaborador_cargo: colab.cargo || null,
        colaborador_departamento: colab.departamento || null,
        token: gerarToken(),
        status: 'pendente' as const,
        enviado_via: input.enviado_via || 'link',
        enviado_em: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from("questionario_psicossocial_convites")
        .insert(convites)
        .select();

      if (error) throw error;
      return (data || []) as ConvitePsicossocial[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["psicossocial-convites", variables.campanha_id] });
      toast.success("Convites gerados com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao gerar convites: ${error.message}`);
    },
  });

  // ==================== RESPOSTAS ====================

  // Buscar respostas de uma campanha
  const buscarRespostas = async (campanhaId: string): Promise<RespostaPsicossocial[]> => {
    const { data, error } = await supabase
      .from("questionario_psicossocial_respostas")
      .select("*")
      .eq("campanha_id", campanhaId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((item: any) => ({
      ...item,
      respostas: item.respostas as Record<string, number>,
      indicadores: item.indicadores as IndicadoresPsicossociais | undefined,
    })) as RespostaPsicossocial[];
  };

  // Hook para respostas de uma campanha
  const useRespostasCampanha = (campanhaId?: string) => {
    return useQuery({
      queryKey: ["psicossocial-respostas", campanhaId],
      queryFn: () => buscarRespostas(campanhaId!),
      enabled: !!campanhaId,
    });
  };

  // ==================== ESTATÍSTICAS ====================

  // Calcular estatísticas de uma campanha
  const calcularEstatisticas = async (campanhaId: string): Promise<EstatisticasCampanha> => {
    const convites = await buscarConvites(campanhaId);
    const respostas = await buscarRespostas(campanhaId);

    const total = convites.length;
    const pendentes = convites.filter(c => c.status === 'pendente').length;
    const iniciados = convites.filter(c => c.status === 'iniciado').length;
    const concluidos = convites.filter(c => c.status === 'concluido').length;
    const expirados = convites.filter(c => c.status === 'expirado').length;

    // Médias dos indicadores
    const respostasComIndicadores = respostas.filter(r => r.indicadores);
    let media_IRP_S, media_IBO_S, media_IBD_S, media_IREC_S, media_ICOP_S;

    if (respostasComIndicadores.length > 0) {
      media_IRP_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IRP_S || 0), 0) / respostasComIndicadores.length;
      media_IBO_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IBO_S || 0), 0) / respostasComIndicadores.length;
      media_IBD_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IBD_S || 0), 0) / respostasComIndicadores.length;
      media_IREC_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IREC_S || 0), 0) / respostasComIndicadores.length;
      media_ICOP_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.ICOP_S || 0), 0) / respostasComIndicadores.length;
    }

    return {
      total_convites: total,
      pendentes,
      iniciados,
      concluidos,
      expirados,
      taxa_participacao: total > 0 ? (concluidos / total) * 100 : 0,
      media_IRP_S: media_IRP_S ? Number(media_IRP_S.toFixed(2)) : undefined,
      media_IBO_S: media_IBO_S ? Number(media_IBO_S.toFixed(2)) : undefined,
      media_IBD_S: media_IBD_S ? Number(media_IBD_S.toFixed(2)) : undefined,
      media_IREC_S: media_IREC_S ? Number(media_IREC_S.toFixed(2)) : undefined,
      media_ICOP_S: media_ICOP_S ? Number(media_ICOP_S.toFixed(2)) : undefined,
    };
  };

  // Hook para estatísticas
  const useEstatisticasCampanha = (campanhaId?: string) => {
    return useQuery({
      queryKey: ["psicossocial-estatisticas", campanhaId],
      queryFn: () => calcularEstatisticas(campanhaId!),
      enabled: !!campanhaId,
    });
  };

  // ==================== FUNÇÕES PÚBLICAS (SEM AUTH) ====================

  // Buscar convite por token (público)
  const buscarConvitePorToken = async (token: string): Promise<ConvitePsicossocial & { campanha: CampanhaPsicossocial } | null> => {
    const { data, error } = await supabase
      .from("questionario_psicossocial_convites")
      .select(`
        *,
        campanha:questionario_psicossocial_campanhas(*)
      `)
      .eq("token", token.toUpperCase())
      .single();

    if (error) return null;
    return data as ConvitePsicossocial & { campanha: CampanhaPsicossocial };
  };

  // Atualizar status do convite (público)
  const atualizarConvitePublico = async (token: string, status: ConvitePsicossocial['status']) => {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'iniciado') {
      updateData.iniciado_em = new Date().toISOString();
    } else if (status === 'concluido') {
      updateData.concluido_em = new Date().toISOString();
    }

    const { error } = await supabase
      .from("questionario_psicossocial_convites")
      .update(updateData)
      .eq("token", token.toUpperCase());

    if (error) throw error;
  };

  // Salvar resposta (público)
  const salvarRespostaPublica = async (
    convite: ConvitePsicossocial,
    respostas: Record<string, number>,
    tempoSegundos: number
  ): Promise<void> => {
    // Calcular indicadores
    const indicadores = calcularIndicadores(respostas);

    const insertData = {
      tenant_id: convite.tenant_id,
      campanha_id: convite.campanha_id,
      convite_id: convite.id,
      colaborador_id: convite.colaborador_id,
      respostas: JSON.parse(JSON.stringify(respostas)),
      indicadores: JSON.parse(JSON.stringify(indicadores)),
      tempo_resposta_segundos: tempoSegundos,
      user_agent: navigator.userAgent,
      concluido_em: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("questionario_psicossocial_respostas")
      .insert([insertData]);

    if (error) throw error;

    // Atualizar status do convite
    await atualizarConvitePublico(convite.token, 'concluido');
  };

  // ==================== STATS GERAIS ====================

  const campanhasAtivas = campanhas.filter(c => c.status === 'ativa').length;

  return {
    // Campanhas
    campanhas,
    campanhasAtivas,
    isLoadingCampanhas,
    refetchCampanhas,
    criarCampanha,
    atualizarStatusCampanha,

    // Convites
    useConvitesCampanha,
    gerarConvites,

    // Respostas
    useRespostasCampanha,

    // Estatísticas
    useEstatisticasCampanha,

    // Funções públicas
    buscarConvitePorToken,
    atualizarConvitePublico,
    salvarRespostaPublica,
    calcularIndicadores,
  };
}
