import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

/**
 * Componente invisível que detecta férias aprovadas
 * e cria automaticamente processos no Hub Contábil.
 * Deve ser renderizado uma vez no HubContabil.tsx.
 */
export function HubFeriasIntegracao() {
  const { user, profile } = useAuthContext();
  const tenantId = profile?.tenant_id;

  useEffect(() => {
    if (!tenantId || !user) return;

    // Subscribe to férias aprovadas
    const channel = supabase
      .channel("hub-ferias-watch")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ferias",
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          const nova = payload.new as any;
          const anterior = payload.old as any;

          // Só processa quando o status muda para aprovado
          if (nova.status !== "aprovado" || anterior.status === "aprovado") return;

          // Verifica se já existe processo para estas férias
          const { data: existente } = await supabase
            .from("hub_processos")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("origem_modulo", "ferias")
            .eq("origem_registro_id", nova.id)
            .maybeSingle();

          if (existente) return; // Já existe, não duplicar

          // Cria processo automaticamente
          await supabase.from("hub_processos").insert({
            tenant_id: tenantId,
            tipo: "ferias",
            titulo: `Férias — ${nova.colaborador_nome || "Colaborador"}`,
            descricao: nova.periodo_aquisitivo
              ? `Período aquisitivo: ${nova.periodo_aquisitivo}. Início: ${nova.data_inicio || "—"}. Fim: ${nova.data_fim || "—"}`
              : null,
            colaborador_nome: nova.colaborador_nome || null,
            colaborador_cpf: nova.colaborador_cpf || null,
            competencia: nova.data_inicio
              ? nova.data_inicio.substring(0, 7)
              : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
            status: "pronto_para_envio",
            prioridade: "normal",
            gerado_automaticamente: true,
            origem_modulo: "ferias",
            origem_registro_id: nova.id,
            origem_descricao: "Férias aprovadas automaticamente",
            enviado_por: profile?.nome_completo || user.email,
          } as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, user, profile]);

  return null; // Componente invisível
}
