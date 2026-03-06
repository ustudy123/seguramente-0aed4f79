// =============================================
// TIPOS PARA MÓDULO DE AVALIAÇÕES DE DESEMPENHO
// =============================================

// Enums
export type AvaliacaoTipo = 'simples' | '360';
export type AvaliacaoCicloStatus = 'rascunho' | 'ativo' | 'encerrado' | 'analisando';
export type RespostaStatus = 'pendente' | 'em_andamento' | 'concluida';
export type TipoAvaliador = 'auto' | 'gestor' | 'par' | 'subordinado' | 'cliente_interno';
export type MetaPeriodo = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type MetaStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'cancelada' | 'atrasada';
export type OkrTipo = 'percentual' | 'quantidade' | 'binario' | 'monetario';

// =============================================
// TEMPLATES
// =============================================

export interface Criterio {
  id: string;
  nome: string;
  descricao?: string;
  peso: number;
  categoria: string;
}

export interface Categoria {
  id: string;
  nome: string;
  descricao?: string;
  peso: number;
}

export interface EscalaLabel {
  valor: number;
  label: string;
}

export interface AvaliacaoTemplate {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  tipo: AvaliacaoTipo;
  categorias: Categoria[];
  criterios: Criterio[];
  escala_min: number;
  escala_max: number;
  escala_labels?: EscalaLabel[];
  permite_comentarios: boolean;
  ativo: boolean;
  criado_por?: string;
  criado_por_nome?: string;
  created_at: string;
  updated_at: string;
}

export interface AvaliacaoTemplateInsert {
  nome: string;
  descricao?: string;
  tipo?: AvaliacaoTipo;
  categorias?: Categoria[];
  criterios?: Criterio[];
  escala_min?: number;
  escala_max?: number;
  escala_labels?: EscalaLabel[];
  permite_comentarios?: boolean;
  ativo?: boolean;
}

// =============================================
// CICLOS
// =============================================

export interface Config360 {
  auto: boolean;
  gestor: boolean;
  pares: number;
  subordinados: boolean;
  cliente_interno: boolean;
}

export interface AvaliacaoCiclo {
  id: string;
  tenant_id: string;
  template_id: string;
  nome: string;
  descricao?: string;
  status: AvaliacaoCicloStatus;
  data_inicio: string;
  data_fim: string;
  config_360: Config360;
  departamentos_ids?: string[];
  notificacoes_enviadas: boolean;
  criado_por?: string;
  criado_por_nome?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  template?: AvaliacaoTemplate;
  respostas?: AvaliacaoResposta[];
}

export interface AvaliacaoCicloInsert {
  template_id: string;
  nome: string;
  descricao?: string;
  status?: AvaliacaoCicloStatus;
  data_inicio: string;
  data_fim: string;
  config_360?: Config360;
  departamentos_ids?: string[];
}

// =============================================
// RESPOSTAS
// =============================================

export interface NotasCriterios {
  [criterioId: string]: number;
}

export interface AvaliacaoResposta {
  id: string;
  tenant_id: string;
  ciclo_id: string;
  avaliado_id: string;
  avaliado_nome: string;
  avaliador_id?: string;
  avaliador_nome?: string;
  tipo_avaliador: TipoAvaliador;
  status: RespostaStatus;
  notas_criterios: NotasCriterios;
  nota_geral?: number;
  comentario_geral?: string;
  pontos_fortes?: string;
  areas_desenvolvimento?: string;
  data_inicio?: string;
  data_conclusao?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  ciclo?: AvaliacaoCiclo;
  feedbacks?: AvaliacaoFeedback[];
}

export interface AvaliacaoRespostaInsert {
  ciclo_id: string;
  avaliado_id: string;
  avaliado_nome: string;
  avaliador_id?: string;
  avaliador_nome?: string;
  tipo_avaliador: TipoAvaliador;
  status?: RespostaStatus;
  notas_criterios?: NotasCriterios;
  nota_geral?: number;
  comentario_geral?: string;
  pontos_fortes?: string;
  areas_desenvolvimento?: string;
}

export interface AvaliacaoRespostaUpdate {
  status?: RespostaStatus;
  notas_criterios?: NotasCriterios;
  nota_geral?: number;
  comentario_geral?: string;
  pontos_fortes?: string;
  areas_desenvolvimento?: string;
  data_inicio?: string;
  data_conclusao?: string;
}

// =============================================
// FEEDBACKS
// =============================================

export interface AvaliacaoFeedback {
  id: string;
  tenant_id: string;
  resposta_id: string;
  categoria: string;
  criterio: string;
  feedback?: string;
  created_at: string;
}

