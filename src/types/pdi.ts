// =============================================
// TIPOS PARA MÓDULO PDI
// =============================================

export type PdiStatus = 'rascunho' | 'ativo' | 'pausado' | 'concluido' | 'cancelado';
export type PdiPeriodo = 'trimestral' | 'semestral' | 'anual' | 'personalizado';
export type PdiMetaCategoria = 'tecnica' | 'comportamental' | 'processos' | 'lideranca' | 'cultura' | 'saude_bem_estar';
export type PdiMetaStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';
export type PdiAcaoTipo = 'tarefa' | 'habito' | 'rotina' | 'projeto' | 'mentoria' | 'treinamento';
export type PdiAcaoStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'bloqueada';
export type PdiCheckinFrequencia = 'semanal' | 'quinzenal' | 'mensal';

// PDI
export interface Pdi {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cargo?: string;
  colaborador_departamento?: string;
  titulo: string;
  descricao?: string;
  periodo: PdiPeriodo;
  status: PdiStatus;
  data_inicio: string;
  data_fim: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  co_responsavel_id?: string;
  co_responsavel_nome?: string;
  progresso: number;
  pontuacao: number;
  gatilho?: string;
  ciclo_avaliacao_id?: string;
  observacoes?: string;
  criado_por?: string;
  criado_por_nome?: string;
  created_at: string;
  updated_at: string;
  metas?: PdiMeta[];
}

export interface PdiInsert {
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cargo?: string;
  colaborador_departamento?: string;
  titulo: string;
  descricao?: string;
  periodo?: PdiPeriodo;
  data_inicio: string;
  data_fim: string;
  responsavel_nome?: string;
  co_responsavel_nome?: string;
  gatilho?: string;
  observacoes?: string;
}

// META SMART
export interface PdiMeta {
  id: string;
  tenant_id: string;
  pdi_id: string;
  titulo: string;
  descricao?: string;
  categoria: PdiMetaCategoria;
  status: PdiMetaStatus;
  especifica?: string;
  mensuravel?: string;
  atingivel?: string;
  relevante?: string;
  temporal?: string;
  indicador_sucesso?: string;
  valor_base?: number;
  valor_alvo?: number;
  valor_atual?: number;
  unidade?: string;
  data_inicio?: string;
  data_fim?: string;
  frequencia_checkin?: PdiCheckinFrequencia;
  peso: number;
  progresso: number;
  dependencias?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  acoes?: PdiAcao[];
}

export interface PdiMetaInsert {
  pdi_id: string;
  titulo: string;
  descricao?: string;
  categoria?: PdiMetaCategoria;
  especifica?: string;
  mensuravel?: string;
  atingivel?: string;
  relevante?: string;
  temporal?: string;
  indicador_sucesso?: string;
  valor_base?: number;
  valor_alvo?: number;
  data_inicio?: string;
  data_fim?: string;
  frequencia_checkin?: PdiCheckinFrequencia;
  peso?: number;
  dependencias?: string;
  observacoes?: string;
}

// AÇÃO
export interface PdiAcao {
  id: string;
  tenant_id: string;
  meta_id: string;
  titulo: string;
  descricao?: string;
  tipo: PdiAcaoTipo;
  status: PdiAcaoStatus;
  data_vencimento?: string;
  frequencia?: string;
  duracao_estimada?: string;
  evidencia_obrigatoria: boolean;
  material_vinculado?: string;
  created_at: string;
  updated_at: string;
}

export interface PdiAcaoInsert {
  meta_id: string;
  titulo: string;
  descricao?: string;
  tipo?: PdiAcaoTipo;
  data_vencimento?: string;
  frequencia?: string;
  duracao_estimada?: string;
  evidencia_obrigatoria?: boolean;
  material_vinculado?: string;
}

// CHECK-IN
export interface PdiCheckin {
  id: string;
  tenant_id: string;
  meta_id: string;
  avancos?: string;
  bloqueios?: string;
  proximo_passo?: string;
  valor_atualizado?: number;
  realizado_por?: string;
  realizado_por_nome?: string;
  created_at: string;
}

export interface PdiCheckinInsert {
  meta_id: string;
  avancos?: string;
  bloqueios?: string;
  proximo_passo?: string;
  valor_atualizado?: number;
}

// EVIDÊNCIA
export interface PdiEvidencia {
  id: string;
  tenant_id: string;
  meta_id?: string;
  acao_id?: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  link_url?: string;
  validado_por?: string;
  validado_por_nome?: string;
  validado_em?: string;
  criado_por?: string;
  criado_por_nome?: string;
  created_at: string;
}

// FEEDBACK
export interface PdiFeedback {
  id: string;
  tenant_id: string;
  pdi_id: string;
  meta_id?: string;
  tipo: string;
  ponto_forte?: string;
  ponto_melhorar?: string;
  recomendacao?: string;
  comentario?: string;
  autor_id?: string;
  autor_nome?: string;
  created_at: string;
}

export interface PdiFeedbackInsert {
  pdi_id: string;
  meta_id?: string;
  tipo?: string;
  ponto_forte?: string;
  ponto_melhorar?: string;
  recomendacao?: string;
  comentario?: string;
}

// LABELS
export const PDI_STATUS_LABELS: Record<PdiStatus, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const PDI_PERIODO_LABELS: Record<PdiPeriodo, string> = {
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  personalizado: 'Personalizado',
};

export const PDI_META_CATEGORIA_LABELS: Record<PdiMetaCategoria, string> = {
  tecnica: 'Técnica',
  comportamental: 'Comportamental',
  processos: 'Processos',
  lideranca: 'Liderança',
  cultura: 'Cultura',
  saude_bem_estar: 'Saúde e Bem-estar',
};

export const PDI_META_STATUS_LABELS: Record<PdiMetaStatus, string> = {
  nao_iniciada: 'Não Iniciada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

export const PDI_ACAO_TIPO_LABELS: Record<PdiAcaoTipo, string> = {
  tarefa: 'Tarefa',
  habito: 'Hábito',
  rotina: 'Rotina',
  projeto: 'Projeto',
  mentoria: 'Mentoria',
  treinamento: 'Treinamento',
};

export const PDI_ACAO_STATUS_LABELS: Record<PdiAcaoStatus, string> = {
  nao_iniciada: 'Não Iniciada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

export const PDI_CHECKIN_FREQ_LABELS: Record<PdiCheckinFrequencia, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};
