// Types for Atestados module

export type AfastamentoTipo = 'ocupacional' | 'licencas' | 'atestados';

export type AfastamentoSubtipoOcupacional = 
  | 'periodico'
  | 'demissional'
  | 'mudanca_risco'
  | 'retorno_trabalho'
  | 'admissional';

export type AfastamentoSubtipoLicencas = 
  | 'maternidade'
  | 'maternidade_adocao'
  | 'paternidade'
  | 'casamento'
  | 'falecimento'
  | 'militar'
  | 'sindical'
  | 'outras_licencas';

export type AfastamentoSubtipoAtestados = 
  | 'acidente_trabalho'
  | 'doenca_trabalho'
  | 'acidente_nao_trabalho'
  | 'doenca_nao_trabalho'
  | 'prorrogacao'
  | 'aborto_nao_criminoso'
  | 'aposentadoria_invalidez'
  | 'suspensao_contrato'
  | 'outros_motivos';

// Manter compatibilidade com interfaces antigas enquanto refatoramos
export type AtestadoTipo = AfastamentoTipo;
export type AtestadoSubtipoAssistencial = AfastamentoSubtipoLicencas | AfastamentoSubtipoAtestados;
export type AtestadoSubtipoOcupacional = AfastamentoSubtipoOcupacional;

export type GrupoClinico = 
  | 'mental'
  | 'osteomuscular'
  | 'respiratorio'
  | 'cardiovascular'
  | 'digestivo'
  | 'dermatologico'
  | 'neurologico'
  | 'infeccioso'
  | 'oncologico'
  | 'endocrino'
  | 'outro';

export type NexoTrabalho = 'nao' | 'em_analise' | 'sim';

export type AptidaoOcupacional = 
  | 'apto'
  | 'apto_com_restricoes'
  | 'inapto_temporario'
  | 'inapto';

export type BeneficioINSSEspecie = 'b31' | 'b91';

export type AfastamentoStatus = 'ativo' | 'encerrado' | 'beneficio_inss';

export type EventoSaudeStatus = 'aberto' | 'em_acompanhamento' | 'encerrado';

// Main interfaces
export interface Atestado {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  colaborador_cargo: string | null;
  colaborador_departamento: string | null;
  
  tipo: AtestadoTipo;
  subtipo_assistencial: AtestadoSubtipoAssistencial | null;
  subtipo_ocupacional: AtestadoSubtipoOcupacional | null;
  
  data_emissao: string;
  profissional_nome: string;
  profissional_registro: string;
  profissional_tipo: string | null;
  profissional_uf: string | null;
  profissional_rqe: string | null;
  profissional_telefone: string | null;
  profissional_email: string | null;
  profissional_endereco: string | null;
  
  data_inicio_afastamento: string | null;
  data_fim_afastamento: string | null;
  dias_afastamento: number | null;
  horas_afastamento: number | null;
  unidade_afastamento: string;
  
  contem_cid: boolean;
  cid_codigo: string | null;
  cid_autorizado: boolean | null;
  grupo_clinico: GrupoClinico | null;
  nexo_trabalho: NexoTrabalho;
  
