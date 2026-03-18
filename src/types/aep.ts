// Tipos para o documento AEP - Análise Ergonômica Preliminar

export interface AEPIdentificacao {
  empresa: string;
  cnpj: string;
  unidade: string;
  setor: string;
  funcao: string;
  dataAvaliacao: string;
  responsavelLevantamento: string;
  profissionalValidador?: string;
  versao: string;
}

export interface AEPDescricaoAtividade {
  descricaoGeral: string;
  sequenciaTarefas: string;
  posturasAdotadas: string;
  ferramentasUtilizadas: string;
  ritmoRepetitividade: string;
  variabilidadeTarefa: string;
  participacaoTrabalhadores?: string;
  espacoFisico: string;
  iluminacao: string;
  temperatura: string;
  ruido: string;
  umidadeVelocidadeAr?: string;
  organizacaoPosto: string;
  // §17.6 Organização do trabalho
  normasProducao?: string;
  pausasDescanso?: string;
  jornadaHorasExtras?: string;
  modoOperatorio?: string;
  indicadoresSaude?: string;
}

export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico';

export interface FatorRiscoFisico {
  fator: string;
  observacao: string;
  nivelRisco: NivelRisco;
}

export interface FatorRiscoCognitivo {
  fator: string;
  observacao: string;
  nivelRisco: NivelRisco;
}

export interface AEPRiscosFisicos {
  postura: FatorRiscoFisico;
  movimentosRepetitivos: FatorRiscoFisico;
  forcaFisica: FatorRiscoFisico;
  levantamentoCargas: FatorRiscoFisico;
  empurrarPuxar: FatorRiscoFisico;
  esforcoMuscularLocalizado: FatorRiscoFisico;
  usoAuxilioMecanico: { usado: boolean; observacao: string };
  frequenciaEsforco: FatorRiscoFisico;
}

export interface AEPRiscosCognitivos {
  ritmoImposto: FatorRiscoCognitivo;
  pressaoTempoMetas: FatorRiscoCognitivo;
  atencaoContinua: FatorRiscoCognitivo;
  sobrecargaMental: FatorRiscoCognitivo;
  subcargaBoreout: FatorRiscoCognitivo;
  autonomia: FatorRiscoCognitivo;
  pausas: FatorRiscoCognitivo;
  jornada: FatorRiscoCognitivo;
  climaRelacional: FatorRiscoCognitivo;
  sentidoTrabalho: FatorRiscoCognitivo;
}

export type ClassificacaoRisco = 'baixo' | 'medio' | 'alto';
export type NecessidadeAET = 'nao_indicado' | 'indicado';

export interface AEPSinteseAvaliacao {
  classificacaoGeral: ClassificacaoRisco;
  pontosCriticos: string[];
  necessidadeAET: NecessidadeAET;
  justificativaAET: string;
}

export type TipoAcao = 'engenharia' | 'organizacional' | 'administrativa' | 'treinamento';
export type PrioridadeAcao = 'baixa' | 'media' | 'alta' | 'urgente';

export interface AEPAcaoRecomendada {
  id: string;
  acao: string;
  tipo: TipoAcao;
  prioridade: PrioridadeAcao;
}

export interface AEPAssinatura {
  responsavelAvaliacao: string;
  assinaturaResponsavel?: string;
  dataAssinatura: string;
  profissionalValidador?: string;
  assinaturaValidador?: string;
  registroProfissional?: string;
}

export interface AEPDocumento {
  id?: string;
  tenant_id?: string;
  identificacao: AEPIdentificacao;
  descricaoAtividade: AEPDescricaoAtividade;
  riscosFisicos: AEPRiscosFisicos;
  riscosCognitivos: AEPRiscosCognitivos;
  sinteseAvaliacao: AEPSinteseAvaliacao;
  acoesRecomendadas: AEPAcaoRecomendada[];
  assinaturas: AEPAssinatura;
  created_at?: string;
  updated_at?: string;
}

// Labels
export const NIVEL_RISCO_LABELS: Record<NivelRisco, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

export const CLASSIFICACAO_RISCO_LABELS: Record<ClassificacaoRisco, string> = {
  baixo: 'Baixo risco ergonômico',
  medio: 'Médio risco ergonômico',
  alto: 'Alto risco ergonômico',
};

export const TIPO_ACAO_LABELS: Record<TipoAcao, string> = {
  engenharia: 'Engenharia',
  organizacional: 'Organizacional',
  administrativa: 'Administrativa',
  treinamento: 'Treinamento',
};

export const PRIORIDADE_ACAO_LABELS: Record<PrioridadeAcao, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const FATORES_FISICOS = [
  'postura',
  'movimentosRepetitivos',
  'forcaFisica',
  'levantamentoCargas',
  'empurrarPuxar',
  'esforcoMuscularLocalizado',
  'frequenciaEsforco',
] as const;