export interface AvaliacaoFeedbackInsert {
  resposta_id: string;
  categoria: string;
  criterio: string;
  feedback?: string;
}

// =============================================
// METAS
// =============================================

export interface Meta {
  id: string;
  tenant_id: string;
  colaborador_id?: string;
  colaborador_nome?: string;
  departamento_id?: string;
  departamento_nome?: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  periodo: MetaPeriodo;
  ano: number;
  trimestre?: number;
  data_inicio?: string;
  data_fim?: string;
  peso: number;
  status: MetaStatus;
  progresso: number;
  vinculo_ciclo_id?: string;
  criado_por?: string;
  criado_por_nome?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  okrs?: MetaOkr[];
}

export interface MetaInsert {
  colaborador_id?: string;
  colaborador_nome?: string;
  departamento_id?: string;
  departamento_nome?: string;
  titulo: string;
  descricao?: string;
  tipo?: string;
  periodo?: MetaPeriodo;
  ano: number;
  trimestre?: number;
  data_inicio?: string;
  data_fim?: string;
  peso?: number;
  vinculo_ciclo_id?: string;
}

export interface MetaUpdate {
  titulo?: string;
  descricao?: string;
  tipo?: string;
  periodo?: MetaPeriodo;
  data_inicio?: string;
  data_fim?: string;
  peso?: number;
  status?: MetaStatus;
  progresso?: number;
}

// =============================================
// OKRs
// =============================================

export interface MetaOkr {
  id: string;
  tenant_id: string;
  meta_id: string;
  key_result: string;
  descricao?: string;
  tipo: OkrTipo;
  valor_inicial: number;
  valor_atual: number;
  valor_alvo: number;
  unidade?: string;
  progresso: number;
  status: MetaStatus;
  responsavel_id?: string;
  responsavel_nome?: string;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  checkins?: OkrCheckin[];
}

export interface MetaOkrInsert {
  meta_id: string;
  key_result: string;
  descricao?: string;
  tipo?: OkrTipo;
  valor_inicial?: number;
  valor_atual?: number;
  valor_alvo: number;
  unidade?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
}

export interface MetaOkrUpdate {
  key_result?: string;
  descricao?: string;
  tipo?: OkrTipo;
  valor_atual?: number;
  valor_alvo?: number;
  unidade?: string;
  progresso?: number;
  status?: MetaStatus;
  responsavel_id?: string;
  responsavel_nome?: string;
}

// =============================================
// CHECK-INS
// =============================================

export interface OkrCheckin {
  id: string;
  tenant_id: string;
  okr_id: string;
  valor_anterior?: number;
  valor_novo: number;
  observacao?: string;
  realizado_por?: string;
  realizado_por_nome?: string;
  created_at: string;
}

export interface OkrCheckinInsert {
  okr_id: string;
  valor_anterior?: number;
  valor_novo: number;
  observacao?: string;
}

// =============================================
// 9-BOX
// =============================================

export interface Avaliacao9Box {
  id: string;
  tenant_id: string;
  ciclo_id?: string;
  colaborador_id: string;
  colaborador_nome: string;
  desempenho: 1 | 2 | 3;
  potencial: 1 | 2 | 3;
  quadrante: string;
  justificativa?: string;
  avaliador_id?: string;
  avaliador_nome?: string;
  data_avaliacao: string;
  created_at: string;
  updated_at: string;
}

export interface Avaliacao9BoxInsert {
  ciclo_id?: string;
  colaborador_id: string;
  colaborador_nome: string;
  desempenho: 1 | 2 | 3;
  potencial: 1 | 2 | 3;
  quadrante: string;
  justificativa?: string;
}

// =============================================
// CONSTANTES
// =============================================

export const TIPO_AVALIADOR_LABELS: Record<TipoAvaliador, string> = {
  auto: 'Autoavaliação',
  gestor: 'Gestor',
  par: 'Par',
  subordinado: 'Subordinado',
};

export const STATUS_RESPOSTA_LABELS: Record<RespostaStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
};

export const STATUS_CICLO_LABELS: Record<AvaliacaoCicloStatus, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  analisando: 'Em Análise',
};

export const STATUS_META_LABELS: Record<MetaStatus, string> = {
  nao_iniciada: 'Não Iniciada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  atrasada: 'Atrasada',
};

export const PERIODO_LABELS: Record<MetaPeriodo, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const OKR_TIPO_LABELS: Record<OkrTipo, string> = {
  percentual: 'Percentual (%)',
  quantidade: 'Quantidade',
  binario: 'Sim/Não',
  monetario: 'Monetário (R$)',
};

