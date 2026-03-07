import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SSTDocumento {
  id: string;
  tenant_id: string;
  tipo: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  data_emissao: string | null;
  data_vigencia: string | null;
  profissional_responsavel: string | null;
  empresa_emissora: string | null;
  unidade: string | null;
  cnpj_relacionado: string | null;
  status: string;
  analise_ia: any;
  analise_ia_status: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

async function findOrCreateSSTFolder(tenantId: string): Promise<string | null> {
  // 1. Look for existing "SST da Empresa" folder (any tipo)
  const { data: existing } = await supabase
    .from("documento_pastas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("nome", "SST da Empresa")
    .maybeSingle();

  if (existing?.id) return existing.id;

  // 2. Find or create parent "SST" / "Compliance SST" / "Gestão de Riscos - SST" folder
  let pastaPaiId: string | null = null;
  const parentCandidates = ["SST", "Compliance SST", "Gestão de Riscos - SST", "SST e Saúde Ocupacional", "Segurança e Saúde no Trabalho"];

  for (const candidateName of parentCandidates) {
    const { data: parent } = await supabase
      .from("documento_pastas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("nome", candidateName)
      .maybeSingle();
    if (parent?.id) { pastaPaiId = parent.id; break; }
  }

  // 3. If no SST parent exists, create a root "SST da Empresa" folder directly
  const { data: created, error } = await supabase
    .from("documento_pastas")
    .insert({
      tenant_id: tenantId,
      nome: "SST da Empresa",
      tipo: "categoria",
      icone: "Shield",
      pasta_pai_id: pastaPaiId,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Aviso: não foi possível criar pasta SST da Empresa:", error.message);
    return null;
  }

  return created?.id || null;
}

export function useSSTDocumentos() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ["sst-documentos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("sst_documentos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SSTDocumento[];
    },
    enabled: !!tenantId,
  });

  const uploadDocumento = useMutation({
    mutationFn: async (params: {
      file: File;
      tipo: string;
      data_emissao?: string;
      data_vigencia?: string;
      profissional_responsavel?: string;
      empresa_emissora?: string;
      observacoes?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      // Upload to the shared "documentos" bucket (same as Documentos module)
      const timestamp = Date.now();
      const safeFileName = params.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${tenantId}/sst/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, params.file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      // Determine status based on vigencia
      let status = "vigente";
      if (params.data_vigencia) {
        const vigencia = new Date(params.data_vigencia);
        if (vigencia < new Date()) status = "vencido";
      }

      // 1. Insert into sst_documentos (SST module's own table)
      const { data: sstDoc, error: sstError } = await supabase.from("sst_documentos").insert({
        tenant_id: tenantId,
        tipo: params.tipo,
        arquivo_url: storagePath,
        arquivo_nome: params.file.name,
        arquivo_tamanho: params.file.size,
        data_emissao: params.data_emissao || null,
        data_vigencia: params.data_vigencia || null,
        profissional_responsavel: params.profissional_responsavel || null,
        empresa_emissora: params.empresa_emissora || null,
        status,
        criado_por: user.id,
        criado_por_nome: profile?.nome_completo || user.user_metadata?.nome || user.email,
        observacoes: params.observacoes || null,
      }).select().single();

      if (sstError) {
        // Cleanup storage on error
        await supabase.storage.from("documentos").remove([storagePath]);
        throw sstError;
      }

      // 2. Also insert into "documentos" table (Documentos module) linked to "SST da Empresa" folder
      const pastaId = await findSSTFolder(tenantId);

      const docStatus = status === "vencido" ? "vencido" : "valido";
      const { error: docError } = await supabase
        .from("documentos" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_id: null,
          colaborador_nome: "Empresa",
          colaborador_cpf: null,
          nome_arquivo: storagePath,
          nome_original: params.file.name,
          tipo: `SST - ${params.tipo}`,
          tamanho: params.file.size,
          mime_type: params.file.type,
          storage_path: storagePath,
          data_validade: params.data_vigencia || null,
          status: docStatus,
          observacoes: params.observacoes
            ? `${params.tipo} | ${params.observacoes}`
            : `Documento SST: ${params.tipo}`,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || user.user_metadata?.nome || null,
          pasta_id: pastaId,
        } as never);

      if (docError) {
        console.warn("Aviso: documento SST salvo, mas não foi possível vincular ao módulo Documentos:", docError.message);
      }

      return sstDoc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-com-pasta"] });
      toast.success("Documento enviado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar documento: " + err.message);
    },
  });

  const deleteDocumento = useMutation({
    mutationFn: async (doc: SSTDocumento) => {
      // Remove from storage
      if (doc.arquivo_url) {
        await supabase.storage.from("documentos").remove([doc.arquivo_url]);
      }

      // Remove from sst_documentos
      const { error } = await supabase.from("sst_documentos").delete().eq("id", doc.id);
      if (error) throw error;

      // Also remove from documentos table (by matching storage_path)
      if (doc.arquivo_url) {
        await supabase
          .from("documentos" as never)
          .delete()
          .eq("storage_path", doc.arquivo_url);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-com-pasta"] });
      toast.success("Documento excluído!");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });

  const updateAnaliseIA = useMutation({
    mutationFn: async ({ id, analise_ia, analise_ia_status }: { id: string; analise_ia: any; analise_ia_status: string }) => {
      const { error } = await supabase
        .from("sst_documentos")
        .update({ analise_ia, analise_ia_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-documentos"] });
    },
  });

  return {
    documentos,
    isLoading,
    uploadDocumento,
    deleteDocumento,
    updateAnaliseIA,
  };
}
