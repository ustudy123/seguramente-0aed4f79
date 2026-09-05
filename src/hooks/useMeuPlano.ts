import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface MeuPlanoModulo {
  key: string;
  name: string;
  category: string | null;
  disponivel: boolean;
}

export interface MeuPlanoAddon {
  feature_key: string;
  name: string;
  kind: 'module' | 'life';
  quantity: number;
  unit_price_cents: number;
  mp_status?: string;
}

export interface MeuPlanoAddonPendente {
  id: string;
  feature_key: string;
  name: string;
  kind: 'module' | 'life';
  quantity: number;
  unit_price_cents: number;
  proporcional_cents: number | null;
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
  precos: Record<string, number>; // feature_key -> centavos (itens contratáveis)
  addons: MeuPlanoAddon[];
  addons_pendentes: MeuPlanoAddonPendente[];
  valores: { base_cents: number | null; addons_cents: number; total_cents: number | null };
}

// Lê o resumo do plano e expõe as ações de contratar/cancelar add-ons.
// Contratar registra a contratação (pendente) e leva o cliente ao checkout
// do Mercado Pago: o módulo/vidas só liberam quando o pagamento é confirmado.
export function useMeuPlano() {
  const queryClient = useQueryClient();
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

  // Contratar: 1) registra pendente (RPC devolve o id), 2) monta a cobrança
  // no MP (edge function) e 3) redireciona o cliente ao checkout.
  const contratarMutation = useMutation({
    mutationFn: async ({ featureKey, quantity }: { featureKey: string; quantity?: number }) => {
      const { data: addonId, error } = await (supabase as any).rpc('my_contratar_addon', {
        _feature_key: featureKey,
        _quantity: quantity ?? 1,
      });
      if (error) throw error;

      const { data: checkout, error: fnErr } = await supabase.functions.invoke(
        'mercadopago-addon-checkout',
        { body: { addon_id: addonId, origin: window.location.origin } },
      );
      if (fnErr) throw fnErr;
      if (!checkout?.checkout_url) {
        throw new Error('Não foi possível iniciar o pagamento do add-on.');
      }
      return checkout.checkout_url as string;
    },
    onSuccess: (checkoutUrl) => {
      // leva o cliente ao Mercado Pago para pagar (proporcional) e autorizar
      // a assinatura mensal. O efeito libera quando o webhook confirmar.
      window.location.href = checkoutUrl;
    },
  });

  // Cancelar: a edge function encerra a assinatura mensal no MP e remove o
  // efeito no motor (chamando my_cancelar_addon por dentro).
  const cancelarMutation = useMutation({
    mutationFn: async (featureKey: string) => {
      const { error } = await supabase.functions.invoke('mercadopago-addon-cancel', {
        body: { feature_key: featureKey },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meu-plano'] }),
  });

  return {
    plano: data ?? null,
    isLoading,
    isError,
    contratar: contratarMutation.mutateAsync,
    cancelar: cancelarMutation.mutateAsync,
    isMutating: contratarMutation.isPending || cancelarMutation.isPending,
  };
}
