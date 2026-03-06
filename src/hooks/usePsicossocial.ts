import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePublic } from "@/lib/supabasePublic";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import {
  type CampanhaPsicossocial,
  type ConvitePsicossocial,
  type RespostaPsicossocial,
  type NovaCampanha,
  type GerarConvitesInput,
  type EstatisticasCampanha,
  type IndicadoresPsicossociais,
  type RadarDimensao,
  type InstrumentoPsicossocial,
  calcularIPSClassificacao,
} from "@/types/psicossocial";
import {
  calcularIPSInstrumento,
  getDimensoesByInstrumento,
} from "@/data/instrumentos";

// Gerar token único
function gerarToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

/**
 * Calcular indicadores IPS a partir das respostas usando instrumento COPSOQ/HSE.
 * Retorna IPS 0-100 + detalhes por dimensão.
 */
export function calcularIndicadores(
  respostas: Record<string, number>,
  instrumento: InstrumentoPsicossocial = 'copsoq'
): IndicadoresPsicossociais {
  const instrumentoKey = instrumento === 'proart' || instrumento === 'customizado'
    ? 'copsoq' as const
    : instrumento as 'copsoq' | 'hse';
  const dimensoes = getDimensoesByInstrumento(instrumentoKey);
  const { ips, porDimensao } = calcularIPSInstrumento(respostas, dimensoes);
  const classificacao = calcularIPSClassificacao(ips);

  const nivelMap: Record<string, 'baixo' | 'moderado' | 'alto' | 'critico'> = {
    otimo: 'baixo',
    bom: 'moderado',
    atencao: 'alto',
    critico: 'critico',
  };

  const detalhes = dimensoes.map(dim => ({
    bloco: dim.nome,
    media: porDimensao[dim.id]?.score ?? 50,
    nivel: nivelMap[porDimensao[dim.id]?.nivel ?? 'moderado'] ?? 'moderado' as 'baixo' | 'moderado' | 'alto' | 'critico',
  }));

  const radar: RadarDimensao[] = dimensoes.map(dim => ({
    subject: dim.nome.split(' ').slice(0, 2).join(' '),
    value: porDimensao[dim.id]?.score ?? 50,
    fullMark: 100,
  }));

  return {
    IPS: ips,
    IPS_classificacao: classificacao,
    IRP_S: ips,
    IBO_S: ips,
    IBD_S: ips,
    IREC_S: ips,
    ICOP_S: ips,
    detalhes,
    radar,
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
          instrumento: dados.instrumento || 'copsoq',
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

    const MINIMO_ANONIMATO = 5;
    const anonimato_garantido = concluidos >= MINIMO_ANONIMATO;

    // IPS médio agregado (só exibido com anonimato garantido)
    const respostasComIPS = respostas.filter(r => r.indicadores?.IPS !== undefined);
    let ips: number | undefined;
    let radar: RadarDimensao[] | undefined;

    if (anonimato_garantido && respostasComIPS.length > 0) {
      ips = Math.round(
        respostasComIPS.reduce((acc, r) => acc + (r.indicadores?.IPS ?? 0), 0) / respostasComIPS.length
      );

      // Agregar radar por dimensão (média de todas respostas)
      const allRadar = respostasComIPS
        .map(r => r.indicadores?.radar)
        .filter((r): r is RadarDimensao[] => Array.isArray(r) && r.length > 0);

      if (allRadar.length > 0) {
        const subjects = allRadar[0].map(d => d.subject);
        radar = subjects.map(subject => ({
          subject,
          value: Math.round(
            allRadar.reduce((acc, r) => {
              const found = r.find(d => d.subject === subject);
              return acc + (found?.value ?? 50);
            }, 0) / allRadar.length
          ),
          fullMark: 100,
        }));
      }
    }

    return {
      total_convites: total,
      pendentes,
      iniciados,
      concluidos,
      expirados,
      taxa_participacao: total > 0 ? (concluidos / total) * 100 : 0,
      anonimato_garantido,
      ips,
      ips_classificacao: ips !== undefined ? calcularIPSClassificacao(ips) : undefined,
      radar,
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
    const instrumento = (convite.campanha?.instrumento || 'copsoq') as InstrumentoPsicossocial;
    const indicadores = calcularIndicadores(respostas, instrumento);

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
