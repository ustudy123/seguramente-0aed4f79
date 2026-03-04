import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { addDays, isBefore, isAfter } from "date-fns";

export interface Documento {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  nome_arquivo: string;
  nome_original: string;
  tipo: string;
  tamanho: number;
  mime_type: string;
  storage_path: string;
  data_validade: string | null;
  status: "valido" | "vencendo" | "vencido";
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
  versao_atual: number;
  total_versoes: number;
}

export interface DocumentoVersao {
  id: string;
  tenant_id: string;
  documento_id: string;
  versao: number;
  nome_original: string;
  storage_path: string;
  tamanho: number;
  mime_type: string;
  data_validade: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  motivo_revisao: string | null;
  created_at: string;
}

export const TIPOS_DOCUMENTO = [
  // Admissão
  "Ficha de Registro",
  "Contrato",
  "CTPS",
  "RG",
  "CPF",
  "Comprovante de Residência",
  "Título de Eleitor",
  "Carteira de Reservista",
  "CNH",
  "Certificado",
  // Saúde Ocupacional
  "ASO",
  "Atestado",
  // Segurança do Trabalho
  "Recibo de EPI",
  "Ordem de Serviço",
  "Treinamento NR",
  // Termos e Declarações
  "Termo de Confidencialidade",
  "Termo de Responsabilidade",
  "Termo de Uso de Imagem",
  "Declaração de Dependentes",
  "Vale Transporte",
  // Outros
  "Outros",
];

function calcularStatus(dataValidade: string | null): "valido" | "vencendo" | "vencido" {
  if (!dataValidade) return "valido";
  
  const hoje = new Date();
  const validade = new Date(dataValidade);
  const trintaDiasAntes = addDays(validade, -30);
  
  if (isBefore(validade, hoje)) return "vencido";
  if (isAfter(hoje, trintaDiasAntes)) return "vencendo";
  return "valido";
}

export function useDocumentos() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Buscar documentos
  const { data: documentos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["documentos", tenantId],
    queryFn: async (): Promise<Documento[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("documentos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: Documento[] | null; error: Error | null };

      if (error) throw error;
      
      // Recalcular status baseado na data de validade
      return (data || []).map(doc => ({
        ...doc,
        status: calcularStatus(doc.data_validade),
      }));
    },
    enabled: !!tenantId,
  });

  // Upload de documento
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      colaboradorNome,
      colaboradorCpf,
      colaboradorId,
      tipo,
      dataValidade,
      observacoes,
    }: {
      file: File;
      colaboradorNome: string;
      colaboradorCpf?: string;
      colaboradorId?: string;
      tipo: string;
      dataValidade?: string;
      observacoes?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Usuário não autenticado");

      // Gerar nome único com estrutura de pastas por colaborador
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      
      // Nova estrutura: {tenant_id}/colaboradores/{colaborador_id}/{timestamp}_{arquivo}
      const nomeArquivo = colaboradorId
        ? `${tenantId}/colaboradores/${colaboradorId}/${timestamp}_${safeFileName}`
        : `${tenantId}/${timestamp}_${safeFileName}`;

      // Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(nomeArquivo, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Calcular status
      const status = calcularStatus(dataValidade || null);

      // Salvar metadados no banco
      const { data, error } = await supabase
        .from("documentos" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_id: colaboradorId || null,
          colaborador_nome: colaboradorNome,
          colaborador_cpf: colaboradorCpf || null,
          nome_arquivo: nomeArquivo,
          nome_original: file.name,
          tipo,
          tamanho: file.size,
          mime_type: file.type,
          storage_path: nomeArquivo,
          data_validade: dataValidade || null,
          status,
          observacoes: observacoes || null,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
        } as never)
        .select()
        .single();

      if (error) {
        // Tentar remover arquivo do storage em caso de erro
        await supabase.storage.from("documentos").remove([nomeArquivo]);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento enviado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar documento: " + error.message);
    },
  });

  // Deletar documento
  const deleteMutation = useMutation({
    mutationFn: async (documento: Documento) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Remover do storage
      const { error: storageError } = await supabase.storage
        .from("documentos")
        .remove([documento.storage_path]);

      if (storageError) console.warn("Erro ao remover do storage:", storageError);

      // Remover do banco
      const { error } = await supabase
        .from("documentos" as never)
        .delete()
        .eq("id", documento.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      toast.success("Documento excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir documento: " + error.message);
    },
  });

  // Obter URL assinada para download
  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    if (!storagePath) {
      toast.error("Caminho do arquivo não encontrado");
      return null;
    }

    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(storagePath, 3600); // 1 hora

    if (error) {
      console.error("Erro ao gerar signed URL:", error.message, "Path:", storagePath);
      toast.error("Erro ao gerar link: " + error.message);
      return null;
    }

    return data.signedUrl;
  };

  // Stats
  const stats = {
    total: documentos.length,
    vencendo: documentos.filter((d) => d.status === "vencendo").length,
    vencidos: documentos.filter((d) => d.status === "vencido").length,
  };

  // Tipos únicos
  const tiposUnicos = [...new Set(documentos.map((d) => d.tipo))];

  return {
    documentos,
    isLoading,
    error: error?.message || null,
    refetch,
    stats,
    tiposUnicos,
    upload: uploadMutation.mutateAsync,
    uploading: uploadMutation.isPending,
    deleteDocumento: deleteMutation.mutateAsync,
    deleting: deleteMutation.isPending,
    getSignedUrl,
  };
}
