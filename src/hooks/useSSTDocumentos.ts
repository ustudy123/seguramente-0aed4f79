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

export function useSSTDocumentos() {
  const { tenantId, user } = useAuth();
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

      // Upload file to storage
      const fileExt = params.file.name.split(".").pop();
      const filePath = `${tenantId}/${Date.now()}_${params.file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("sst-documentos")
        .upload(filePath, params.file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("sst-documentos")
        .getPublicUrl(filePath);

      // Determine status based on vigencia
      let status = "vigente";
      if (params.data_vigencia) {
        const vigencia = new Date(params.data_vigencia);
        if (vigencia < new Date()) status = "vencido";
      }

      // Insert record
      const { data, error } = await supabase.from("sst_documentos").insert({
        tenant_id: tenantId,
        tipo: params.tipo,
        arquivo_url: filePath,
        arquivo_nome: params.file.name,
        arquivo_tamanho: params.file.size,
        data_emissao: params.data_emissao || null,
        data_vigencia: params.data_vigencia || null,
        profissional_responsavel: params.profissional_responsavel || null,
        empresa_emissora: params.empresa_emissora || null,
        status,
        criado_por: user.id,
        criado_por_nome: user.user_metadata?.nome || user.email,
        observacoes: params.observacoes || null,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-documentos"] });
      toast.success("Documento enviado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar documento: " + err.message);
    },
  });

  const deleteDocumento = useMutation({
    mutationFn: async (doc: SSTDocumento) => {
      if (doc.arquivo_url) {
        await supabase.storage.from("sst-documentos").remove([doc.arquivo_url]);
      }
      const { error } = await supabase.from("sst_documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-documentos"] });
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
