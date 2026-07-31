import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Periodicidade } from '@/lib/youreyes-modulos';

export interface YourEyesDocumento {
  id: string;
  titulo: string;
  modulo: string;
  submodulo: string | null;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

export interface YourEyesAgente {
  id: string;
  nome: string;
  emoji: string;
  descricao: string | null;
  modulo: string | null;
  documento_ids: string[];
  ativo: boolean;
  periodicidade: Periodicidade;
  dias_semana: number[];
  dia_mes: number | null;
  horario: string;
  proxima_execucao: string | null;
  ultima_execucao: string | null;
  ultimo_status: string | null;
  created_at: string;
}

export interface YourEyesPasso {
  titulo: string;
  status: 'ok' | 'falha' | 'atencao' | 'manual';
  detalhes: string;
}

export interface YourEyesExecucao {
  id: string;
  agente_id: string;
  origem: 'manual' | 'agendada';
  status: 'executando' | 'sucesso' | 'atencao' | 'falha';
  score: number | null;
  resumo: string | null;
  resultado: {
    passos?: YourEyesPasso[];
    recomendacoes?: string[];
    varredura?: {
      total_findings: number;
      criticos: number;
      altos: number;
      medios: number;
      baixos: number;
      info: number;
    } | null;
  } | null;
  iniciado_em: string;
  finalizado_em: string | null;
}

export interface DocumentoInput {
  titulo: string;
  modulo: string;
  submodulo?: string | null;
  conteudo: string;
}

export interface AgenteInput {
  nome: string;
  emoji: string;
  descricao?: string | null;
  modulo?: string | null;
  documento_ids: string[];
  ativo: boolean;
  periodicidade: Periodicidade;
  dias_semana: number[];
  dia_mes?: number | null;
  horario: string;
}

const db = supabase as any;

export function useYourEyes() {
  const queryClient = useQueryClient();
  const { isSuperAdmin, user } = useAuthContext();

  const invalidate = (key: string) =>
    queryClient.invalidateQueries({ queryKey: ['youreyes', key] });

  // ═══ Documentos ═══
  const { data: documentos = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['youreyes', 'documentos'],
    queryFn: async (): Promise<YourEyesDocumento[]> => {
      const { data, error } = await db
        .from('youreyes_documentos')
        .select('*')
        .order('modulo')
        .order('titulo');
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const salvarDocumento = useMutation({
    mutationFn: async ({ id, ...doc }: DocumentoInput & { id?: string }) => {
      if (id) {
        const { error } = await db.from('youreyes_documentos').update(doc).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('youreyes_documentos')
          .insert({ ...doc, criado_por: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate('documentos'),
  });

  const excluirDocumento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('youreyes_documentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('documentos');
      invalidate('agentes');
    },
  });

  // ═══ Agentes ═══
  const { data: agentes = [], isLoading: isLoadingAgentes } = useQuery({
    queryKey: ['youreyes', 'agentes'],
    queryFn: async (): Promise<YourEyesAgente[]> => {
      const { data, error } = await db
        .from('youreyes_agentes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  const salvarAgente = useMutation({
    mutationFn: async ({ id, ...agente }: AgenteInput & { id?: string }) => {
      if (id) {
        const { error } = await db.from('youreyes_agentes').update(agente).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('youreyes_agentes')
          .insert({ ...agente, criado_por: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate('agentes'),
  });

  const alternarAgente = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await db.from('youreyes_agentes').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate('agentes'),
  });

  const excluirAgente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('youreyes_agentes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate('agentes');
      invalidate('execucoes');
    },
  });

  const executarAgente = useMutation({
    mutationFn: async (agenteId: string) => {
      const { data, error } = await supabase.functions.invoke('youreyes-run-agent', {
        body: { agente_id: agenteId, origem: 'manual' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      invalidate('agentes');
      invalidate('execucoes');
    },
  });

  // ═══ Execuções ═══
  const { data: execucoes = [], isLoading: isLoadingExecucoes } = useQuery({
    queryKey: ['youreyes', 'execucoes'],
    queryFn: async (): Promise<YourEyesExecucao[]> => {
      const { data, error } = await db
        .from('youreyes_execucoes')
        .select('*')
        .order('iniciado_em', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  return {
    documentos,
    agentes,
    execucoes,
    isLoading: isLoadingDocs || isLoadingAgentes,
    isLoadingExecucoes,

    salvarDocumento: salvarDocumento.mutateAsync,
    excluirDocumento: excluirDocumento.mutateAsync,
    isSalvandoDocumento: salvarDocumento.isPending,

    salvarAgente: salvarAgente.mutateAsync,
    alternarAgente: alternarAgente.mutateAsync,
    excluirAgente: excluirAgente.mutateAsync,
    executarAgente: executarAgente.mutateAsync,
    isSalvandoAgente: salvarAgente.isPending,
    executandoAgenteId: executarAgente.isPending ? executarAgente.variables : null,
  };
}
