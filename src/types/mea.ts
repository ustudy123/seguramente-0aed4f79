// =============================================
// TIPOS PARA MÓDULO MEA - METAS ERGONOMICAMENTE ALINHADAS
// =============================================

// Enums
export type ExigenciaNivel = 'nenhuma' | 'baixa' | 'moderada' | 'alta';
export type RitmoImposto = 'autogerido' | 'moderado' | 'acelerado';
export type PressaoPrazo = 'nao' | 'eventual' | 'continua';
export type GrauAutonomia = 'alto' | 'medio' | 'baixo';
export type AjusteMetodo = 'sim' | 'parcial' | 'nao';
export type HorasExtras = 'nao' | 'eventuais' | 'frequentes';
export type CompatibilidadeNivel = 'sim' | 'parcial' | 'nao';
export type IermNivel = 'segura' | 'atencao' | 'risco';
export type CategoriaMetaMEA = 'operacional' | 'estrategica' | 'desenvolvimento' | 'compliance';
export type OrigemMeta = 'modelo_funcao' | 'pdi' | 'gestor' | 'rh';
export type PremiacaoTipo = 'financeira' | 'nao_financeira' | 'hibrida' | 'sem_premiacao';
export type AcaoTipo = 'tarefa' | 'entrega' | 'treinamento' | 'atividade_recorrente';
export type AcaoPrioridade = 'baixa' | 'media' | 'alta' | 'critica';
export type AcaoStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | 'bloqueada';
export type TempoTipo = 'inicio' | 'pausa' | 'retomada' | 'encerramento';
export type HistoricoTipo = 'criacao' | 'ajuste' | 'acao_criada' | 'execucao' | 'evidencia' | 'conclusao' | 'aem_preenchida' | 'aem_revisada' | 'validacao_colaborador';

// =============================================
// AEM - Análise Ergonômica da Meta
// =============================================

export interface MetaAEM {
  id: string;
  meta_id: string;
  tenant_id: string;
  exigencia_fisica: ExigenciaNivel;
  exigencia_cognitiva: ExigenciaNivel;
  exigencia_emocional: ExigenciaNivel;
  ritmo_imposto: RitmoImposto;
  pressao_prazo: PressaoPrazo;
  grau_autonomia: GrauAutonomia;
  possibilidade_ajuste_metodo: AjusteMetodo;
  impacta_jornada: boolean;
  exige_horas_extras: HorasExtras;
  exige_atencao_continua: boolean;
  compativel_funcao: CompatibilidadeNivel;
  compativel_competencias: string;
  ierm_score: number;
  ierm_nivel: IermNivel;
  preenchido_por?: string;
  preenchido_por_nome?: string;
  revisado_por?: string;
  revisado_por_nome?: string;
  revisado_em?: string;
  colaborador_validou: boolean;
  colaborador_validou_em?: string;
  colaborador_sinaliza_dificuldade: boolean;
  colaborador_observacao?: string;
  created_at: string;
  updated_at: string;
}

export interface MetaAEMInsert {
  meta_id: string;
  exigencia_fisica?: ExigenciaNivel;
  exigencia_cognitiva?: ExigenciaNivel;
  exigencia_emocional?: ExigenciaNivel;
  ritmo_imposto?: RitmoImposto;
  pressao_prazo?: PressaoPrazo;
  grau_autonomia?: GrauAutonomia;
  possibilidade_ajuste_metodo?: AjusteMetodo;
  impacta_jornada?: boolean;
  exige_horas_extras?: HorasExtras;
  exige_atencao_continua?: boolean;
  compativel_funcao?: CompatibilidadeNivel;
  compativel_competencias?: string;
}

// =============================================
// AÇÕES DA META
// =============================================

export interface MetaAcao {
  id: string;
  meta_id: string;
  tenant_id: string;
  descricao: string;
  tipo: AcaoTipo;
  responsavel_id?: string;
  responsavel_nome?: string;
  prazo?: string;
  prioridade: AcaoPrioridade;
  evidencia_esperada?: string;
  status: AcaoStatus;
  progresso: number;
  ordem: number;
  created_at: string;
  updated_at: string;
  // Calculado
  tempo_total_minutos?: number;
  em_execucao?: boolean;
}

export interface MetaAcaoInsert {
  meta_id: string;
  descricao: string;
  tipo?: AcaoTipo;
  responsavel_id?: string;
  responsavel_nome?: string;
  prazo?: string;
  prioridade?: AcaoPrioridade;
  evidencia_esperada?: string;
}

// =============================================
// CONTROLE DE TEMPO
// =============================================

