import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type UsuarioStatus = 
  'rascunho' | 'pendente_convite' | 'convite_enviado' | 'aguardando_ativacao' |
  'ativo' | 'bloqueado' | 'suspenso' | 'inativo' | 'arquivado';

export type VinculoStatus = 'ativo' | 'pendente' | 'suspenso' | 'revogado' | 'encerrado' | 'expirado';

export type UsuarioTipo =
  'administrador' | 'rh_dp' | 'gestor' | 'lideranca' | 'tecnico_seguranca' |
  'saude_ocupacional' | 'clinica_parceira' | 'consultor_externo' |
  'prestador_terceiro' | 'auditor' | 'implantador' | 'suporte_autorizado' | 'corporativo_multiempresa' | 'colaborador';

export type QualidadeScore = 'completo' | 'suficiente' | 'incompleto' | 'inconsistente';

export interface UsuarioBase {
  id: string;
  tenant_id: string;
  auth_user_id?: string;
  nome_completo: string;
  nome_social?: string;
  cpf?: string;
  email_principal: string;
  telefone_principal?: string;
  foto_url?: string;
  data_nascimento?: string;
  cargo_funcao?: string;
  matricula?: string;
  idioma?: string;
  observacoes?: string;
  origem_cadastro?: string;
  tipo_usuario: UsuarioTipo;
  status: UsuarioStatus;
  convite_enviado_em?: string;
  convite_expira_em?: string;
  convite_aceito_em?: string;
  email_validado?: boolean;
  telefone_validado?: boolean;
  primeiro_acesso_em?: string;
  ultimo_acesso_em?: string;
  autenticacao_2fa?: boolean;
  qualidade_score?: QualidadeScore;
  qualidade_pct?: number;
  sugestao_tipo_ia?: UsuarioTipo;
  alerta_duplicidade?: boolean;
  duplicidade_nivel?: string;
  criado_por_nome?: string;
  created_at: string;
  updated_at: string;
  // joined
  vinculos?: UsuarioVinculo[];
}

export interface UsuarioVinculo {
  id: string;
  tenant_id: string;
  usuario_id: string;
  empresa_id: string;
  tipo_vinculo: UsuarioTipo;
  contexto_operacional?: string;
  unidade_filial?: string;
  data_inicio: string;
  data_fim?: string;
  status: VinculoStatus;
  aprovado_por_nome?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  // joined
  empresa?: { razao_social: string; nome_fantasia?: string };
}

export const TIPO_USUARIO_LABELS: Record<UsuarioTipo, string> = {
  administrador: 'Administrador',
  rh_dp: 'RH / DP',
  gestor: 'Gestor',
  lideranca: 'Liderança',
  tecnico_seguranca: 'Técnico de Segurança',
  saude_ocupacional: 'Saúde Ocupacional',
  clinica_parceira: 'Clínica Parceira',
  consultor_externo: 'Consultor Externo',
  prestador_terceiro: 'Prestador Terceiro',
  auditor: 'Auditor',
  implantador: 'Implantador',
  suporte_autorizado: 'Suporte Autorizado',
  corporativo_multiempresa: 'Corporativo Multiempresa',
  colaborador: 'Colaborador',
};

export const STATUS_LABELS: Record<UsuarioStatus, string> = {
  rascunho: 'Rascunho',
  pendente_convite: 'Pendente de Convite',
  convite_enviado: 'Convite Enviado',
  aguardando_ativacao: 'Aguardando Ativação',
  ativo: 'Ativo',
  bloqueado: 'Bloqueado',
  suspenso: 'Suspenso',
  inativo: 'Inativo',
  arquivado: 'Arquivado',
};

export const VINCULO_STATUS_LABELS: Record<VinculoStatus, string> = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  suspenso: 'Suspenso',
  revogado: 'Revogado',
  encerrado: 'Encerrado',
  expirado: 'Expirado',
};

