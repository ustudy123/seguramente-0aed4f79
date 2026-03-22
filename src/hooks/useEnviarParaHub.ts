import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EnvioHubData {
  tipo: string;
  competencia?: string;
  descricao?: string;
  colaborador_nome?: string;
  colaborador_cpf?: string;
  direcao?: "enviado" | "recebido";
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  arquivo_tamanho?: number | null;
}

// Mapeamento dos tipos legados para os novos tipos de processo
const TIPO_MAP: Record<string, string> = {
  "Férias": "ferias",
  "ferias": "ferias",
  "Admissão": "admissao",
  "admissao": "admissao",
  "Rescisão": "demissao",
  "rescisao": "demissao",
  "demissao": "demissao",
  "Advertência": "advertencia",
  "advertencia": "advertencia",
  "Holerite": "ponto_folha",
  "holerite": "ponto_folha",
  "Folha": "ponto_folha",
  "folha": "ponto_folha",
  "Atestado": "atestado_afastamento",
  "atestado": "atestado_afastamento",
  "Contrato de Experiência": "ponto_folha",
  "contrato_experiencia": "ponto_folha",
};

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
    const tipoProcesso = TIPO_MAP[data.tipo] || "solicitacao_geral";

    try {
      // Criar processo no novo hub
      const titulo = [data.tipo, data.colaborador_nome].filter(Boolean).join(" — ");
      
      const { data: processo, error: procError } = await supabase
        .from("hub_processos")
        .insert({
          tenant_id: tenantId,
          tipo: tipoProcesso as any,
          titulo,
          descricao: data.descricao || null,
          colaborador_nome: data.colaborador_nome || null,
          colaborador_cpf: data.colaborador_cpf || null,
          competencia,
          status: data.direcao === "recebido" ? "documentos_devolvidos" : "pronto_para_envio",
          gerado_automaticamente: true,
          origem_modulo: data.tipo,
          enviado_por: profile?.nome_completo || user.email,
        } as any)
        .select()
        .single();

      if (procError) {
        console.error("Erro ao criar processo no Hub Contábil:", procError);
        return;
      }

      // Se tem arquivo, registrar como documento do processo
      if (processo && data.arquivo_url) {
        await supabase.from("hub_processo_documentos").insert({
          tenant_id: tenantId,
          processo_id: processo.id,
          tipo: "outros" as any,
          nome: data.arquivo_nome || data.tipo,
          origem: data.direcao === "recebido" ? "devolutiva_contabilidade" : "sistema_automatico",
          arquivo_url: data.arquivo_url,
          arquivo_nome: data.arquivo_nome,
          arquivo_tamanho: data.arquivo_tamanho,
          status: "recebido",
          enviado_por: profile?.nome_completo || user.email,
        } as any);
      }

      // Registrar no histórico (tabela legada mantida para compatibilidade)
      await supabase.from("hub_historico").insert({
        tenant_id: tenantId,
        competencia,
        acao: data.direcao === "recebido" ? "recebido" : "enviado",
        tipo_documento: data.tipo,
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email,
        perfil: "rh",
        descricao: `${data.tipo} ${data.direcao === "recebido" ? "recebido" : "enviado"} automaticamente${data.colaborador_nome ? ` — ${data.colaborador_nome}` : ""}`,
      } as any);

      toast.success("Processo registrado no Hub Contábil", { duration: 2000 });
    } catch (err) {
      console.error("Erro ao enviar para Hub:", err);
    }
  }, [tenantId, user, profile]);

  return { enviarParaHub };
}
