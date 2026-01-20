import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AdmissaoRow,
  AdmissaoInsert,
  AdmissaoUpdate,
  AdmissaoCompleta,
  AdmissaoFormData,
  AdmissaoDocumentoRow,
  AdmissaoDocumentoInsert,
  AdmissaoDocumentoUpdate,
  AdmissaoWorkflowRow,
  AdmissaoWorkflowInsert,
  AdmissaoWorkflowUpdate,
  AdmissaoHistoricoInsert,
  AdmissaoStatus,
  DocumentoStatus,
  WorkflowStatus,
  DOCUMENTOS_OBRIGATORIOS,
  DEFAULT_WORKFLOW_STEPS,
} from '@/types/database';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useAdmissoes() {
  const queryClient = useQueryClient();
  const { tenantId, user, profile } = useAuth();

  // Fetch all admissões for the tenant
  const {
    data: admissoes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admissoes', tenantId],
    queryFn: async (): Promise<AdmissaoCompleta[]> => {
      if (!tenantId) return [];

      // Fetch admissões
      const { data: admissoesData, error: admissoesError } = await supabase
        .from('admissoes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (admissoesError) throw admissoesError;
      if (!admissoesData?.length) return [];

      // Fetch related data for all admissões
      const admissaoIds = admissoesData.map(a => a.id);

      const [documentosRes, workflowRes, historicoRes] = await Promise.all([
        supabase
          .from('admissao_documentos')
          .select('*')
          .in('admissao_id', admissaoIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('admissao_workflow')
          .select('*')
          .in('admissao_id', admissaoIds)
          .order('ordem', { ascending: true }),
        supabase
          .from('admissao_historico')
          .select('*')
          .in('admissao_id', admissaoIds)
          .order('created_at', { ascending: false }),
      ]);

      // Map related data to each admissão
      return admissoesData.map(admissao => ({
        ...admissao,
        documentos: documentosRes.data?.filter(d => d.admissao_id === admissao.id) || [],
        workflow: workflowRes.data?.filter(w => w.admissao_id === admissao.id) || [],
        historico: historicoRes.data?.filter(h => h.admissao_id === admissao.id) || [],
      }));
    },
    enabled: !!tenantId,
  });

  // Create new admissão
  const criarAdmissao = useMutation({
    mutationFn: async (dados: AdmissaoFormData): Promise<AdmissaoCompleta> => {
      if (!tenantId || !user) throw new Error('Usuário não autenticado');

      // Insert admissão
      const { data: admissao, error: admissaoError } = await supabase
        .from('admissoes')
        .insert({
          tenant_id: tenantId,
          criado_por: user.id,
          status: 'rascunho' as AdmissaoStatus,
          ...dados,
        })
        .select()
        .single();

      if (admissaoError) throw admissaoError;

      // Insert default documents
      const documentosToInsert: AdmissaoDocumentoInsert[] = DOCUMENTOS_OBRIGATORIOS.map(doc => ({
        admissao_id: admissao.id,
        tenant_id: tenantId,
        nome: doc.nome,
        tipo: doc.tipo,
        obrigatorio: doc.obrigatorio,
        status: 'pendente' as DocumentoStatus,
      }));

      const { data: documentos, error: docsError } = await supabase
        .from('admissao_documentos')
        .insert(documentosToInsert)
        .select();

      if (docsError) throw docsError;

      // Insert default workflow steps
      const workflowToInsert: AdmissaoWorkflowInsert[] = DEFAULT_WORKFLOW_STEPS.map((step, index) => ({
        admissao_id: admissao.id,
        tenant_id: tenantId,
        etapa: step.etapa,
        ordem: step.ordem,
        status: (index === 0 ? 'aprovado' : 'pendente') as WorkflowStatus,
        responsavel_nome: index === 0 ? 'Sistema' : 'Pendente',
        data_acao: index === 0 ? new Date().toISOString() : null,
      }));

      const { data: workflow, error: workflowError } = await supabase
        .from('admissao_workflow')
        .insert(workflowToInsert)
        .select();

      if (workflowError) throw workflowError;

      // Insert history entry
      const historicoEntry: AdmissaoHistoricoInsert = {
        admissao_id: admissao.id,
        tenant_id: tenantId,
        acao: 'Admissão criada',
        descricao: `Nova admissão criada para ${dados.nome_completo}`,
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email || 'Sistema',
      };

      const { data: historico, error: historicoError } = await supabase
        .from('admissao_historico')
        .insert(historicoEntry)
        .select();

      if (historicoError) throw historicoError;

      return {
        ...admissao,
        documentos: documentos || [],
        workflow: workflow || [],
        historico: historico || [],
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissoes', tenantId] });
    },
  });

  // Update admissão
  const atualizarAdmissao = useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string;
      dados: Partial<AdmissaoFormData>;
    }): Promise<AdmissaoRow> => {
      if (!tenantId || !user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('admissoes')
        .update(dados as AdmissaoUpdate)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      // Add history entry
      await supabase.from('admissao_historico').insert({
        admissao_id: id,
        tenant_id: tenantId,
        acao: 'Admissão atualizada',
        descricao: 'Dados da admissão foram atualizados',
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email || 'Sistema',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissoes', tenantId] });
    },
  });

  // Update status
  const atualizarStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AdmissaoStatus;
    }): Promise<AdmissaoRow> => {
      if (!tenantId || !user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('admissoes')
        .update({ status })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      // Add history entry
      await supabase.from('admissao_historico').insert({
        admissao_id: id,
        tenant_id: tenantId,
        acao: 'Status atualizado',
        descricao: `Status alterado para ${status}`,
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email || 'Sistema',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissoes', tenantId] });
    },
  });

  // Update document
  const atualizarDocumento = useMutation({
    mutationFn: async ({
      documentoId,
      dados,
    }: {
      documentoId: string;
      dados: Partial<AdmissaoDocumentoUpdate>;
    }): Promise<AdmissaoDocumentoRow> => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('admissao_documentos')
        .update(dados)
        .eq('id', documentoId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissoes', tenantId] });
    },
  });

  // Approve/reject workflow step
  const atualizarWorkflow = useMutation({
    mutationFn: async ({
      workflowId,
      admissaoId,
      aprovado,
      observacao,
    }: {
      workflowId: string;
      admissaoId: string;
      aprovado: boolean;
      observacao?: string;
    }): Promise<AdmissaoWorkflowRow> => {
      if (!tenantId || !user) throw new Error('Usuário não autenticado');

      const status: WorkflowStatus = aprovado ? 'aprovado' : 'rejeitado';

      const { data, error } = await supabase
        .from('admissao_workflow')
        .update({
          status,
          observacao,
          data_acao: new Date().toISOString(),
          responsavel_id: user.id,
          responsavel_nome: profile?.nome_completo || user.email || 'Sistema',
        })
        .eq('id', workflowId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      // Check if all steps are approved/rejected and update admission status
      const { data: allWorkflow } = await supabase
        .from('admissao_workflow')
        .select('status')
        .eq('admissao_id', admissaoId);

      if (allWorkflow) {
        const todasAprovadas = allWorkflow.every(w => w.status === 'aprovado');
        const algumaRejeitada = allWorkflow.some(w => w.status === 'rejeitado');

        let novoStatus: AdmissaoStatus | null = null;
        if (todasAprovadas) novoStatus = 'concluido';
        else if (algumaRejeitada) novoStatus = 'reprovado';
        else novoStatus = 'em_analise';

        if (novoStatus) {
          await supabase
            .from('admissoes')
            .update({ status: novoStatus })
            .eq('id', admissaoId);
        }
      }

      // Add history entry
      await supabase.from('admissao_historico').insert({
        admissao_id: admissaoId,
        tenant_id: tenantId,
        acao: aprovado ? 'Etapa aprovada' : 'Etapa rejeitada',
        descricao: observacao || `Etapa ${aprovado ? 'aprovada' : 'rejeitada'}`,
        usuario_id: user.id,
        usuario_nome: profile?.nome_completo || user.email || 'Sistema',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissoes', tenantId] });
    },
  });

  // Delete admissão
  const excluirAdmissao = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { error } = await supabase
        .from('admissoes')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissoes', tenantId] });
    },
  });

  // Get single admissão by ID
  const buscarAdmissao = (id: string): AdmissaoCompleta | undefined => {
    return admissoes.find(a => a.id === id);
  };

  // Upload document file
  const uploadDocumento = async (
    admissaoId: string,
    documentoId: string,
    file: File
  ): Promise<string> => {
    if (!tenantId) throw new Error('Tenant não encontrado');

    const filePath = `${tenantId}/admissoes/${admissaoId}/${documentoId}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    // Update document record with the file path (not public URL since bucket is private)
    await atualizarDocumento.mutateAsync({
      documentoId,
      dados: {
        arquivo_url: filePath, // Store path, we'll generate signed URL when viewing
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        status: 'enviado',
        data_envio: new Date().toISOString(),
      },
    });

    return filePath;
  };

  // Get signed URL for viewing a document
  const getDocumentoUrl = async (filePath: string): Promise<string | null> => {
    if (!filePath) return null;
    
    // If it's already a full URL (legacy), return as-is
    if (filePath.startsWith('http')) return filePath;

    const { data, error } = await supabase.storage
      .from('documentos')
      .createSignedUrl(filePath, 3600); // 1 hour expiration

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  };

  return {
    admissoes,
    isLoading,
    error: error?.message || null,
    refetch,
    criarAdmissao: criarAdmissao.mutateAsync,
    atualizarAdmissao: atualizarAdmissao.mutateAsync,
    atualizarStatus: atualizarStatus.mutateAsync,
    atualizarDocumento: atualizarDocumento.mutateAsync,
    atualizarWorkflow: atualizarWorkflow.mutateAsync,
    excluirAdmissao: excluirAdmissao.mutateAsync,
    buscarAdmissao,
    uploadDocumento,
    getDocumentoUrl,
    isPending:
      criarAdmissao.isPending ||
      atualizarAdmissao.isPending ||
      atualizarStatus.isPending ||
      atualizarDocumento.isPending ||
      atualizarWorkflow.isPending ||
      excluirAdmissao.isPending,
  };
}