export interface MetaAcaoTempo {
  id: string;
  acao_id: string;
  meta_id: string;
  tenant_id: string;
  tipo: TempoTipo;
  registrado_por?: string;
  registrado_por_nome?: string;
  observacao?: string;
  created_at: string;
}

// =============================================
// HISTÓRICO
// =============================================

export interface MetaHistorico {
  id: string;
  meta_id: string;
  tenant_id: string;
  tipo: HistoricoTipo;
  descricao?: string;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
  usuario_id?: string;
  usuario_nome?: string;
  created_at: string;
}

// =============================================
// IERM Calculator (client-side mirror)
// =============================================

export function calcularIERM(aem: Partial<MetaAEMInsert>): { score: number; nivel: IermNivel } {
  const exigenciaMap: Record<string, number> = { alta: 3, moderada: 2, baixa: 1, nenhuma: 0 };
  const ritmoMap: Record<string, number> = { acelerado: 3, moderado: 2, autogerido: 0 };
  const pressaoMap: Record<string, number> = { continua: 3, eventual: 1, nao: 0 };
  const autonomiaMap: Record<string, number> = { baixo: 3, medio: 1, alto: 0 };
  const ajusteMap: Record<string, number> = { nao: 3, parcial: 1, sim: 0 };
  const heMap: Record<string, number> = { frequentes: 3, eventuais: 1, nao: 0 };
  const compatMap: Record<string, number> = { nao: 3, parcial: 1, sim: 0 };

  const pontosExigencia = 
    (exigenciaMap[aem.exigencia_fisica || 'nenhuma'] || 0) +
    (exigenciaMap[aem.exigencia_cognitiva || 'nenhuma'] || 0) +
    (exigenciaMap[aem.exigencia_emocional || 'nenhuma'] || 0);

  const pontosRitmo = 
    (ritmoMap[aem.ritmo_imposto || 'autogerido'] || 0) +
    (pressaoMap[aem.pressao_prazo || 'nao'] || 0);

  const pontosAutonomia = 
    (autonomiaMap[aem.grau_autonomia || 'alto'] || 0) +
    (ajusteMap[aem.possibilidade_ajuste_metodo || 'sim'] || 0);

  const pontosJornada = 
    (aem.impacta_jornada ? 2 : 0) +
    (heMap[aem.exige_horas_extras || 'nao'] || 0) +
    (aem.exige_atencao_continua ? 2 : 0);

  const pontosCompat = 
    (compatMap[aem.compativel_funcao || 'sim'] || 0) +
    (compatMap[aem.compativel_competencias || 'sim'] || 0);

  const raw = pontosExigencia + pontosRitmo + pontosAutonomia + pontosJornada + pontosCompat;
  const score = Math.min(100, Math.round((raw / 36) * 100));
  
  const nivel: IermNivel = score >= 66 ? 'risco' : score >= 33 ? 'atencao' : 'segura';

  return { score, nivel };
}

// =============================================
// CONSTANTES
// =============================================

export const CATEGORIA_META_LABELS: Record<CategoriaMetaMEA, string> = {
  operacional: 'Operacional',
  estrategica: 'Estratégica',
  desenvolvimento: 'Desenvolvimento',
  compliance: 'Compliance / Legal',
};

export const ORIGEM_META_LABELS: Record<OrigemMeta, string> = {
  modelo_funcao: 'Modelo da Função',
  pdi: 'PDI',
  gestor: 'Gestor',
  rh: 'RH',
};

export const PREMIACAO_TIPO_LABELS: Record<PremiacaoTipo, string> = {
  financeira: 'Financeira',
  nao_financeira: 'Não Financeira',
  hibrida: 'Híbrida',
  sem_premiacao: 'Sem Premiação',
};

export const ACAO_TIPO_LABELS: Record<AcaoTipo, string> = {
  tarefa: 'Tarefa',
  entrega: 'Entrega',
  treinamento: 'Treinamento',
  atividade_recorrente: 'Atividade Recorrente',
};

export const ACAO_STATUS_LABELS: Record<AcaoStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  bloqueada: 'Bloqueada',
};

export const ACAO_PRIORIDADE_LABELS: Record<AcaoPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const IERM_CONFIG: Record<IermNivel, { label: string; emoji: string; color: string; bgColor: string }> = {
  segura: { label: 'Meta Ergonomicamente Segura', emoji: '🟢', color: 'text-green-700', bgColor: 'bg-green-100' },
  atencao: { label: 'Meta em Atenção', emoji: '🟡', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  risco: { label: 'Meta com Risco Ergonômico', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const EXIGENCIA_LABELS: Record<ExigenciaNivel, string> = {
  nenhuma: 'Nenhuma',
  baixa: 'Baixa',
  moderada: 'Moderada',
  alta: 'Alta',
};
