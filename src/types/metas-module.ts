// =============================================
// TIPOS DO MÓDULO DE METAS
// =============================================

export type MetaNivel = 'estrategica' | 'unidade' | 'setor' | 'individual';
export type MetaWorkflowStatus = 'rascunho' | 'em_aprovacao' | 'ativa' | 'em_revisao' | 'suspensa' | 'encerrada' | 'cancelada';
export type IndicadorTipo = 'quantitativo' | 'qualitativo' | 'percentual' | 'financeiro' | 'marco' | 'hibrido';
export type IndicadorDirecao = 'maior_melhor' | 'menor_melhor' | 'igual_melhor' | 'faixa';
export type MetaStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'cancelada' | 'atrasada';
export type MetaPeriodo = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export interface MetaCompleta {
  id: string;
  tenant_id: string;
  empresa_id?: string;
  titulo: string;
  descricao?: string;
  nivel: MetaNivel;
  tipo: string;
  periodo: MetaPeriodo;
  ano: number;
  trimestre?: number;
  data_inicio?: string;
  data_fim?: string;
  peso: number;
  status: MetaStatus;
  workflow_status: MetaWorkflowStatus;
  progresso: number;
  
  // Hierarquia
  meta_pai_id?: string;
  meta_pai?: { titulo: string };
  metas_filhas?: MetaCompleta[];
  
  // Indicador
  indicador_nome?: string;
  indicador_tipo?: IndicadorTipo;
  indicador_unidade?: string;
  indicador_direcao?: IndicadorDirecao;
  formula_medicao?: string;
  valor_baseline?: number;
  valor_alvo?: number;
  valor_atual?: number;
  valor_minimo?: number;
  valor_maximo?: number;
  
  // Organização
  objetivo_estrategico?: string;
  unidade_id?: string;
  unidade_nome?: string;
  setor_id?: string;
  setor_nome?: string;
  departamento_id?: string;
  departamento_nome?: string;
  colaborador_id?: string;
  colaborador_nome?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  
  // Workflow
  aprovador_id?: string;
  aprovador_nome?: string;
  data_aprovacao?: string;
  justificativa_aprovacao?: string;
  
  // IA
  risco_ia?: string;
  risco_nivel?: string;
  risco_descricao?: string;
  sugestao_ia?: Record<string, unknown>;
  
  // Compartilhamento
  compartilhada?: boolean;
  tags?: string[];
  
  // Integração
  vinculo_ciclo_id?: string;
  ciclo_avaliacao_id?: string;
  swot_id?: string;
  versao?: number;
  
  // MEA
  categoria_meta?: string;
  ierm_score?: number;
  ierm_nivel?: string;
  
  criado_por?: string;
  criado_por_nome?: string;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  okrs?: MetaOkrSimples[];
  checkins?: MetaCheckin[];
  evidencias?: MetaEvidencia[];
  participantes?: MetaParticipante[];
}

export interface MetaOkrSimples {
  id: string;
  key_result: string;
  tipo: string;
  valor_atual: number;
  valor_alvo: number;
  progresso: number;
  status: MetaStatus;
  unidade?: string;
}

export interface MetaCheckin {
  id: string;
  meta_id: string;
  valor_anterior?: number;
  valor_novo?: number;
  progresso_anterior?: number;
  progresso_novo?: number;
  observacao?: string;
  bloqueios?: string;
  previsao_atingimento?: string;
  realizado_por?: string;
  realizado_por_nome?: string;
  created_at: string;
}

export interface MetaEvidencia {
  id: string;
  meta_id: string;
  tipo: string;
  titulo?: string;
  descricao?: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  link_externo?: string;
  periodo_referencia?: string;
  criado_por_nome?: string;
  created_at: string;
}

export interface MetaParticipante {
  id: string;
  meta_id: string;
  participante_id: string;
  participante_nome: string;
  papel: string;
  peso: number;
  created_at: string;
}

export interface MetaWorkflowLog {
  id: string;
  meta_id: string;
  status_anterior?: MetaWorkflowStatus;
  status_novo: MetaWorkflowStatus;
  acao: string;
  justificativa?: string;
  usuario_nome?: string;
  created_at: string;
}

export interface MetaIndicadorConfig {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  tipo: IndicadorTipo;
  unidade_medida?: string;
  formula?: string;
  direcao: IndicadorDirecao;
  origem_dados: string;
  frequencia_atualizacao: string;
  ativo: boolean;
  created_at: string;
}

export interface MetaConfiguracao {
  id: string;
  tenant_id: string;
  niveis_habilitados: string[];
  exigir_objetivo_estrategico: boolean;
  exigir_indicador: boolean;
  exigir_aprovacao_estrategica: boolean;
  exigir_aprovacao_unidade: boolean;
  exigir_aprovacao_setor: boolean;
  exigir_aprovacao_individual: boolean;
  modelo_avaliacao: string;
  escala_min: number;
  escala_max: number;
  permitir_desdobramento: boolean;
  permitir_metas_compartilhadas: boolean;
  frequencia_checkin: string;
  dias_alerta_prazo: number;
  integrar_avaliacao_desempenho: boolean;
}

// =============================================
// CONSTANTES
// =============================================

export const NIVEL_LABELS: Record<MetaNivel, string> = {
  estrategica: 'Estratégica',
  unidade: 'Unidade',
  setor: 'Setor',
  individual: 'Individual',
};

export const NIVEL_CORES: Record<MetaNivel, string> = {
  estrategica: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  unidade: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  setor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  individual: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export const WORKFLOW_STATUS_LABELS: Record<MetaWorkflowStatus, string> = {
  rascunho: 'Rascunho',
  em_aprovacao: 'Em Aprovação',
  ativa: 'Ativa',
  em_revisao: 'Em Revisão',
  suspensa: 'Suspensa',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
};

export const WORKFLOW_STATUS_CORES: Record<MetaWorkflowStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  em_aprovacao: 'bg-yellow-100 text-yellow-700',
  ativa: 'bg-green-100 text-green-700',
  em_revisao: 'bg-orange-100 text-orange-700',
  suspensa: 'bg-red-100 text-red-700',
  encerrada: 'bg-slate-200 text-slate-600',
  cancelada: 'bg-red-200 text-red-800',
};

export const INDICADOR_TIPO_LABELS: Record<string, string> = {
  quantitativo: 'Quantitativo',
  qualitativo: 'Qualitativo',
  financeiro: 'Financeiro',
};

export const INDICADOR_DIRECAO_LABELS: Record<IndicadorDirecao, string> = {
  maior_melhor: 'Maior é melhor',
  menor_melhor: 'Menor é melhor',
  igual_melhor: 'Igual ao alvo',
  faixa: 'Dentro da faixa',
};

export const PERIODO_LABELS: Record<MetaPeriodo, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const STATUS_LABELS: Record<MetaStatus, string> = {
  nao_iniciada: 'Não Iniciada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  atrasada: 'Atrasada',
};

export const STATUS_CORES: Record<MetaStatus, string> = {
  nao_iniciada: 'bg-slate-100 text-slate-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  concluida: 'bg-green-100 text-green-700',
  cancelada: 'bg-slate-100 text-slate-500',
  atrasada: 'bg-red-100 text-red-700',
};
