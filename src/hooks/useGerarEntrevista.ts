import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

/**
 * Gera um token público de entrevista guiada anônima para uma campanha.
 * Cria 1 linha em `psicossocial_entrevistas` e devolve a URL pública.
 */
export function useGerarEntrevista() {
  const { user } = useAuthContext();
  const { empresaAtivaId } = useEmpresaAtiva();

  return useMutation({
    mutationFn: async ({
      campanhaId,
      modalidade = "texto",
      grupoNome,
      participantesPrevistos,
    }: {
      campanhaId: string;
      modalidade?: "texto" | "voz";
      /** Sessão COLETIVA (Workshop): nome do grupo/GHE reunido. */
      grupoNome?: string;
      /** Sessão COLETIVA (Workshop): nº de participantes presentes. */
      participantesPrevistos?: number;
    }) => {
      if (!user) throw new Error("Não autenticado");
      const tenantId = (
        await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single()
      ).data?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data, error } = await fromTable("psicossocial_entrevistas")
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          campanha_id: campanhaId,
          token,
          modalidade,
          status: "pendente",
          // Workshop (entrevista coletiva): registra o grupo e o nº de
          // participantes; o nome do grupo aparece na listagem no lugar do
          // colaborador individual.
          ...(grupoNome
            ? {
                tipo_sessao: "coletiva",
                grupo_nome: grupoNome,
                participantes_previstos: participantesPrevistos ?? null,
                colaborador_nome: grupoNome,
              }
            : {}),
        } as any)
        .select("id, token")
        .single();

      if (error) throw error;

      const url = `${window.location.origin}/entrevista/${(data as any).token}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard pode falhar em contextos não-seguros */
      }
      return { url, id: (data as any).id, token: (data as any).token };
    },
    onSuccess: ({ url }) => {
      toast.success("Link de entrevista gerado e copiado", { description: url });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao gerar entrevista"),
  });
}
