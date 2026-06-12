import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { normalizarNomeFator, type Sev15 } from "@/lib/groPsicossocial15";

/**
 * Catálogo de severidades fixas dos riscos psicossociais.
 * A severidade de cada fator é uma ATRIBUIÇÃO do catálogo
 * (psicossocial_riscos.severidade, 1-5) — não deriva das respostas.
 * Retorna um Map de nome normalizado → severidade.
 */
export function useSeveridadesCatalogo() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ["psicossocial_riscos_severidades", tenantId],
    queryFn: async () => {
      const { data, error } = await fromTable("psicossocial_riscos")
        .select("nome, severidade")
        .eq("tenant_id", tenantId!)
        .eq("padrao", true);
      if (error) throw error;
      const mapa = new Map<string, Sev15>();
      for (const r of (data || []) as Array<{ nome: string; severidade: number | null }>) {
        if (r.nome && r.severidade && r.severidade >= 1 && r.severidade <= 5) {
          mapa.set(normalizarNomeFator(r.nome), r.severidade as Sev15);
        }
      }
      return mapa;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}
