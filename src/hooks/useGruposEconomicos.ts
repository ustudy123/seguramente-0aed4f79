import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import { handleMutationError } from '@/lib/toastError';

export interface GrupoEconomico {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  logo_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useGruposEconomicos() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['grupos_economicos', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grupos_economicos')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('nome');
      if (error) throw error;
      return data as GrupoEconomico[];
    },
    enabled: !!tenantId,
  });

  const createGrupo = useMutation({
    mutationFn: async (payload: { nome: string; descricao?: string }) => {
      const { data, error } = await supabase
        .from('grupos_economicos')
        .insert({ ...payload, tenant_id: tenantId! } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos_economicos'] });
      toast.success('Grupo econômico criado!');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const updateGrupo = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; nome?: string; descricao?: string; ativo?: boolean }) => {
      const { error } = await supabase
        .from('grupos_economicos')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos_economicos'] });
      toast.success('Grupo atualizado!');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const deleteGrupo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('grupos_economicos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos_economicos'] });
      toast.success('Grupo removido!');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return { grupos, isLoading, createGrupo, updateGrupo, deleteGrupo };
}
