import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface HubCompetencia {
  id: string;
  tenant_id: string;
  competencia: string;
  status: string;
  data_envio: string | null;
  data_aprovacao: string | null;
  data_finalizacao: string | null;
  enviado_por: string | null;
  aprovado_por: string | null;
  observacoes: string | null;
  checklist: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface HubDocumento {
  id: string;
  tenant_id: string;
  competencia_id: string | null;
  competencia: string;
  tipo: string;
  descricao: string | null;
  colaborador_nome: string | null;
  colaborador_cpf: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  versao: number;
  versao_anterior_id: string | null;
  direcao: string;
  enviado_por: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
}

export interface HubGuia {
  id: string;
  tenant_id: string;
  competencia_id: string | null;
  competencia: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  comprovante_url: string | null;
  comprovante_nome: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface HubCertidao {
  id: string;
  tenant_id: string;
  tipo: string;
  orgao_emissor: string;
  numero: string | null;
  data_emissao: string;
  data_validade: string;
  status: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface HubHistorico {
  id: string;
  tenant_id: string;
  competencia: string | null;
  tipo_documento: string | null;
  documento_id: string | null;
  acao: string;
  usuario_nome: string | null;
  perfil: string | null;
  descricao: string | null;
  created_at: string;
}

export function useHubContabil() {
  const { user, profile } = useAuthContext();
  const [competencias, setCompetencias] = useState<HubCompetencia[]>([]);
  const [documentos, setDocumentos] = useState<HubDocumento[]>([]);
  const [guias, setGuias] = useState<HubGuia[]>([]);
  const [certidoes, setCertidoes] = useState<HubCertidao[]>([]);
  const [historico, setHistorico] = useState<HubHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = profile?.tenant_id;

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [compRes, docRes, guiaRes, certRes, histRes] = await Promise.all([
        supabase.from("hub_competencias").select("*").eq("tenant_id", tenantId).order("competencia", { ascending: false }),
        supabase.from("hub_documentos").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
        supabase.from("hub_guias").select("*").eq("tenant_id", tenantId).order("data_vencimento", { ascending: true }),
        supabase.from("hub_certidoes").select("*").eq("tenant_id", tenantId).order("data_validade", { ascending: true }),
        supabase.from("hub_historico").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (compRes.data) setCompetencias(compRes.data as unknown as HubCompetencia[]);
      if (docRes.data) setDocumentos(docRes.data as unknown as HubDocumento[]);
      if (guiaRes.data) setGuias(guiaRes.data as unknown as HubGuia[]);
      if (certRes.data) setCertidoes(certRes.data as unknown as HubCertidao[]);
      if (histRes.data) setHistorico(histRes.data as unknown as HubHistorico[]);
    } catch (err) {
      console.error("Erro ao carregar Hub Contábil:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const registrarHistorico = async (data: Partial<HubHistorico>) => {
    if (!tenantId || !user) return;
    await supabase.from("hub_historico").insert({
      tenant_id: tenantId,
      usuario_id: user.id,
      usuario_nome: profile?.nome_completo || user.email,
      perfil: "rh",
      ...data,
    } as any);
  };

  // Competência CRUD
  const criarCompetencia = async (competencia: string) => {
    if (!tenantId) return;
    const { error } = await supabase.from("hub_competencias").insert({
      tenant_id: tenantId,
      competencia,
      checklist: { ponto_fechado: false, eventos_confirmados: false, rescisoes_revisadas: false, ferias_calculadas: false, beneficios_atualizados: false },
    } as any);
    if (error) { toast.error("Erro ao criar competência: " + error.message); return; }
    await registrarHistorico({ competencia, acao: "criado", descricao: `Competência ${competencia} criada` });
    toast.success("Competência criada!");
    fetchAll();
  };

  const atualizarCompetencia = async (id: string, data: Partial<HubCompetencia>) => {
    const { error } = await supabase.from("hub_competencias").update(data as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico({ competencia: data.competencia || "", acao: "atualizado", descricao: `Status alterado para ${data.status}` });
    toast.success("Competência atualizada!");
    fetchAll();
  };

  // Guia CRUD
  const criarGuia = async (data: Partial<HubGuia>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("hub_guias").insert({ tenant_id: tenantId, ...data } as any);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico({ competencia: data.competencia, acao: "criado", tipo_documento: "guia", descricao: `Guia ${data.tipo} criada` });
    toast.success("Guia registrada!");
    fetchAll();
  };

  const atualizarGuia = async (id: string, data: Partial<HubGuia>) => {
    const { error } = await supabase.from("hub_guias").update(data as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Guia atualizada!");
    fetchAll();
  };

  // Certidão CRUD
  const criarCertidao = async (data: Partial<HubCertidao>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("hub_certidoes").insert({ tenant_id: tenantId, ...data } as any);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico({ acao: "criado", tipo_documento: "certidao", descricao: `Certidão ${data.tipo} registrada` });
    toast.success("Certidão registrada!");
    fetchAll();
  };

  const atualizarCertidao = async (id: string, data: Partial<HubCertidao>) => {
    const { error } = await supabase.from("hub_certidoes").update(data as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Certidão atualizada!");
    fetchAll();
  };

  // Documento CRUD
  const criarDocumento = async (data: Partial<HubDocumento>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("hub_documentos").insert({
      tenant_id: tenantId,
      enviado_por: profile?.nome_completo || user?.email,
      ...data,
    } as any);
    if (error) { toast.error(error.message); return; }
    await registrarHistorico({ competencia: data.competencia, acao: data.direcao === "recebido" ? "recebido" : "enviado", tipo_documento: data.tipo, descricao: `Documento ${data.tipo} ${data.direcao}` });
    toast.success("Documento registrado!");
    fetchAll();
  };

  return {
    competencias, documentos, guias, certidoes, historico, loading,
    criarCompetencia, atualizarCompetencia,
    criarGuia, atualizarGuia,
    criarCertidao, atualizarCertidao,
    criarDocumento,
    fetchAll,
  };
}