// ── Score de qualidade cadastral ──────────────────────────────────────────────
export function calcularQualidade(u: Partial<UsuarioBase>, vinculos: UsuarioVinculo[] = []): { score: QualidadeScore; pct: number } {
  let pts = 0;
  const total = 10;
  if (u.nome_completo) pts++;
  if (u.email_principal) pts++;
  if (u.cpf) pts++;
  if (u.telefone_principal) pts++;
  if (u.data_nascimento) pts++;
  if (u.cargo_funcao) pts++;
  if (u.foto_url) pts++;
  if (u.tipo_usuario) pts++;
  if (vinculos.filter(v => v.status === 'ativo').length > 0) pts += 2;
  const pct = Math.round((pts / total) * 100);
  const score: QualidadeScore = pct >= 90 ? 'completo' : pct >= 60 ? 'suficiente' : pct >= 30 ? 'incompleto' : 'inconsistente';
  return { score, pct };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useUsuarios() {
  const { tenantId, user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios', tenantId],
    queryFn: async (): Promise<UsuarioBase[]> => {
      if (!tenantId) return [];

      const PAGE = 1000;

      const usuariosAcc: UsuarioBase[] = [];
      let fromUsuarios = 0;

      for (let i = 0; i < 50; i++) {
        const { data, error } = await (supabase as any)
          .from('usuarios_base')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('nome_completo')
          .range(fromUsuarios, fromUsuarios + PAGE - 1);

        if (error) throw error;

        const chunk = (data || []) as UsuarioBase[];
        usuariosAcc.push(...chunk);

        if (chunk.length < PAGE) break;
        fromUsuarios += PAGE;
      }

      const vinculosAcc: UsuarioVinculo[] = [];
      let fromVinculos = 0;

      for (let i = 0; i < 50; i++) {
        const { data, error } = await (supabase as any)
          .from('usuario_vinculos')
          .select('*, empresa:empresa_id(razao_social, nome_fantasia)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .range(fromVinculos, fromVinculos + PAGE - 1);

        if (error) throw error;

        const chunk = (data || []) as UsuarioVinculo[];
        vinculosAcc.push(...chunk);

        if (chunk.length < PAGE) break;
        fromVinculos += PAGE;
      }

      const vinculosPorUsuario = new Map<string, UsuarioVinculo[]>();

      for (const vinculo of vinculosAcc) {
        const lista = vinculosPorUsuario.get(vinculo.usuario_id) || [];
        lista.push(vinculo);
        vinculosPorUsuario.set(vinculo.usuario_id, lista);
      }

      return usuariosAcc.map((usuario) => ({
        ...usuario,
        vinculos: vinculosPorUsuario.get(usuario.id) || [],
      }));
    },
    enabled: !!tenantId,
  });

  const createUsuario = useMutation({
    mutationFn: async (payload: Partial<UsuarioBase>) => {
      if (!tenantId) throw new Error('Sem tenant');
      const { data, error } = await (supabase as any)
        .from('usuarios_base')
        .insert({
          ...payload,
          tenant_id: tenantId,
          criado_por_user_id: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
        })
        .select()
        .single();
      if (error) throw error;
      await logAudit(tenantId, data.id, null, 'criacao', 'usuario', null, payload);
      return data as UsuarioBase;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Usuário cadastrado!'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const updateUsuario = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<UsuarioBase> & { id: string }) => {
      const { data: before } = await (supabase as any).from('usuarios_base').select('*').eq('id', id).single();
      const { error } = await (supabase as any).from('usuarios_base').update(payload).eq('id', id);
      if (error) throw error;
      await logAudit(tenantId!, id, null, 'edicao', 'usuario', before, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Usuário atualizado!'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, justificativa }: { id: string; status: UsuarioStatus; justificativa?: string }) => {
      const { data: before } = await (supabase as any).from('usuarios_base').select('status').eq('id', id).single();
      const { error } = await (supabase as any).from('usuarios_base').update({ status }).eq('id', id);
      if (error) throw error;
      await logAudit(tenantId!, id, null, `status_${status}`, 'usuario', { status: before?.status }, { status, justificativa });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Status atualizado!'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  // ── Vínculos ──
  const createVinculo = useMutation({
    mutationFn: async (payload: Partial<UsuarioVinculo> & { usuario_id: string }) => {
      if (!tenantId) throw new Error('Sem tenant');
      const { data, error } = await (supabase as any)
        .from('usuario_vinculos')
        .insert({ ...payload, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      await logAudit(tenantId, payload.usuario_id, data.id, 'vinculo_criado', 'vinculo', null, payload);
      return data as UsuarioVinculo;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Vínculo adicionado!'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const updateVinculo = useMutation({
    mutationFn: async ({ id, usuario_id, ...payload }: Partial<UsuarioVinculo> & { id: string; usuario_id: string }) => {
      const { error } = await (supabase as any).from('usuario_vinculos').update(payload).eq('id', id);
      if (error) throw error;
      await logAudit(tenantId!, usuario_id, id, 'vinculo_atualizado', 'vinculo', null, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Vínculo atualizado!'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const encerrarVinculo = useMutation({
    mutationFn: async ({ id, usuario_id }: { id: string; usuario_id: string }) => {
      if (!tenantId) throw new Error('Sem tenant');
      const { data, error } = await (supabase as any)
        .from('usuario_vinculos')
        .update({ status: 'encerrado', data_fim: new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error('Vínculo não encontrado ou sem permissão para encerrar.');
      await logAudit(tenantId, usuario_id, id, 'vinculo_encerrado', 'vinculo', null, { status: 'encerrado' });
      return { usuario_id };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      qc.invalidateQueries({ queryKey: ['usuario-vinculos', variables.usuario_id] });
      toast.success('Vínculo encerrado!');
    },
    onError: (e: any) => toast.error('Erro ao encerrar vínculo: ' + e.message),
  });

  return {
    usuarios, isLoading,
    createUsuario, updateUsuario, updateStatus,
    createVinculo, updateVinculo, encerrarVinculo,
  };
}

// ── Audit helper ──────────────────────────────────────────────────────────────
async function logAudit(
  tenantId: string, usuarioId: string | null, vinculoId: string | null,
  acao: string, objeto: string, anterior: any, novo: any
) {
  try {
    await (supabase as any).from('usuario_audit_log').insert({
      tenant_id: tenantId, usuario_id: usuarioId, vinculo_id: vinculoId,
      acao, objeto, valor_anterior: anterior, valor_novo: novo, origem: 'manual',
    });
  } catch { /* non-blocking */ }
}