export const QUADRANTES_9BOX: Record<string, { nome: string; cor: string; descricao: string }> = {
  '1-1': { nome: 'Baixo Desempenho / Baixo Potencial', cor: 'bg-red-500', descricao: 'Avaliar continuidade' },
  '1-2': { nome: 'Baixo Desempenho / Médio Potencial', cor: 'bg-orange-400', descricao: 'Desenvolver ou realocar' },
  '1-3': { nome: 'Baixo Desempenho / Alto Potencial', cor: 'bg-yellow-400', descricao: 'Enigma - Investigar bloqueios' },
  '2-1': { nome: 'Médio Desempenho / Baixo Potencial', cor: 'bg-orange-400', descricao: 'Contribuidor sólido' },
  '2-2': { nome: 'Médio Desempenho / Médio Potencial', cor: 'bg-yellow-400', descricao: 'Profissional em desenvolvimento' },
  '2-3': { nome: 'Médio Desempenho / Alto Potencial', cor: 'bg-lime-400', descricao: 'Futuro líder - Acelerar' },
  '3-1': { nome: 'Alto Desempenho / Baixo Potencial', cor: 'bg-blue-400', descricao: 'Especialista - Manter motivado' },
  '3-2': { nome: 'Alto Desempenho / Médio Potencial', cor: 'bg-green-400', descricao: 'Alto contribuidor - Valorizar' },
  '3-3': { nome: 'Alto Desempenho / Alto Potencial', cor: 'bg-emerald-500', descricao: 'Estrela - Reter e promover' },
};

// Templates pré-definidos
export const TEMPLATES_PADRAO: Partial<AvaliacaoTemplate>[] = [
  {
    nome: 'Competências Comportamentais',
    descricao: 'Avalia soft skills e competências interpessoais',
    tipo: 'simples',
    categorias: [
      { id: 'comunicacao', nome: 'Comunicação', peso: 1 },
      { id: 'trabalho_equipe', nome: 'Trabalho em Equipe', peso: 1 },
      { id: 'lideranca', nome: 'Liderança', peso: 1 },
      { id: 'proatividade', nome: 'Proatividade', peso: 1 },
    ],
    criterios: [
      { id: 'c1', nome: 'Clareza na comunicação', categoria: 'comunicacao', peso: 1 },
      { id: 'c2', nome: 'Escuta ativa', categoria: 'comunicacao', peso: 1 },
      { id: 'c3', nome: 'Colaboração', categoria: 'trabalho_equipe', peso: 1 },
      { id: 'c4', nome: 'Resolução de conflitos', categoria: 'trabalho_equipe', peso: 1 },
      { id: 'c5', nome: 'Influência positiva', categoria: 'lideranca', peso: 1 },
      { id: 'c6', nome: 'Tomada de decisão', categoria: 'lideranca', peso: 1 },
      { id: 'c7', nome: 'Iniciativa', categoria: 'proatividade', peso: 1 },
      { id: 'c8', nome: 'Adaptabilidade', categoria: 'proatividade', peso: 1 },
    ],
    escala_min: 1,
    escala_max: 5,
    escala_labels: [
      { valor: 1, label: 'Insuficiente' },
      { valor: 2, label: 'Em Desenvolvimento' },
      { valor: 3, label: 'Atende' },
      { valor: 4, label: 'Supera' },
      { valor: 5, label: 'Excepcional' },
    ],
  },
  {
    nome: 'Avaliação 360° Completa',
    descricao: 'Avaliação multidirecional incluindo gestor, pares e autoavaliação',
    tipo: '360',
    categorias: [
      { id: 'resultados', nome: 'Resultados e Entregas', peso: 1.5 },
      { id: 'comportamento', nome: 'Comportamento', peso: 1 },
      { id: 'desenvolvimento', nome: 'Desenvolvimento', peso: 1 },
    ],
    criterios: [
      { id: 'r1', nome: 'Cumprimento de metas', categoria: 'resultados', peso: 1 },
      { id: 'r2', nome: 'Qualidade das entregas', categoria: 'resultados', peso: 1 },
      { id: 'r3', nome: 'Pontualidade', categoria: 'resultados', peso: 1 },
      { id: 'b1', nome: 'Ética e integridade', categoria: 'comportamento', peso: 1 },
      { id: 'b2', nome: 'Relacionamento interpessoal', categoria: 'comportamento', peso: 1 },
      { id: 'd1', nome: 'Busca por aprendizado', categoria: 'desenvolvimento', peso: 1 },
      { id: 'd2', nome: 'Compartilhamento de conhecimento', categoria: 'desenvolvimento', peso: 1 },
    ],
    escala_min: 1,
    escala_max: 5,
  },
];