  aptidao: AptidaoOcupacional | null;
  restricoes: string | null;
  observacoes_ocupacionais: string | null;
  
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  
  evento_saude_id: string | null;
  afastamento_id: string | null;
  
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface Afastamento {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  
  data_inicio: string;
  data_fim: string | null;
  dias_totais: number;
  
  status: AfastamentoStatus;
  motivo_principal: GrupoClinico | null;
  nexo_trabalho: NexoTrabalho;
  
  alerta_15_dias: boolean;
  alerta_30_dias: boolean;
  aso_retorno_pendente: boolean;
  aso_retorno_id: string | null;
  
  evento_saude_id: string | null;
  beneficio_inss_id: string | null;
  
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoSaude {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  
  codigo: string;
  titulo: string;
  descricao: string | null;
  
  grupo_clinico_principal: GrupoClinico | null;
  nexo_trabalho: NexoTrabalho;
  status: EventoSaudeStatus;
  
  data_inicio: string;
  data_fim: string | null;
  
  total_atestados: number;
  total_dias_afastamento: number;
  
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface BeneficioINSS {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  
  numero_beneficio: string | null;
  especie: BeneficioINSSEspecie;
  data_inicio: string;
  data_fim: string | null;
  data_alta: string | null;
  
  gera_estabilidade: boolean;
  data_fim_estabilidade: string | null;
  
  evento_saude_id: string | null;
  afastamento_id: string | null;
  
  arquivo_url: string | null;
  arquivo_nome: string | null;
  
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertaSaude {
  id: string;
  tenant_id: string;
  
  tipo: string;
  referencia_tipo: string;
  referencia_id: string;
  
  colaborador_id: string | null;
  colaborador_nome: string;
  
  titulo: string;
  descricao: string | null;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  
  lido: boolean;
  resolvido: boolean;
  resolvido_por: string | null;
  resolvido_em: string | null;
  
  acao_gerada_id: string | null;
  
  created_at: string;
}

// Form data types
export interface AtestadoFormData {
  colaborador_nome: string;
  colaborador_cpf?: string;
  colaborador_cargo?: string;
  colaborador_departamento?: string;
  
  tipo: AtestadoTipo;
  subtipo_assistencial?: AtestadoSubtipoAssistencial;
  subtipo_ocupacional?: AtestadoSubtipoOcupacional;
  
  data_emissao: string;
  profissional_nome: string;
  profissional_registro: string;
  profissional_tipo?: string;
  profissional_uf?: string;
  profissional_rqe?: string;
  profissional_telefone?: string;
  profissional_email?: string;
  profissional_endereco?: string;
  
  data_inicio_afastamento?: string;
  data_fim_afastamento?: string;
  dias_afastamento?: number;
  horas_afastamento?: number;
  unidade_afastamento?: string;
  
  contem_cid?: boolean;
  cid_codigo?: string;
  cid_autorizado?: boolean;
  grupo_clinico?: GrupoClinico;
  nexo_trabalho?: NexoTrabalho;
  
  aptidao?: AptidaoOcupacional;
  restricoes?: string;
  observacoes_ocupacionais?: string;
  
  observacoes?: string;
  evento_saude_id?: string;
}

// Extracted data from AI
export interface AtestadoExtractedData {
  colaborador_nome?: string;
  colaborador_cpf?: string;
  profissional_nome?: string;
  profissional_registro?: string;
  profissional_uf?: string;
  profissional_rqe?: string;
  profissional_telefone?: string;
  profissional_email?: string;
  profissional_endereco?: string;
  data_emissao?: string;
  dias_afastamento?: number;
  horas_afastamento?: number;
  unidade_afastamento?: 'dias' | 'horas';
  data_inicio_afastamento?: string;
  data_fim_afastamento?: string;
  contem_cid?: boolean;
  cid_codigo?: string;
  cid_autorizado?: boolean;
  observacoes?: string;
}

// Labels
export const AFASTAMENTO_TIPO_LABELS: Record<AfastamentoTipo, string> = {
  ocupacional: 'Ocupacional (ASO)',
  licencas: 'Licenças',
  atestados: 'Atestados Médicos',
};

export const SUBTIPO_OCUPACIONAL_LABELS: Record<string, string> = {
  periodico: 'Periódico',
  demissional: 'Demissional',
  mudanca_risco: 'Mudança de risco ocupacional',
  retorno_trabalho: 'Retorno ao trabalho',
  admissional: 'Admissional',
};

export const SUBTIPO_LICENCAS_LABELS: Record<AfastamentoSubtipoLicencas, string> = {
  maternidade: 'Licença-Maternidade',
  maternidade_adocao: 'Licença-Maternidade por adoção ou guarda',
  paternidade: 'Licença-Paternidade',
  casamento: 'Licença Casamento',
  falecimento: 'Licença Falecimento',
  militar: 'Licença Serviço Militar',
  sindical: 'Licença Mandato Sindical',
  outras_licencas: 'Outras Licenças',
};

export const SUBTIPO_ATESTADOS_LABELS: Record<string, string> = {
  acidente_trabalho: 'Acidente / Doença do trabalho',
  acidente_nao_trabalho: 'Acidente / Doença não relacionada ao trabalho',
  prorrogacao: 'Prorrogação de afastamento / licença',
  aborto_nao_criminoso: 'Aborto não criminoso',
  aposentadoria_invalidez: 'Aposentadoria por invalidez',
  suspensao_contrato: 'Suspensão Contrato de Trabalho (476-A)',
  outros_motivos: 'Outros motivos de afastamento',
};

// Aliases para compatibilidade
export const ATESTADO_TIPO_LABELS = AFASTAMENTO_TIPO_LABELS;
export const SUBTIPO_ASSISTENCIAL_LABELS = { ...SUBTIPO_LICENCAS_LABELS, ...SUBTIPO_ATESTADOS_LABELS };

export const GRUPO_CLINICO_LABELS: Record<GrupoClinico, string> = {
  mental: 'Saúde Mental',
  osteomuscular: 'Osteomuscular',
  respiratorio: 'Respiratório',
  cardiovascular: 'Cardiovascular',
  digestivo: 'Digestivo',
  dermatologico: 'Dermatológico',
  neurologico: 'Neurológico',
  infeccioso: 'Infeccioso',
  oncologico: 'Oncológico',
  endocrino: 'Endócrino',
  outro: 'Outro',
};

export const NEXO_TRABALHO_LABELS: Record<NexoTrabalho, string> = {
  nao: 'Não',
  em_analise: 'Em Análise',
  sim: 'Sim',
};

export const APTIDAO_LABELS: Record<AptidaoOcupacional, string> = {
  apto: 'Apto',
  apto_com_restricoes: 'Apto com Restrições',
  inapto_temporario: 'Inapto Temporário',
  inapto: 'Inapto',
};

export const BENEFICIO_ESPECIE_LABELS: Record<BeneficioINSSEspecie, string> = {
  b31: 'B31 - Auxílio Doença Comum',
  b91: 'B91 - Auxílio Doença Acidentário',
};

export const AFASTAMENTO_STATUS_LABELS: Record<AfastamentoStatus, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  beneficio_inss: 'Benefício INSS',
};

export const EVENTO_SAUDE_STATUS_LABELS: Record<EventoSaudeStatus, string> = {
  aberto: 'Aberto',
  em_acompanhamento: 'Em Acompanhamento',
  encerrado: 'Encerrado',
};

// Colors
export const GRUPO_CLINICO_COLORS: Record<GrupoClinico, string> = {
  mental: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  osteomuscular: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  respiratorio: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cardiovascular: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  digestivo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  dermatologico: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  neurologico: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  infeccioso: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  oncologico: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  endocrino: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  outro: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

export const APTIDAO_COLORS: Record<AptidaoOcupacional, string> = {
  apto: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  apto_com_restricoes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  inapto_temporario: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  inapto: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};
