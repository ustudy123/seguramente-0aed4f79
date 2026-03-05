import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const qc = useQueryClient();

  // ── Terceiros (empresas) ──
  const { data: terceiros = [], isLoading } = useQuery({
    queryKey: ["terceiros", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("terceiros" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("razao_social");
      if (error) throw error;
      return data as unknown as Terceiro[];
    },
    enabled: !!tenantId,
  });

  const createTerceiro = useMutation({
    mutationFn: async (payload: Partial<Terceiro>) => {
      if (!tenantId) throw new Error("Sem tenant");
      const { data, error } = await supabase
        .from("terceiros" as never)
        .insert({ ...payload, tenant_id: tenantId } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiros"] });
      toast.success("Terceiro cadastrado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const updateTerceiro = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Terceiro> & { id: string }) => {
      const { error } = await supabase
        .from("terceiros" as never)
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiros"] });
      toast.success("Terceiro atualizado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteTerceiro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("terceiros" as never)
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
        const { data, error } = await supabase
          .from("terceiro_trabalhadores" as never)
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
      const { data, error } = await supabase
        .from("terceiro_trabalhadores" as never)
        .insert({ ...payload, tenant_id: tenantId } as never)
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
      const { error } = await supabase
        .from("terceiro_trabalhadores" as never)
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
        let q = supabase
          .from("terceiro_documentos" as never)
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

      const { error } = await supabase
        .from("terceiro_documentos" as never)
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
          observacoes: params.observacoes || null,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || user.email,
        } as never);
      if (error) {
        await supabase.storage.from("documentos").remove([path]);
        throw error;
      }

      // Audit log
      await supabase.from("terceiro_audit_log" as never).insert({
        tenant_id: tenantId,
        entidade_tipo: "documento",
        entidade_id: params.terceiro_id,
        acao: "criado",
        descricao: `Documento "${params.nome}" (${params.tipo}) enviado`,
        dados_novos: { tipo: params.tipo, nome: params.nome, arquivo: params.file.name },
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email,
      } as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-documentos"] });
      toast.success("Documento enviado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteDocumento = useMutation({
    mutationFn: async (doc: TerceiroDocumento) => {
      if (doc.arquivo_url) {
        await supabase.storage.from("documentos").remove([doc.arquivo_url]);
      }
      const { error } = await supabase
        .from("terceiro_documentos" as never)
        .delete()
        .eq("id", doc.id);
      if (error) throw error;

      // Audit log
      if (tenantId && user) {
        await supabase.from("terceiro_audit_log" as never).insert({
          tenant_id: tenantId,
          entidade_tipo: "documento",
          entidade_id: doc.id,
          acao: "removido",
          descricao: `Documento "${doc.nome}" (${doc.tipo}) removido`,
          dados_anteriores: { tipo: doc.tipo, nome: doc.nome, arquivo: doc.arquivo_nome },
          usuario_id: user.id,
          usuario_nome: profile?.nome_completo || user.email,
        } as never);
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
        const { data, error } = await supabase
          .from("terceiro_treinamentos" as never)
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

      const { error } = await supabase
        .from("terceiro_treinamentos" as never)
        .insert({
          tenant_id: tenantId,
          terceiro_id: params.terceiro_id,
          trabalhador_id: params.trabalhador_id,
          tipo: params.tipo,
          descricao: params.descricao || null,
          data_realizacao: params.data_realizacao || null,
          carga_horaria: params.carga_horaria || null,
          data_validade: params.data_validade || null,
          certificado_url: certUrl,
          certificado_nome: certNome,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || user.email,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terceiro-treinamentos"] });
      toast.success("Treinamento registrado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteTreinamento = useMutation({
    mutationFn: async (t: TerceiroTreinamento) => {
      if (t.certificado_url) {
        await supabase.storage.from("documentos").remove([t.certificado_url]);
      }
      const { error } = await supabase
        .from("terceiro_treinamentos" as never)
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
  };
}
