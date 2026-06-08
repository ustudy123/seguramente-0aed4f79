import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type {
  Terceiro,
  TerceiroTrabalhador,
  TerceiroDocumento,
  TerceiroTreinamento,
} from "@/types/terceiros";

export function useTerceiros() {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  // Recalculate worker status based on expired docs/trainings
  const recalcWorkerStatus = async (trabalhadorId: string, tid: string, terceiroId: string) => {
    const today = new Date().toISOString().split("T")[0];

    // Check documents
    const { data: docs } = await fromTable("terceiro_documentos")
      .select("data_validade, status")
      .eq("tenant_id", tid)
      .eq("trabalhador_id", trabalhadorId);

    // Check trainings
    const { data: treins } = await fromTable("terceiro_treinamentos")
      .select("data_validade, status")
      .eq("tenant_id", tid)
      .eq("trabalhador_id", trabalhadorId);

    const allItems = [...(docs || []), ...(treins || [])] as { data_validade: string | null; status: string }[];

    const hasExpired = allItems.some((item) => {
      if (item.data_validade && item.data_validade < today) return true;
      if (item.status === "vencido") return true;
      return false;
    });

    const newStatus = hasExpired ? "bloqueado" : "liberado";

    await fromTable("terceiro_trabalhadores")
      .update({ status: newStatus } as any)
      .eq("id", trabalhadorId);
  };

  // ── Terceiros (empresas) ──
  const { data: terceiros = [], isLoading } = useQuery({
    queryKey: ["terceiros", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = fromTable("terceiros")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("razao_social");
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Terceiro[];
    },
    enabled: !!tenantId,
  });

  const cleanCnpj = (v?: string | null) => (v || "").replace(/\D/g, "");

  const ensureCnpjUnique = async (cnpj: string, ignoreId?: string) => {
    if (!tenantId || !cnpj) return;
    let q = fromTable("terceiros")
      .select("id, razao_social")
      .eq("tenant_id", tenantId)
      .or(`cnpj.eq.${cnpj}`)
      .limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data, error } = await q;
    if (error) throw error;
    if (data && data.length > 0) {
      const existente = (data[0] as any).razao_social || "outro prestador";
      throw new Error(`CNPJ já cadastrado para "${existente}". Não é possível duplicar.`);
    }
  };

  const createTerceiro = useMutation({
    mutationFn: async (payload: Partial<Terceiro>) => {
      if (!tenantId) throw new Error("Sem tenant");
      const doc = cleanCnpj(payload.cnpj);
      const isCpf = doc.length === 11;
      const isCnpj = doc.length === 14;

      if (!isCpf && !isCnpj) {
        throw new Error("Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
      }
      await ensureCnpjUnique(doc);
      
      // Clean dates: empty strings to null for Postgres
      const finalPayload = {
        ...payload,
        cnpj: doc,
        tenant_id: tenantId,
        empresa_id: empresaAtivaId || null,
        contrato_inicio: payload.contrato_inicio || null,
        contrato_fim: payload.contrato_fim || null,
      };

      const { data, error } = await fromTable("terceiros")
        .insert(finalPayload as any)
        .select()
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["terceiro-documentos"] }); // Invalidate docs too
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiros"] });
      toast.success("Terceiro cadastrado!");
    },
    onError: (e: any) => toast.error("Erro: " + (e.message || "Erro desconhecido")),
  });

  const updateTerceiro = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Terceiro> & { id: string }) => {
      if (payload.cnpj !== undefined) {
        const doc = cleanCnpj(payload.cnpj);
        const isCpf = doc.length === 11;
        const isCnpj = doc.length === 14;

        if (doc && !isCpf && !isCnpj) {
          throw new Error("Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
        }
        await ensureCnpjUnique(doc, id);
        payload.cnpj = doc;
      }

      // Clean dates: empty strings to null
      const finalPayload = {
        ...payload,
        contrato_inicio: payload.contrato_inicio || null,
        contrato_fim: payload.contrato_fim || null,
      };

      const { data, error } = await fromTable("terceiros")
        .update(finalPayload as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["terceiro-documentos"] });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiros"] });
      toast.success("Terceiro atualizado!");
    },
    onError: (e: any) => toast.error("Erro: " + (e.message || "Erro desconhecido")),
  });

  const deleteTerceiro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("terceiros")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiros"] });
      toast.success("Terceiro removido!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ── Trabalhadores ──
  const useTrabalhadores = (terceiroId?: string) =>
    useQuery({
      queryKey: ["terceiro-trabalhadores", terceiroId],
      queryFn: async () => {
        if (!terceiroId || !tenantId) return [];
        const { data, error } = await fromTable("terceiro_trabalhadores")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("terceiro_id", terceiroId)
          .order("nome");
        if (error) throw error;
        return data as unknown as TerceiroTrabalhador[];
      },
      enabled: !!terceiroId && !!tenantId,
    });

  const createTrabalhador = useMutation({
    mutationFn: async (payload: Partial<TerceiroTrabalhador>) => {
      if (!tenantId) throw new Error("Sem tenant");
      const { data, error } = await fromTable("terceiro_trabalhadores")
        .insert({ ...payload, tenant_id: tenantId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-trabalhadores"] });
      toast.success("Trabalhador cadastrado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteTrabalhador = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("terceiro_trabalhadores")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-trabalhadores"] });
      toast.success("Trabalhador removido!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ── Documentos ──
  const useDocumentos = (terceiroId?: string, trabalhadorId?: string) =>
    useQuery({
      queryKey: ["terceiro-documentos", terceiroId, trabalhadorId],
      queryFn: async () => {
        if (!terceiroId || !tenantId) return [];
        let q = fromTable("terceiro_documentos")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("terceiro_id", terceiroId);
        if (trabalhadorId) {
          q = q.eq("trabalhador_id", trabalhadorId);
        } else {
          q = q.is("trabalhador_id", null);
        }
        const { data, error } = await q.order("created_at", { ascending: false });
        if (error) throw error;
        return data as unknown as TerceiroDocumento[];
      },
      enabled: !!terceiroId && !!tenantId,
    });

  const uploadDocumento = useMutation({
    mutationFn: async (params: {
      file: File;
      terceiro_id: string;
      trabalhador_id?: string;
      tipo: string;
      nome: string;
      data_emissao?: string;
      data_validade?: string;
      observacoes?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");
      const ts = Date.now();
      const safeName = params.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${tenantId}/terceiros/${params.terceiro_id}/${ts}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, params.file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      // Calculate document status based on validity date
      const today = new Date().toISOString().split("T")[0];
      let docStatus = "pendente";
      if (params.data_validade) {
        if (params.data_validade < today) {
          docStatus = "vencido";
        } else {
          const diffDays = Math.ceil((new Date(params.data_validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          docStatus = diffDays <= 30 ? "a_vencer" : "valido";
        }
      }

      const { error } = await fromTable("terceiro_documentos")
        .insert({
          tenant_id: tenantId,
          terceiro_id: params.terceiro_id,
          trabalhador_id: params.trabalhador_id || null,
          tipo: params.tipo,
          nome: params.nome,
          arquivo_url: path,
          arquivo_nome: params.file.name,
          arquivo_tamanho: params.file.size,
          data_emissao: params.data_emissao || null,
          data_validade: params.data_validade || null,
          status: docStatus,
          observacoes: params.observacoes || null,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || user.email,
        } as any);
      if (error) {
        await supabase.storage.from("documentos").remove([path]);
        throw error;
      }

      // Audit log
      await fromTable("terceiro_audit_log").insert({
        tenant_id: tenantId,
        entidade_tipo: "documento",
        entidade_id: params.terceiro_id,
        acao: "criado",
        descricao: `Documento "${params.nome}" (${params.tipo}) enviado`,
        dados_novos: { tipo: params.tipo, nome: params.nome, arquivo: params.file.name },
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email,
      } as any);

      // Recalculate worker status if document is for a worker
      if (params.trabalhador_id) {
        await recalcWorkerStatus(params.trabalhador_id, tenantId, params.terceiro_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-documentos"] });
      qc.invalidateQueries({ queryKey: ["terceiro-trabalhadores"] });
      toast.success("Documento enviado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteDocumento = useMutation({
    mutationFn: async (doc: TerceiroDocumento) => {
      if (doc.arquivo_url) {
        await supabase.storage.from("documentos").remove([doc.arquivo_url]);
      }
      const { error } = await fromTable("terceiro_documentos")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;

      // Audit log
      if (tenantId && user) {
        await fromTable("terceiro_audit_log").insert({
          tenant_id: tenantId,
          entidade_tipo: "documento",
          entidade_id: doc.id,
          acao: "removido",
          descricao: `Documento "${doc.nome}" (${doc.tipo}) removido`,
          dados_anteriores: { tipo: doc.tipo, nome: doc.nome, arquivo: doc.arquivo_nome },
          usuario_id: user.id,
          usuario_nome: profile?.nome_completo || user.email,
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-documentos"] });
      toast.success("Documento removido!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ── Treinamentos ──
  const useTreinamentos = (trabalhadorId?: string) =>
    useQuery({
      queryKey: ["terceiro-treinamentos", trabalhadorId],
      queryFn: async () => {
        if (!trabalhadorId || !tenantId) return [];
        const { data, error } = await fromTable("terceiro_treinamentos")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("trabalhador_id", trabalhadorId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data as unknown as TerceiroTreinamento[];
      },
      enabled: !!trabalhadorId && !!tenantId,
    });

  const createTreinamento = useMutation({
    mutationFn: async (params: {
      file?: File;
      terceiro_id: string;
      trabalhador_id: string;
      tipo: string;
      descricao?: string;
      data_realizacao?: string;
      carga_horaria?: number;
      data_validade?: string;
      trilha_id?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");
      let certUrl: string | null = null;
      let certNome: string | null = null;
      if (params.file) {
        const ts = Date.now();
        const safeName = params.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `${tenantId}/terceiros/${params.terceiro_id}/treinamentos/${ts}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, params.file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        certUrl = path;
        certNome = params.file.name;
      }

      // Calculate training status
      const today = new Date().toISOString().split("T")[0];
      let treinStatus = "pendente";
      if (params.data_validade) {
        if (params.data_validade < today) {
          treinStatus = "vencido";
        } else {
          const diffDays = Math.ceil((new Date(params.data_validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          treinStatus = diffDays <= 30 ? "a_vencer" : "valido";
        }
      }

      const { error } = await fromTable("terceiro_treinamentos")
        .insert({
          tenant_id: tenantId,
          terceiro_id: params.terceiro_id,
          trabalhador_id: params.trabalhador_id,
          tipo: params.tipo,
          descricao: params.descricao || null,
          data_realizacao: params.data_realizacao || null,
          carga_horaria: params.carga_horaria || null,
          data_validade: params.data_validade || null,
          status: treinStatus,
          certificado_url: certUrl,
          certificado_nome: certNome,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || user.email,
          trilha_id: params.trilha_id || null,
        } as any);
      if (error) throw error;

      // Recalculate worker status
      if (tenantId) {
        await recalcWorkerStatus(params.trabalhador_id, tenantId, params.terceiro_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-treinamentos"] });
      qc.invalidateQueries({ queryKey: ["terceiro-trabalhadores"] });
      toast.success("Treinamento registrado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteTreinamento = useMutation({
    mutationFn: async (t: TerceiroTreinamento) => {
      if (t.certificado_url) {
        await supabase.storage.from("documentos").remove([t.certificado_url]);
      }
      const { error } = await fromTable("terceiro_treinamentos")
        .delete()
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-treinamentos"] });
      toast.success("Treinamento removido!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const getDownloadUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(path, 60);
    if (error) throw error;
    return data.signedUrl;
  };

  return {
    terceiros,
    isLoading,
    createTerceiro,
    updateTerceiro,
    deleteTerceiro,
    useTrabalhadores,
    createTrabalhador,
    deleteTrabalhador,
    useDocumentos,
    uploadDocumento,
    deleteDocumento,
    useTreinamentos,
    createTreinamento,
    deleteTreinamento,
    getDownloadUrl,
  };
}
