import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { EmpresaCadastro, EmpresaObrigacao } from '@/types/empresa';
import type { Json } from '@/integrations/supabase/types';
import { autoGenerateFolderStructure } from '@/utils/autoGenerateFolderStructure';

export function useEmpresaCadastro(empresaId?: string | null) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Carrega dados do cliente (onboarding) para preenchimento automático
  const { data: cliente } = useQuery({
    queryKey: ['cliente_onboarding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('programa_validador_clientes')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar dados do cliente:', error);
        return null;
      }
      return data;
    },
    enabled: !!tenantId,
  });

  // Lista todas as empresas do tenant
  const { data: empresas = [], isLoading: isLoadingList } = useQuery({
    queryKey: ['empresa_cadastro_list', tenantId],
    queryFn: async () => {
      // Paginação manual para contornar o limite do PostgREST (max-rows = 1000)
      const PAGE = 1000;
      let from = 0;
      const acc: any[] = [];
      // loop até receber menos que PAGE
      // (cap de segurança em 50 páginas = 50k registros)
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from('empresa_cadastro')
          .select('*')
          .eq('tenant_id', tenantId!)
          .order('razao_social')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data || [];
        acc.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return acc as unknown as (EmpresaCadastro & { ativo: boolean })[];
    },

    enabled: !!tenantId,
  });

  // Carrega uma empresa específica para edição
  const { data: cadastro, isLoading, error } = useQuery({
    queryKey: ['empresa_cadastro', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresa_cadastro')
        .select('*')
        .eq('id', empresaId!)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as EmpresaCadastro | null;
    },
    enabled: !!empresaId,
  });

  const upsertCadastro = useMutation({
    mutationFn: async (updates: Partial<EmpresaCadastro>) => {
      const { id, created_at, updated_at, ...rest } = updates;

      // Validação de CNPJ/CPF duplicado no tenant
      const cnpjLimpo = rest.cnpj ? rest.cnpj.replace(/\D/g, '') : '';
      const cpfLimpo = rest.cpf ? rest.cpf.replace(/\D/g, '') : '';
      const targetId = empresaId || cadastro?.id || null;

      if (cnpjLimpo.length === 14) {
        const { data: dupes } = await supabase
          .from('empresa_cadastro')
          .select('id, razao_social, cnpj')
          .eq('tenant_id', tenantId!)
          .not('cnpj', 'is', null);
        const conflito = (dupes || []).find((e: any) => {
          const c = (e.cnpj || '').replace(/\D/g, '');
          return c === cnpjLimpo && e.id !== targetId;
        });
        if (conflito) {
          throw new Error(`CNPJ já cadastrado para a empresa "${(conflito as any).razao_social || 'sem nome'}".`);
        }
      }

      if (cpfLimpo.length === 11) {
        const { data: dupes } = await supabase
          .from('empresa_cadastro')
          .select('id, razao_social, cpf')
          .eq('tenant_id', tenantId!)
          .not('cpf', 'is', null);
        const conflito = (dupes || []).find((e: any) => {
          const c = (e.cpf || '').replace(/\D/g, '');
          return c === cpfLimpo && e.id !== targetId;
        });
        if (conflito) {
          throw new Error(`CPF já cadastrado para a empresa "${(conflito as any).razao_social || 'sem nome'}".`);
        }
      }

      const payload: Record<string, unknown> = {
        ...rest,
        tenant_id: tenantId!,
        atualizado_por: user?.email || null,
        cnaes_secundarios: rest.cnaes_secundarios as unknown as Json,
        sesmt_profissionais: rest.sesmt_profissionais as unknown as Json,
        cipa_membros: rest.cipa_membros as unknown as Json,
        fap_historico: rest.fap_historico as unknown as Json,
        tac_detalhes: rest.tac_detalhes as unknown as Json,
        turnos: rest.turnos as unknown as Json,
        condicoes_especiais_detalhes: rest.condicoes_especiais_detalhes as unknown as Json,
        aprendiz_obrigatorio: rest.aprendiz_obrigatorio || false,
      };

      if (empresaId) {
        const { data, error } = await supabase
          .from('empresa_cadastro')
          .update(payload as any)
          .eq('id', empresaId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else if (cadastro?.id) {
        const { data, error } = await supabase
          .from('empresa_cadastro')
          .update(payload as any)
          .eq('id', cadastro.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('empresa_cadastro')
          .insert(payload as any)
          .select()
          .single();
        if (error) throw error;
        // Auto-gerar estrutura de pastas para a nova empresa
        try {
          await autoGenerateFolderStructure(tenantId!, user!.id, user?.email || null, data.id);
        } catch (e) {
          console.error('Erro ao gerar estrutura de pastas:', e);
        }
        return data;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro'] });
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list'] });
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list_ativa'] });
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      
      // Se não for um salvamento manual (detectado pela ausência de algum flag ou apenas por ser upsert sem toast extra),
      // podemos decidir não mostrar o toast. Mas para simplificar e atender o pedido do usuário
      // de não ter popups a cada campo, vamos remover o toast de sucesso aqui,
      // já que a UI na página Empresa.tsx já mostra o status de salvamento.
    },
    // Erros são tratados pelos chamadores (autosave silencia, save manual exibe).
  });

  const toggleAtivoEmpresa = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('empresa_cadastro')
        .update({ ativo } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list'] });
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list_ativa'] });
    },
  });

  // Exclusão segura via RPC: valida master + ausência de colaboradores/terceiros
  const deleteEmpresa = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc('delete_empresa_segura', {
        _empresa_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list'] });
      queryClient.invalidateQueries({ queryKey: ['empresa_cadastro_list_ativa'] });
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
    },
  });

  // Obrigações da empresa específica
  const { data: obrigacoes = [], isLoading: obrigacoesLoading } = useQuery({
    queryKey: ['empresa_obrigacoes', tenantId, empresaId],
    queryFn: async () => {
      let query = supabase
        .from('empresa_obrigacoes')
        .select('*')
        .eq('tenant_id', tenantId!);
      
      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      } else {
        // Se não houver empresa_id (ex: criando nova), não deve trazer obrigações de outras
        return [];
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmpresaObrigacao[];
    },
    enabled: !!tenantId && !!empresaId,
  });

  const createObrigacao = useMutation({
    mutationFn: async (obrigacao: Omit<EmpresaObrigacao, 'id' | 'created_at' | 'updated_at'> & { empresa_id?: string }) => {
      const { data, error } = await supabase
        .from('empresa_obrigacoes')
        .insert({
          ...obrigacao,
          empresa_id: obrigacao.empresa_id || empresaId || null
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa_obrigacoes'] });
    },
  });

  const updateObrigacao = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmpresaObrigacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('empresa_obrigacoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa_obrigacoes'] });
    },
  });

  const deleteObrigacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('empresa_obrigacoes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa_obrigacoes'] });
    },
  });

  // Create action in plano_acoes linked to obligation
  const criarAcaoDeObrigacao = useMutation({
    mutationFn: async (obrigacao: EmpresaObrigacao) => {
      // Create the action
      const { data: acao, error: acaoError } = await supabase
        .from('plano_acoes')
        .insert({
          tenant_id: tenantId!,
          empresa_id: obrigacao.empresa_id || empresaId || null,
          codigo: 'TEMP', // trigger will generate
          titulo: obrigacao.titulo,
          descricao: obrigacao.descricao,
          porque: `Base legal: ${obrigacao.base_legal || 'N/A'}`,
          origem_modulo: 'compliance',
          origem_id: obrigacao.id,
          origem_descricao: `Cadastro Empresa → ${obrigacao.subcategoria?.toUpperCase() || obrigacao.categoria}`,
          tipo: 'corretiva',
          prioridade: obrigacao.criticidade === 'critica' ? 'imediato' : obrigacao.criticidade === 'alta' ? 'urgente' : 'medio',
          gravidade: obrigacao.criticidade === 'critica' ? 5 : obrigacao.criticidade === 'alta' ? 4 : 3,
          urgencia: obrigacao.criticidade === 'critica' ? 5 : obrigacao.criticidade === 'alta' ? 4 : 3,
          tendencia: 3,
          prazo: obrigacao.prazo_sugerido,
          criado_por: user?.id,
          criado_por_nome: user?.email,
        })
        .select()
        .single();

      if (acaoError) throw acaoError;

      // Link back to obligation
      await supabase
        .from('empresa_obrigacoes')
        .update({ acao_gerada_id: acao.id, status: 'em_adequacao' })
        .eq('id', obrigacao.id);

      return acao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresa_obrigacoes'] });
      queryClient.invalidateQueries({ queryKey: ['plano-acoes'] });
      toast.success('Ação criada no Plano de Ação!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar ação: ' + error.message);
    },
  });

  return {
    empresas,
    isLoadingList,
    cadastro,
    isLoading,
    error,
    upsertCadastro,
    toggleAtivoEmpresa,
    deleteEmpresa,
    obrigacoes,
    obrigacoesLoading,
    createObrigacao,
    updateObrigacao,
    deleteObrigacao,
    criarAcaoDeObrigacao,
    cliente,
  };
}
