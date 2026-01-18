import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tenant } from '@/types/database';
import { useAuth } from './useAuth';

export function useTenant() {
  const { tenantId, isAuthenticated } = useAuth();

  const { data: tenant, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async (): Promise<Tenant | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isAuthenticated && !!tenantId,
  });

  return {
    tenant,
    tenantId,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
