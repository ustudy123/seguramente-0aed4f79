import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface MeuPlanoModulo {
  key: string;
  name: string;
  category: string | null;
  disponivel: boolean;
}

export interface MeuPlano {
  plano: { code: string; name: string; is_public: boolean } | null;
  vidas: {
    used: number;
    limit: number | null;
    is_unlimited: boolean;
    remaining: number | null;
    percent: number | null;
  };
  modulos: MeuPlanoModulo[];
}

// Lê, de uma vez, o resumo do plano da empresa logada (plano atual, uso ×
// limite de vidas, módulos disponíveis × bloqueados) via entitlement_my_plan().
export function useMeuPlano() {
  const { user } = useAuthContext();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['meu-plano'],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<MeuPlano | null> => {
      const { data, error } = await (supabase as any).rpc('entitlement_my_plan');
      if (error) throw error;
      return (data as MeuPlano) ?? null;
    },
  });

  return { plano: data ?? null, isLoading, isError };
}
