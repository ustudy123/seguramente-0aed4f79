import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePublic } from "@/lib/supabasePublic";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import {
  BLOCOS_PSICOSSOCIAL,
  BLOCOS_DINAMICOS,
  type CampanhaPsicossocial,
  type ConvitePsicossocial,
  type RespostaPsicossocial,
  type NovaCampanha,
  type GerarConvitesInput,
  type EstatisticasCampanha,
  type IndicadoresPsicossociais,
} from "@/types/psicossocial";

// Gerar token único
function gerarToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

// Calcular indicadores a partir das respostas (escala 0-4)
export function calcularIndicadores(
  respostas: Record<string, number>,
  blocosDinamicos?: string[]
): IndicadoresPsicossociais {
  const blocos = BLOCOS_PSICOSSOCIAL;
  const blocosDinamicosConfig = BLOCOS_DINAMICOS;
  
  // Calcular média por bloco (escala 0-4)
  const mediasPorBloco: { bloco: string; media: number; nivel: 'baixo' | 'moderado' | 'alto' | 'critico' }[] = [];
  
  for (const bloco of blocos) {
    const valoresBloco = bloco.perguntas.map(p => {
      const valor = respostas[p.id] ?? 2; // Default neutro (meio da escala 0-4)
      // Inverter se necessário (para perguntas positivas, maior = melhor)
      return p.invertida ? (4 - valor) : valor;
    });
    
    const media = valoresBloco.length > 0 
      ? valoresBloco.reduce((a, b) => a + b, 0) / valoresBloco.length 
      : 2;
    
    // Níveis ajustados para escala 0-4
    let nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
    if (media <= 1) nivel = 'baixo';
    else if (media <= 2) nivel = 'moderado';
    else if (media <= 3) nivel = 'alto';
    else nivel = 'critico';
    
    mediasPorBloco.push({ bloco: bloco.titulo, media, nivel });
  }
  
  // IRP-S: Índice Risco Psicossocial (média geral dos blocos 1-6)
  const blocosRisco = mediasPorBloco.slice(0, 6);
  const IRP_S = blocosRisco.length > 0 
    ? blocosRisco.reduce((a, b) => a + b.media, 0) / blocosRisco.length 
    : 2;
  
  // IBO-S: Índice Burnout (blocos 1, 2, 3 - sobrecarga + exaustão)
  const blocosBurnout = mediasPorBloco.slice(0, 3);
  const IBO_S = blocosBurnout.length > 0 
    ? blocosBurnout.reduce((a, b) => a + b.media, 0) / blocosBurnout.length 
    : 2;
  
  // IBD-S: Índice Boreout (blocos 4, 5, 8 invertidos - falta autonomia, clareza, engajamento)
  const blocosBoreout = [mediasPorBloco[3], mediasPorBloco[4], mediasPorBloco[7]].filter(Boolean);
  const IBD_S = blocosBoreout.length > 0 
    ? 4 - (blocosBoreout.reduce((a, b) => a + b.media, 0) / blocosBoreout.length)
    : 2;
  
  // IREC-S: Índice Recuperação (bloco 9)
  const IREC_S = mediasPorBloco[8]?.media ?? 2;
  
  // ICOP-S: Índice Clareza Organizacional (blocos 5, 6)
  const blocosClareza = [mediasPorBloco[4], mediasPorBloco[5]].filter(Boolean);
  const ICOP_S = blocosClareza.length > 0 
    ? 4 - (blocosClareza.reduce((a, b) => a + b.media, 0) / blocosClareza.length)
    : 2;
  
  // INOT-S: Índice de Risco do Trabalho Noturno (calculado se bloco dinâmico ativo)
  let INOT_S: number | undefined;
  
  if (blocosDinamicos?.includes('cet_noturno')) {
    const blocoNoturno = blocosDinamicosConfig.find((b: typeof blocosDinamicosConfig[0]) => b.id === 'cet_noturno');
    
    if (blocoNoturno) {
      const valoresNoturno = blocoNoturno.perguntas.map((p: typeof blocoNoturno.perguntas[0]) => {
        const valor = respostas[p.id] ?? 2;
        return p.invertida ? (4 - valor) : valor;
      });
      
      const mediaNoturno = valoresNoturno.length > 0
        ? valoresNoturno.reduce((a: number, b: number) => a + b, 0) / valoresNoturno.length
        : 2;
      
      // Determinar nível do bloco noturno
      let nivelNoturno: 'baixo' | 'moderado' | 'alto' | 'critico';
      if (mediaNoturno <= 1) nivelNoturno = 'baixo';
      else if (mediaNoturno <= 2) nivelNoturno = 'moderado';
      else if (mediaNoturno <= 3) nivelNoturno = 'alto';
      else nivelNoturno = 'critico';
      
      mediasPorBloco.push({ 
        bloco: blocoNoturno.titulo, 
        media: mediaNoturno, 
        nivel: nivelNoturno 
      });
      
      // Peso adicional automático conforme especificação:
      // Correlação com demandas cognitivas, recuperação e sinais precoces
      const pesoCognitivo = mediasPorBloco[1]?.media ?? 2; // Bloco 2
      const pesoRecuperacao = mediasPorBloco[8]?.media ?? 2; // Bloco 9
      const pesoSinais = mediasPorBloco[9]?.media ?? 2; // Bloco 10
      
      INOT_S = (mediaNoturno * 0.4) + (pesoCognitivo * 0.2) + (pesoRecuperacao * 0.2) + (pesoSinais * 0.2);
    }
  }
  
  const resultado: IndicadoresPsicossociais = {
    IRP_S: Number(IRP_S.toFixed(2)),
    IBO_S: Number(IBO_S.toFixed(2)),
    IBD_S: Number(IBD_S.toFixed(2)),
    IREC_S: Number(IREC_S.toFixed(2)),
    ICOP_S: Number(ICOP_S.toFixed(2)),
    detalhes: mediasPorBloco,
  };
  
  if (INOT_S !== undefined) {
    resultado.INOT_S = Number(INOT_S.toFixed(2));
  }
  
  return resultado;
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
      return (data || []).map(c => ({ ...c, radar_data: c.radar_data as unknown as RadarDimensao[] | undefined })) as CampanhaPsicossocial[];
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
          tipo: dados.tipo || 'regular',
          periodicidade: dados.periodicidade,
          data_inicio: dados.data_inicio,
          data_fim: dados.data_fim,
          anonimo: dados.anonimo,
          permite_identificacao_voluntaria: dados.permite_identificacao_voluntaria ?? true,
          mensagem_institucional: dados.mensagem_institucional,
          politica_uso_dados: dados.politica_uso_dados,
          departamentos_ids: dados.departamentos_ids,
          cargos_ids: dados.cargos_ids,
          blocos_dinamicos: dados.blocos_dinamicos,
          motivo_extraordinaria: dados.motivo_extraordinaria,
          evento_gatilho_tipo: dados.evento_gatilho_tipo,
          evento_gatilho_id: dados.evento_gatilho_id,
          campanha_anterior_id: dados.campanha_anterior_id,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
          status: 'rascunho',
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, radar_data: (data as any).radar_data as unknown as RadarDimensao[] | undefined } as CampanhaPsicossocial;
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
    let media_IRP_S, media_IBO_S, media_IBD_S, media_IREC_S, media_ICOP_S, media_INOT_S;

    if (respostasComIndicadores.length > 0) {
      media_IRP_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IRP_S || 0), 0) / respostasComIndicadores.length;
      media_IBO_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IBO_S || 0), 0) / respostasComIndicadores.length;
      media_IBD_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IBD_S || 0), 0) / respostasComIndicadores.length;
      media_IREC_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.IREC_S || 0), 0) / respostasComIndicadores.length;
      media_ICOP_S = respostasComIndicadores.reduce((a, r) => a + (r.indicadores?.ICOP_S || 0), 0) / respostasComIndicadores.length;
      
      // INOT-S apenas para respostas que têm esse indicador
      const respostasComINOT = respostasComIndicadores.filter(r => r.indicadores?.INOT_S !== undefined);
      if (respostasComINOT.length > 0) {
        media_INOT_S = respostasComINOT.reduce((a, r) => a + (r.indicadores?.INOT_S || 0), 0) / respostasComINOT.length;
      }
    }

    const MINIMO_ANONIMATO = 5;
    const anonimato_garantido = concluidos >= MINIMO_ANONIMATO;

    return {
      total_convites: total,
      pendentes,
      iniciados,
      concluidos,
      expirados,
      taxa_participacao: total > 0 ? (concluidos / total) * 100 : 0,
      anonimato_garantido,
      media_IRP_S: anonimato_garantido && media_IRP_S ? Number(media_IRP_S.toFixed(2)) : undefined,
      media_IBO_S: anonimato_garantido && media_IBO_S ? Number(media_IBO_S.toFixed(2)) : undefined,
      media_IBD_S: anonimato_garantido && media_IBD_S ? Number(media_IBD_S.toFixed(2)) : undefined,
      media_IREC_S: anonimato_garantido && media_IREC_S ? Number(media_IREC_S.toFixed(2)) : undefined,
      media_ICOP_S: anonimato_garantido && media_ICOP_S ? Number(media_ICOP_S.toFixed(2)) : undefined,
      media_INOT_S: anonimato_garantido && media_INOT_S ? Number(media_INOT_S.toFixed(2)) : undefined,
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
  // Usam supabasePublic para evitar conflito de RLS com usuário logado

  // Buscar convite por token (público) - via security definer function
  const buscarConvitePorToken = async (token: string): Promise<ConvitePsicossocial & { campanha: CampanhaPsicossocial } | null> => {
    const { data, error } = await supabasePublic
      .rpc('buscar_convite_por_token', { p_token: token });

    if (error || !data || data.length === 0) return null;
    
    const row = data[0];
    // Reconstruct the nested shape expected by consumers
    const convite = {
      id: row.id,
      tenant_id: row.tenant_id,
      campanha_id: row.campanha_id,
      colaborador_id: row.colaborador_id,
      colaborador_nome: row.colaborador_nome,
      colaborador_cpf: row.colaborador_cpf,
      colaborador_cargo: row.colaborador_cargo,
      colaborador_departamento: row.colaborador_departamento,
      token: row.token,
      status: row.status,
      enviado_via: row.enviado_via,
      enviado_em: row.enviado_em,
      iniciado_em: row.iniciado_em,
      concluido_em: row.concluido_em,
      created_at: row.created_at,
      campanha: {
        id: row.campanha_id,
        nome: row.campanha_nome,
        descricao: row.campanha_descricao,
        tipo: row.campanha_tipo,
        status: row.campanha_status,
        data_inicio: row.campanha_data_inicio,
        data_fim: row.campanha_data_fim,
        anonimo: row.campanha_anonimo,
        permite_identificacao_voluntaria: row.campanha_permite_identificacao_voluntaria,
        mensagem_institucional: row.campanha_mensagem_institucional,
        politica_uso_dados: row.campanha_politica_uso_dados,
        blocos_dinamicos: row.campanha_blocos_dinamicos,
      } as CampanhaPsicossocial,
    } as ConvitePsicossocial & { campanha: CampanhaPsicossocial };

    return convite;
  };

  // Atualizar status do convite (público) - via security definer function
  const atualizarConvitePublico = async (token: string, status: ConvitePsicossocial['status']) => {
    const { error } = await supabasePublic
      .rpc('atualizar_convite_por_token', { p_token: token, p_status: status });

    if (error) throw error;
  };

  // Salvar resposta (público) - via security definer function
  const salvarRespostaPublica = async (
    convite: ConvitePsicossocial & { campanha?: CampanhaPsicossocial },
    respostas: Record<string, number>,
    tempoSegundos: number,
    identificacaoVoluntaria: boolean = false
  ): Promise<void> => {
    const blocosDinamicos = convite.campanha?.blocos_dinamicos || [];
    const indicadores = calcularIndicadores(respostas, blocosDinamicos);

    const { error } = await supabasePublic
      .rpc('salvar_resposta_psicossocial', {
        p_token: convite.token,
        p_respostas: JSON.parse(JSON.stringify(respostas)),
        p_indicadores: JSON.parse(JSON.stringify(indicadores)),
        p_identificacao_voluntaria: identificacaoVoluntaria,
        p_tempo_segundos: tempoSegundos,
        p_user_agent: navigator.userAgent,
      });

    if (error) throw error;
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
