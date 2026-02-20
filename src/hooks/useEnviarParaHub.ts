import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EnvioHubData {
  tipo: string;
  competencia: string;
  descricao?: string;
  colaborador_nome?: string;
  colaborador_cpf?: string;
  direcao?: "enviado" | "recebido";
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  arquivo_tamanho?: number | null;
}

/**
 * Hook para enviar documentos ao Hub Contábil automaticamente
 * a partir de qualquer módulo do sistema (férias, admissão, rescisão, etc.)
 */
export function useEnviarParaHub() {
  const { user, profile } = useAuthContext();
  const tenantId = profile?.tenant_id;

  const enviarParaHub = useCallback(async (data: EnvioHubData) => {
    if (!tenantId || !user) return;

    const competencia = data.competencia || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    try {
      // Registrar documento no Hub
      const { error } = await supabase.from("hub_documentos").insert({
        tenant_id: tenantId,
        competencia,
        tipo: data.tipo,
        descricao: data.descricao || null,
        colaborador_nome: data.colaborador_nome || null,
        colaborador_cpf: data.colaborador_cpf || null,
        direcao: data.direcao || "enviado",
        enviado_por: profile?.nome_completo || user.email,
        arquivo_url: data.arquivo_url || null,
        arquivo_nome: data.arquivo_nome || null,
        arquivo_tamanho: data.arquivo_tamanho || null,
        status: "ativo",
        versao: 1,
      } as any);

      if (error) {
        console.error("Erro ao registrar no Hub Contábil:", error);
        return;
      }

      // Registrar no histórico
      await supabase.from("hub_historico").insert({
        tenant_id: tenantId,
        competencia,
        acao: "enviado",
        tipo_documento: data.tipo,
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email,
        perfil: "rh",
        descricao: `${data.tipo} enviado automaticamente${data.colaborador_nome ? ` — ${data.colaborador_nome}` : ""}`,
      } as any);

      toast.success("Documento registrado no Hub Contábil", { duration: 2000 });
    } catch (err) {
      console.error("Erro ao enviar para Hub:", err);
    }
  }, [tenantId, user, profile]);

  return { enviarParaHub };
}
