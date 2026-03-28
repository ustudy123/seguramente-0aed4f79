import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface HubProcesso {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  contabilidade_id: string | null;
  codigo: string;
  tipo: string;
  status: string;
  prioridade: string;
  titulo: string;
  descricao: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  colaborador_cpf: string | null;
  colaborador_matricula: string | null;
  competencia: string | null;
  data_referencia: string | null;
  data_limite: string | null;
  origem_modulo: string | null;
  origem_registro_id: string | null;
  origem_descricao: string | null;
  gerado_automaticamente: boolean;
  enviado_em: string | null;
  enviado_por: string | null;
  recebido_em: string | null;
  processado_em: string | null;
  concluido_em: string | null;
  sla_horas: number | null;
  sla_vencimento: string | null;
  sla_status: string | null;
  protocolo_externo: string | null;
  created_at: string;
  updated_at: string;
}

export interface HubProcessoDocumento {
  id: string;
  processo_id: string;
  tipo: string;
  nome: string;
  descricao: string | null;
  origem: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  versao: number;
  eh_versao_final: boolean;
  eh_obrigatorio: boolean;
  status: string;
  requer_assinatura: boolean;
  assinatura_status: string | null;
  enviado_por: string | null;
  created_at: string;
}

export interface HubProcessoComentario {
  id: string;
  processo_id: string;
  autor_nome: string;
  autor_perfil: string;
  conteudo: string;
  eh_interno: boolean;
  eh_pendencia: boolean;
  pendencia_resolvida: boolean;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  created_at: string;
}

export interface HubProcessoHistorico {
  id: string;
  processo_id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  usuario_nome: string | null;
  perfil: string | null;
  descricao: string | null;
  created_at: string;
}

export interface HubContabilidade {
  id: string;
  nome: string;
  email_principal: string | null;
  responsavel_nome: string | null;
  ativo: boolean;
}

export function useHubProcessos() {
  const { user, profile } = useAuthContext();
  const [processos, setProcessos] = useState<HubProcesso[]>([]);
  const [contabilidades, setContabilidades] = useState<HubContabilidade[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = profile?.tenant_id;

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [procRes, contRes] = await Promise.all([
        supabase
          .from("hub_processos")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("hub_contabilidades")
          .select("id, nome, email_principal, responsavel_nome, ativo")
          .eq("tenant_id", tenantId)
          .eq("ativo", true),
      ]);
      if (procRes.data) setProcessos(procRes.data as unknown as HubProcesso[]);
      if (contRes.data) setContabilidades(contRes.data as unknown as HubContabilidade[]);
    } catch (err) {
      console.error("Erro ao carregar Hub Contábil:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const criarProcesso = async (data: Partial<HubProcesso>) => {
    if (!tenantId) return null;
    const { data: created, error } = await supabase
      .from("hub_processos")
      .insert({ tenant_id: tenantId, ...data } as any)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar processo: " + error.message); return null; }
    toast.success("Processo criado!");
    fetchAll();
    return created;
  };

  const atualizarStatus = async (id: string, status: string, dados?: Partial<HubProcesso>) => {
    const { error } = await supabase
      .from("hub_processos")
      .update({ status, ...dados } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };

  const adicionarDocumento = async (processoId: string, data: Partial<HubProcessoDocumento>) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from("hub_processo_documentos")
      .insert({ tenant_id: tenantId, processo_id: processoId, ...data } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento adicionado!");
  };

  const adicionarComentario = async (processoId: string, data: Partial<HubProcessoComentario>) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from("hub_processo_comentarios")
      .insert({
        tenant_id: tenantId,
        processo_id: processoId,
        autor_nome: profile?.nome_completo || user?.email || "Usuário",
        ...data,
      } as any);
    if (error) { toast.error(error.message); return; }
  };

  return {
    processos, contabilidades, loading,
    criarProcesso, atualizarStatus, adicionarDocumento, adicionarComentario,
    fetchAll,
  };
}

export function useHubProcessoDetalhe(processoId: string | null) {
  const { profile } = useAuthContext();
  const [processo, setProcesso] = useState<HubProcesso | null>(null);
  const [documentos, setDocumentos] = useState<HubProcessoDocumento[]>([]);
  const [comentarios, setComentarios] = useState<HubProcessoComentario[]>([]);
  const [historico, setHistorico] = useState<HubProcessoHistorico[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const tenantId = profile?.tenant_id;

  const fetchDetalhe = useCallback(async () => {
    if (!processoId || !tenantId) return;
    setLoading(true);
    try {
      const [pRes, dRes, cRes, hRes, ckRes] = await Promise.all([
        supabase.from("hub_processos").select("*").eq("id", processoId).single(),
        supabase.from("hub_processo_documentos").select("*").eq("processo_id", processoId).order("created_at"),
        supabase.from("hub_processo_comentarios").select("*").eq("processo_id", processoId).order("created_at"),
        supabase.from("hub_processo_historico").select("*").eq("processo_id", processoId).order("created_at", { ascending: false }),
        supabase.from("hub_processo_checklist").select("*").eq("processo_id", processoId).order("ordem"),
      ]);
      if (pRes.data) setProcesso(pRes.data as unknown as HubProcesso);
      if (dRes.data) setDocumentos(dRes.data as unknown as HubProcessoDocumento[]);
      if (cRes.data) setComentarios(cRes.data as unknown as HubProcessoComentario[]);
      if (hRes.data) setHistorico(hRes.data as unknown as HubProcessoHistorico[]);
      if (ckRes.data) setChecklist(ckRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [processoId, tenantId]);

  useEffect(() => { fetchDetalhe(); }, [fetchDetalhe]);

  return { processo, documentos, comentarios, historico, checklist, loading, refetch: fetchDetalhe };
}
