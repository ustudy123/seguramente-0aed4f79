// Tipos para AEP Multi-Setor - Análise Ergonômica Preliminar Multi-Função

import type { 
  AEPDescricaoAtividade, 
  AEPRiscosFisicos, 
  AEPRiscosCognitivos, 
  AEPAcaoRecomendada,
  AEPAssinatura,
  AEPSinteseAvaliacao,
  ClassificacaoRisco,
  NivelRisco
} from './aep';

// Re-export types from aep.ts for convenience
export type { 
  AEPDescricaoAtividade, 
  AEPRiscosFisicos, 
  AEPRiscosCognitivos, 
  AEPAcaoRecomendada,
  AEPAssinatura,
  AEPSinteseAvaliacao,
  ClassificacaoRisco,
  NivelRisco
};

// Risco identificado pela IA
export interface RiscoIdentificado {
  tipo: string;
  eixo: 'fisico' | 'cognitivo' | 'organizacional';
  severidade: 'baixo' | 'medio' | 'alto' | 'critico';
  descricao: string;
  itemNR17?: string;
}

// Resultado da análise de uma evidência
export interface AnaliseResultadoIA {
  riscosIdentificados: RiscoIdentificado[];
  lacunasNormativas: string[];
  recomendacoes: string[];
  conformidadeEstimada: number;
  resumoGeral: string;
  transcricaoAudio?: string;
}

// Evidência contextualizada por setor/função
export interface EvidenciaAEP {
  id: string;
  setorId: string;
  setorNome: string;
  funcaoId: string;
  funcaoNome: string;
  colaboradorId?: string;
  colaboradorNome?: string;
  tipo: 'foto' | 'video' | 'audio';
  arquivoBase64: string;
  videoFrames?: string[];
  contextoTexto?: string;
  audioBase64?: string;
  transcricaoAudio?: string;
  analisadaPorIA: boolean;
  resultadoIA?: AnaliseResultadoIA;
  createdAt: string;
}

// Avaliação individual por função
export interface AEPAvaliacaoFuncao {
  id: string;
  setorId: string;
  setorNome: string;
  funcaoId: string;
  funcaoNome: string;
  colaboradoresAvaliados: string[];
  evidencias: EvidenciaAEP[];
  descricaoAtividade: AEPDescricaoAtividade;
  riscosFisicos: AEPRiscosFisicos;
  riscosCognitivos: AEPRiscosCognitivos;
  classificacaoRisco: ClassificacaoRisco;
  acoesRecomendadas: AEPAcaoRecomendada[];
}

// Empresa info
export interface AEPEmpresaInfo {
  nome: string;
  cnpj: string;
  unidade: string;
  dataAvaliacao: string;
  responsavelLevantamento: string;
  profissionalValidador?: string;
  versao: string;
}

// Documento AEP Multi-Função completo
export interface AEPDocumentoMulti {
  id?: string;
  tenant_id?: string;
  empresa: AEPEmpresaInfo;
  situacoes: SituacaoTrabalho[];
  avaliacoes: AEPAvaliacaoFuncao[];
  sinteseGeral?: AEPSinteseAvaliacao;
  acoesConsolidadas: AEPAcaoRecomendada[];
  assinaturas: AEPAssinatura;
  created_at?: string;
  updated_at?: string;
}

// Request para análise multi-evidência
export interface AnaliseMultiRequest {
  tipo: 'multi';
  evidencias: {
    setor: string;
    funcao: string;
    colaborador?: string;
    imagens?: string[];
    videoFrames?: string[];
    audioBase64?: string;
    contexto?: string;
  }[];
  empresaInfo: {
    nome: string;
    unidade: string;
  };
}

// Resposta da análise multi
export interface AnaliseMultiResponse {
  avaliacoesPorFuncao: {
    setor: string;
    funcao: string;
    riscosIdentificados: RiscoIdentificado[];
    recomendacoes: string[];
    conformidadeEstimada: number;
    resumo: string;
  }[];
  sinteseGeral: string;
  riscosCriticosGerais: string[];
}

// Par Setor+Função = unidade de análise normativa (NR-17)
export interface SituacaoTrabalho {
  id: string;
  setorId: string;
  setorNome: string;
  funcaoId: string;
  funcaoNome: string;
}

// Estado do wizard multi-função
export interface AEPMultiState {
  step: number;
  empresa: AEPEmpresaInfo;
  situacoes: SituacaoTrabalho[];  // pares setor+função obrigatórios
  evidencias: EvidenciaAEP[];
  avaliacoes: AEPAvaliacaoFuncao[];
  sinteseGeral?: AEPSinteseAvaliacao;
  acoesConsolidadas: AEPAcaoRecomendada[];
  assinaturas: AEPAssinatura;
  isAnalyzing: boolean;
}

// Mantido para compatibilidade retroativa
export interface AEPDocumentoMultiLegado {
  setoresSelecionados: { id: string; nome: string }[];
  avaliarTodosSetores: boolean;
}

// Default values
export const getDefaultAEPEmpresaInfo = (): AEPEmpresaInfo => ({
  nome: '',
  cnpj: '',
  unidade: '',
  dataAvaliacao: new Date().toISOString().split('T')[0],
  responsavelLevantamento: '',
  profissionalValidador: '',
  versao: '1.0',
});

export const getDefaultAEPAssinaturas = (): AEPAssinatura => ({
  responsavelAvaliacao: '',
  dataAssinatura: new Date().toISOString().split('T')[0],
  profissionalValidador: '',
  registroProfissional: '',
});

export const getDefaultAEPMultiState = (): AEPMultiState => ({
  step: 1,
  empresa: getDefaultAEPEmpresaInfo(),
  situacoes: [],
  evidencias: [],
  avaliacoes: [],
  sinteseGeral: undefined,
  acoesConsolidadas: [],
  assinaturas: getDefaultAEPAssinaturas(),
  isAnalyzing: false,
});

// Steps do wizard
export const AEP_MULTI_STEPS = [
  { id: 1, title: 'Configuração', description: 'Dados empresa e setores' },
  { id: 2, title: 'Evidências', description: 'Coleta contextualizada' },
  { id: 3, title: 'Análise IA', description: 'Processamento inteligente' },
  { id: 4, title: 'Revisão', description: 'Ajustes por função' },
  { id: 5, title: 'Síntese', description: 'Consolidação' },
  { id: 6, title: 'Assinaturas', description: 'Conclusão' },
] as const;