export const FATORES_FISICOS_LABELS: Record<typeof FATORES_FISICOS[number], string> = {
  postura: 'Postura',
  movimentosRepetitivos: 'Movimentos repetitivos',
  forcaFisica: 'Força física',
  levantamentoCargas: 'Levantamento de cargas',
  empurrarPuxar: 'Empurrar / puxar',
  esforcoMuscularLocalizado: 'Esforço muscular localizado',
  frequenciaEsforco: 'Frequência do esforço',
};

export const FATORES_COGNITIVOS = [
  'ritmoImposto',
  'pressaoTempoMetas',
  'atencaoContinua',
  'sobrecargaMental',
  'subcargaBoreout',
  'autonomia',
  'pausas',
  'jornada',
  'climaRelacional',
  'sentidoTrabalho',
] as const;

export const FATORES_COGNITIVOS_LABELS: Record<typeof FATORES_COGNITIVOS[number], string> = {
  ritmoImposto: 'Ritmo imposto',
  pressaoTempoMetas: 'Pressão por tempo / metas',
  atencaoContinua: 'Atenção contínua',
  sobrecargaMental: 'Sobrecarga mental',
  subcargaBoreout: 'Subcarga (boreout)',
  autonomia: 'Autonomia',
  pausas: 'Pausas',
  jornada: 'Jornada',
  climaRelacional: 'Clima relacional',
  sentidoTrabalho: 'Sentido do trabalho',
};

// Valores padrão para novo documento
export const getDefaultAEPDocumento = (): Omit<AEPDocumento, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> => ({
  identificacao: {
    empresa: '',
    cnpj: '',
    unidade: '',
    setor: '',
    funcao: '',
    dataAvaliacao: new Date().toISOString().split('T')[0],
    responsavelLevantamento: '',
    profissionalValidador: '',
    versao: '1.0',
  },
  descricaoAtividade: {
    descricaoGeral: '',
    sequenciaTarefas: '',
    posturasAdotadas: '',
    ferramentasUtilizadas: '',
    ritmoRepetitividade: '',
    variabilidadeTarefa: '',
    espacoFisico: '',
    iluminacao: '',
    temperatura: '',
    ruido: '',
    organizacaoPosto: '',
  },
  riscosFisicos: {
    postura: { fator: 'Postura', observacao: '', nivelRisco: 'baixo' },
    movimentosRepetitivos: { fator: 'Movimentos repetitivos', observacao: '', nivelRisco: 'baixo' },
    forcaFisica: { fator: 'Força física', observacao: '', nivelRisco: 'baixo' },
    levantamentoCargas: { fator: 'Levantamento de cargas', observacao: '', nivelRisco: 'baixo' },
    empurrarPuxar: { fator: 'Empurrar / puxar', observacao: '', nivelRisco: 'baixo' },
    esforcoMuscularLocalizado: { fator: 'Esforço muscular localizado', observacao: '', nivelRisco: 'baixo' },
    usoAuxilioMecanico: { usado: false, observacao: '' },
    frequenciaEsforco: { fator: 'Frequência do esforço', observacao: '', nivelRisco: 'baixo' },
  },
  riscosCognitivos: {
    ritmoImposto: { fator: 'Ritmo imposto', observacao: '', nivelRisco: 'baixo' },
    pressaoTempoMetas: { fator: 'Pressão por tempo / metas', observacao: '', nivelRisco: 'baixo' },
    atencaoContinua: { fator: 'Atenção contínua', observacao: '', nivelRisco: 'baixo' },
    sobrecargaMental: { fator: 'Sobrecarga mental', observacao: '', nivelRisco: 'baixo' },
    subcargaBoreout: { fator: 'Subcarga (boreout)', observacao: '', nivelRisco: 'baixo' },
    autonomia: { fator: 'Autonomia', observacao: '', nivelRisco: 'baixo' },
    pausas: { fator: 'Pausas', observacao: '', nivelRisco: 'baixo' },
    jornada: { fator: 'Jornada', observacao: '', nivelRisco: 'baixo' },
    climaRelacional: { fator: 'Clima relacional', observacao: '', nivelRisco: 'baixo' },
    sentidoTrabalho: { fator: 'Sentido do trabalho', observacao: '', nivelRisco: 'baixo' },
  },
  sinteseAvaliacao: {
    classificacaoGeral: 'baixo',
    pontosCriticos: [],
    necessidadeAET: 'nao_indicado',
    justificativaAET: '',
  },
  acoesRecomendadas: [],
  assinaturas: {
    responsavelAvaliacao: '',
    dataAssinatura: new Date().toISOString().split('T')[0],
    profissionalValidador: '',
    registroProfissional: '',
  },
});
