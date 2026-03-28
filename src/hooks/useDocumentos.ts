import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
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
      documentoExistenteId,
      motivoRevisao,
    }: {
      file: File;
      colaboradorNome: string;
      colaboradorCpf?: string;
      colaboradorId?: string;
      tipo: string;
      dataValidade?: string;
      observacoes?: string;
      documentoExistenteId?: string;   // se preenchido → nova versão
      motivoRevisao?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Usuário não autenticado");

      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const nomeArquivo = colaboradorId
        ? `${tenantId}/colaboradores/${colaboradorId}/${timestamp}_${safeFileName}`
        : `${tenantId}/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(nomeArquivo, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const status = calcularStatus(dataValidade || null);

      // ── NOVA VERSÃO de documento existente ───────────────────────────────
      if (documentoExistenteId) {
        // 1. Buscar documento atual para salvar sua versão
        const { data: docAtual } = await supabase
          .from("documentos" as never)
          .select("*")
          .eq("id", documentoExistenteId)
          .single() as { data: Documento | null };

        if (docAtual) {
          const proximaVersao = (docAtual.versao_atual || 1) + 1;

          // 2. Salvar versão anterior no histórico
          await supabase.from("documento_versoes" as never).insert({
            tenant_id: tenantId,
            documento_id: documentoExistenteId,
            versao: docAtual.versao_atual || 1,
            nome_original: docAtual.nome_original,
            storage_path: docAtual.storage_path,
            tamanho: docAtual.tamanho,
            mime_type: docAtual.mime_type,
            data_validade: docAtual.data_validade,
            observacoes: docAtual.observacoes,
            criado_por: docAtual.criado_por,
            criado_por_nome: docAtual.criado_por_nome,
            motivo_revisao: motivoRevisao || null,
          } as never);

          // 3. Atualizar documento principal com novo arquivo
          const { data, error } = await supabase
            .from("documentos" as never)
            .update({
              nome_arquivo: nomeArquivo,
              nome_original: file.name,
              tamanho: file.size,
              mime_type: file.type,
              storage_path: nomeArquivo,
              data_validade: dataValidade || null,
              status,
              observacoes: observacoes || docAtual.observacoes,
              versao_atual: proximaVersao,
              total_versoes: proximaVersao,
            } as never)
            .eq("id", documentoExistenteId)
            .select()
            .single();

          if (error) {
            await supabase.storage.from("documentos").remove([nomeArquivo]);
            throw error;
          }
          return data;
        }
      }

      // ── NOVO DOCUMENTO ───────────────────────────────────────────────────
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
          versao_atual: 1,
          total_versoes: 1,
        } as never)
        .select()
        .single();

      if (error) {
        await supabase.storage.from("documentos").remove([nomeArquivo]);
        throw error;
      }

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documento-versoes"] });
      if (vars.documentoExistenteId) {
        toast.success("Nova versão salva com sucesso! Versão anterior preservada no histórico.");
      } else {
        toast.success("Documento enviado com sucesso!");
      }
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

  // Buscar versões de um documento específico
  const getVersoes = async (documentoId: string): Promise<DocumentoVersao[]> => {
    const { data, error } = await supabase
      .from("documento_versoes" as never)
      .select("*")
      .eq("documento_id", documentoId)
      .eq("tenant_id", tenantId)
      .order("versao", { ascending: false }) as { data: DocumentoVersao[] | null; error: Error | null };

    if (error) throw error;
    return data || [];
  };

  // Restaurar versão anterior como versão atual
  const restaurarVersaoMutation = useMutation({
    mutationFn: async ({ documentoId, versao }: { documentoId: string; versao: DocumentoVersao }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      // 1. Buscar documento atual
      const { data: docAtual } = await supabase
        .from("documentos" as never)
        .select("*")
        .eq("id", documentoId)
        .single() as { data: Documento | null };

      if (!docAtual) throw new Error("Documento não encontrado");

      // 2. Salvar versão atual no histórico antes de restaurar
      await supabase.from("documento_versoes" as never).insert({
        tenant_id: tenantId,
        documento_id: documentoId,
        versao: docAtual.versao_atual,
        nome_original: docAtual.nome_original,
        storage_path: docAtual.storage_path,
        tamanho: docAtual.tamanho,
        mime_type: docAtual.mime_type,
        data_validade: docAtual.data_validade,
        observacoes: docAtual.observacoes,
        criado_por: docAtual.criado_por,
        criado_por_nome: docAtual.criado_por_nome,
        motivo_revisao: `Substituída ao restaurar versão ${versao.versao}`,
      } as never);

      // 3. Promover versão antiga como atual
      const novaVersaoNum = docAtual.versao_atual + 1;
      await supabase
        .from("documentos" as never)
        .update({
          nome_arquivo: versao.storage_path,
          nome_original: versao.nome_original,
          storage_path: versao.storage_path,
          tamanho: versao.tamanho,
          mime_type: versao.mime_type,
          data_validade: versao.data_validade,
          observacoes: versao.observacoes,
          versao_atual: novaVersaoNum,
          total_versoes: novaVersaoNum,
          status: calcularStatus(versao.data_validade),
        } as never)
        .eq("id", documentoId);

      // 4. Remover versão do histórico (agora é a atual)
      await supabase
        .from("documento_versoes" as never)
        .delete()
        .eq("id", versao.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documento-versoes"] });
      toast.success("Versão restaurada com sucesso!");
    },
    onError: (err: Error) => toast.error("Erro ao restaurar versão: " + err.message),
  });

  // Stats
  const stats = {
    total: documentos.length,
    vencendo: documentos.filter((d) => d.status === "vencendo").length,
    vencidos: documentos.filter((d) => d.status === "vencido").length,
  };

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
    getVersoes,
    restaurarVersao: restaurarVersaoMutation.mutateAsync,
    restaurando: restaurarVersaoMutation.isPending,
  };
}
