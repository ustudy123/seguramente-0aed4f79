/**
 * Tipos do Questionário Psicossocial YourEyes
 * Baseado em modelos internacionais (JD-R, COPSOQ, ISO 45003)
 * Adaptado à legislação brasileira (NR-01 e NR-17)
 */

// Enums
export type CampanhaPsicossocialStatus = 'rascunho' | 'ativa' | 'encerrada';
export type CampanhaPsicossocialTipo = 'regular' | 'extraordinaria';
export type CampanhaPeriodicidade = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type EventoGatilhoTipo = 'acidente' | 'denuncia' | 'reestruturacao' | 'conflito' | 'ia_sugestao' | 'solicitacao_colaborador';
export type ConvitePsicossocialStatus = 'pendente' | 'iniciado' | 'concluido' | 'expirado';
export type ConviteEnviadoVia = 'link' | 'qrcode' | 'whatsapp' | 'email';
export type InstrumentoPsicossocial = 'copsoq' | 'hse' | 'proart' | 'sipro' | 'customizado';
export type EscopoCampanha = 'empresa' | 'unidade' | 'setor' | 'funcao' | 'grupo';

// IPS - Índice Psicossocial YourEyes (0-100, higher = healthier)
export type IPSClassificacao = 'saudavel' | 'estavel' | 'atencao' | 'risco' | 'critico';

export function calcularIPSClassificacao(score: number): IPSClassificacao {
  if (score >= 80) return 'saudavel';
  if (score >= 65) return 'estavel';
  if (score >= 50) return 'atencao';
  if (score >= 35) return 'risco';
  return 'critico';
}

// IRP-S — Índice de Risco Psicossocial YourEyes (0-100, higher = more risk)
// Faixas espelham o IPS: IRP-S = 100 - IPS
export type IRPSClassificacao = 'saudavel' | 'estavel' | 'atencao' | 'risco' | 'critico';

export function calcularIRPSClassificacao(score: number): IRPSClassificacao {
  if (score <= 20) return 'saudavel';
  if (score <= 35) return 'estavel';
  if (score <= 50) return 'atencao';
  if (score <= 65) return 'risco';
  return 'critico';
}

export function getIRPSColor(classificacao: IRPSClassificacao): string {
  switch (classificacao) {
    case 'saudavel': return 'text-emerald-600';
    case 'estavel': return 'text-blue-600';
    case 'atencao': return 'text-amber-600';
    case 'risco': return 'text-orange-600';
    case 'critico': return 'text-red-600';
  }
}

export function getIRPSBgColor(classificacao: IRPSClassificacao): string {
  switch (classificacao) {
    case 'saudavel': return 'bg-emerald-100';
    case 'estavel': return 'bg-blue-100';
    case 'atencao': return 'bg-amber-100';
    case 'risco': return 'bg-orange-100';
    case 'critico': return 'bg-red-100';
  }
}

export function getIRPSLabel(classificacao: IRPSClassificacao): string {
  switch (classificacao) {
    case 'saudavel': return 'Ambiente Saudável';
    case 'estavel': return 'Estável';
    case 'atencao': return 'Atenção';
    case 'risco': return 'Risco Psicossocial';
    case 'critico': return 'Risco Crítico';
  }
}

/** Converte score IPS (alto=bom) para IRP-S (alto=ruim) para uso no SIPRO */
export function ipsParaIrps(ips: number): number {
  return 100 - ips;
}



export function getIPSColor(classificacao: IPSClassificacao): string {
  switch (classificacao) {
    case 'saudavel': return 'text-emerald-600';
    case 'estavel': return 'text-blue-600';
    case 'atencao': return 'text-amber-600';
    case 'risco': return 'text-orange-600';
    case 'critico': return 'text-red-600';
  }
}

export function getIPSBgColor(classificacao: IPSClassificacao): string {
  switch (classificacao) {
    case 'saudavel': return 'bg-emerald-100';
    case 'estavel': return 'bg-blue-100';
    case 'atencao': return 'bg-amber-100';
    case 'risco': return 'bg-orange-100';
    case 'critico': return 'bg-red-100';
  }
}

export function getIPSLabel(classificacao: IPSClassificacao): string {
  switch (classificacao) {
    case 'saudavel': return 'Ambiente Saudável';
    case 'estavel': return 'Ambiente Estável';
    case 'atencao': return 'Atenção';
    case 'risco': return 'Risco Psicossocial';
    case 'critico': return 'Risco Crítico';
  }
}

// Radar data
export interface RadarDimensao {
  subject: string;
  value: number;
  fullMark: number;
}

// Dimension result
export interface DimensaoResultado {
  dimensao: string;
  codigo?: string;
  score: number;
  nivel: 'otimo' | 'bom' | 'atencao' | 'critico';
  categoria: string;
}

// Instrumento config
export interface InstrumentoConfig {
  id: InstrumentoPsicossocial;
  nome: string;
  descricao: string;
  uso: string;
  totalPerguntas: number;
  dimensoes: string[];
}

export const INSTRUMENTOS: InstrumentoConfig[] = [
  {
    id: 'sipro',
    nome: 'SIPRO',
    descricao: 'Índice YourEyes de Risco Psicossocial Organizacional',
    uso: 'Instrumento autoral do YourEyes — 10 eixos psicossociais adaptados à NR-01/NR-17/ISO 45003 com blocos dinâmicos CET',
    totalPerguntas: 35,
    dimensoes: ['Demandas Quantitativas/Ritmo', 'Demandas Cognitivas', 'Demandas Emocionais', 'Autonomia e Controle', 'Clareza de Papéis', 'Reconhecimento e Justiça', 'Relacionamentos e Suporte', 'Sentido do Trabalho', 'Recuperação e Equilíbrio', 'Sinais Precoces'],
  },
  {
    id: 'copsoq',
    nome: 'COPSOQ III',
    descricao: 'Copenhagen Psychosocial Questionnaire',
    uso: 'Diagnóstico geral de riscos psicossociais — 15 dimensões validadas internacionalmente',
    totalPerguntas: 49,
    dimensoes: ['Demanda Quantitativa', 'Demanda Cognitiva', 'Demanda Emocional', 'Influência e Controle', 'Suporte dos Colegas', 'Suporte da Liderança', 'Clareza de Papéis', 'Conflito de Papéis', 'Reconhecimento', 'Previsibilidade', 'Sentido do Trabalho', 'Burnout', 'Equilíbrio Trabalho-Vida', 'Assédio e Comportamentos Ofensivos', 'Ameaças e Violência'],
  },
  {
    id: 'hse',
    nome: 'HSE Management Standards',
    descricao: 'Health and Safety Executive (UK)',
    uso: 'Avaliação focada em gestão organizacional — 7 padrões HSE',
    totalPerguntas: 36,
    dimensoes: ['Demanda', 'Controle', 'Suporte do Gestor', 'Suporte dos Pares', 'Relacionamentos', 'Função', 'Gestão de Mudanças'],
  },
  {
    id: 'proart',
    nome: 'PROART',
    descricao: 'Protocolo de Avaliação dos Riscos Psicossociais',
    uso: 'Diagnóstico aprofundado em cenários críticos',
    totalPerguntas: 50,
    dimensoes: ['Organização do Trabalho', 'Estilo de Gestão', 'Laços Sociais', 'Sofrimento Patogênico', 'Danos Relacionados ao Trabalho'],
  },
];

// Escala padrão de respostas (0 a 4)
export const ESCALA_RESPOSTAS = [
  { valor: 0, label: 'Nunca', emoji: '😊', cor: 'text-emerald-500' },
  { valor: 1, label: 'Raramente', emoji: '🙂', cor: 'text-green-500' },
  { valor: 2, label: 'Às vezes', emoji: '😐', cor: 'text-amber-500' },
  { valor: 3, label: 'Frequentemente', emoji: '😟', cor: 'text-orange-500' },
  { valor: 4, label: 'Sempre', emoji: '😰', cor: 'text-red-500' },
] as const;

// Interface para pergunta
export interface PerguntaPsicossocial {
  id: string;
  texto: string;
  blocoId: string;
  mapeamento: string[];
  invertida?: boolean; // Perguntas onde menor valor = pior
}

// Interface para bloco de perguntas
export interface BlocoPsicossocial {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  objetivo: string;
  perguntas: PerguntaPsicossocial[];
  dinamico?: boolean; // Bloco CET (Condições Especiais de Trabalho)
  condicao?: string; // Condição para exibir bloco dinâmico
}

// Situação de trabalho vinculada à campanha psicossocial (NR-17)
// Unidade de análise = par Setor + Função
export interface SituacaoTrabalhoCampanha {
  setorId: string;
  setorNome: string;
  funcaoId: string;
  funcaoNome: string;
}

// Campanhas
export interface CampanhaPsicossocial {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  status: CampanhaPsicossocialStatus;
  tipo: CampanhaPsicossocialTipo;
  instrumento?: InstrumentoPsicossocial;
  escopo?: EscopoCampanha;
  escopo_valores?: string[];
  // Situações de trabalho vinculadas (pares Setor+Função — NR-17)
  situacoes_trabalho?: SituacaoTrabalhoCampanha[];
  escopo_tipo?: string;
  periodicidade?: CampanhaPeriodicidade;
  data_inicio: string;
  data_fim: string;
  anonimo: boolean;
  permite_identificacao_voluntaria?: boolean;
  mensagem_institucional?: string;
  politica_uso_dados?: string;
  departamentos_ids?: string[];
  cargos_ids?: string[];
  blocos_dinamicos?: string[];
  motivo_extraordinaria?: string;
  evento_gatilho_tipo?: EventoGatilhoTipo;
  evento_gatilho_id?: string;
  campanha_anterior_id?: string;
  criado_por?: string;
  criado_por_nome?: string;
  // Resultados calculados
  ips_score?: number;
  ips_classificacao?: IPSClassificacao;
  total_respostas?: number;
  radar_data?: RadarDimensao[];
  // Índices derivados SIPRO
  irps_score?: number | null;
  ibo_score?: number | null;
  ibd_score?: number | null;
  irec_score?: number | null;
  icop_score?: number | null;
  inot_score?: number | null;
  // GAP 1: Rastreamento de exportação automática ao GRO
  gro_exportado_em?: string | null;
  gro_riscos_count?: number | null;
  created_at: string;
  updated_at: string;
}

// Convites
export interface ConvitePsicossocial {
  id: string;
  tenant_id: string;
  campanha_id: string;
  colaborador_id?: string;
  colaborador_nome: string;
  colaborador_cpf?: string;
  colaborador_cargo?: string;
  colaborador_departamento?: string;
  token: string;
  status: ConvitePsicossocialStatus;
  enviado_via?: ConviteEnviadoVia;
  enviado_em?: string;
  iniciado_em?: string;
  concluido_em?: string;
  lembrete_enviado?: boolean;
  created_at: string;
  updated_at: string;
  campanha?: CampanhaPsicossocial;
}

// Respostas
export interface RespostaPsicossocial {
  id: string;
  tenant_id: string;
  campanha_id: string;
  convite_id: string;
  colaborador_id?: string;
  respostas: Record<string, number>;
  indicadores?: IndicadoresPsicossociais;
  identificacao_voluntaria: boolean;
  tempo_resposta_segundos?: number;
  ip_address?: string;
  user_agent?: string;
  concluido_em?: string;
  created_at: string;
}

// Indicadores calculados
export interface IndicadoresPsicossociais {
  IPS?: number;
  IPS_classificacao?: IPSClassificacao;
  IRP_S: number;
  IBO_S: number;
  IBD_S: number;
  IREC_S: number;
  ICOP_S: number;
  INOT_S?: number;
  detalhes: {
    bloco: string;
    media: number;
    nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
  }[];
  dimensoes?: DimensaoResultado[];
  radar?: RadarDimensao[];
}

// Estatísticas de campanha
export interface EstatisticasCampanha {
  total_convites: number;
  pendentes: number;
  iniciados: number;
  concluidos: number;
  expirados: number;
  taxa_participacao: number;
  anonimato_garantido: boolean;
  ips?: number;
  ips_classificacao?: IPSClassificacao;
  radar?: RadarDimensao[];
  media_IRP_S?: number;
  media_IBO_S?: number;
  media_IBD_S?: number;
  media_IREC_S?: number;
  media_ICOP_S?: number;
  media_INOT_S?: number;
  por_departamento?: GrupoEstatistica[];
  por_cargo?: GrupoEstatistica[];
}

export interface GrupoEstatistica {
  nome: string;
  total: number;
  ips?: number;
  ips_classificacao?: IPSClassificacao;
  anonimato_garantido: boolean;
}

// Dados para criar campanha
export interface NovaCampanha {
  nome: string;
  descricao?: string;
  tipo?: CampanhaPsicossocialTipo;
  instrumento?: InstrumentoPsicossocial;
  periodicidade?: CampanhaPeriodicidade;
  data_inicio: string;
  data_fim: string;
  anonimo: boolean;
  permite_identificacao_voluntaria?: boolean;
  mensagem_institucional?: string;
  politica_uso_dados?: string;
  departamentos_ids?: string[];
  cargos_ids?: string[];
  blocos_dinamicos?: string[];
  // Situações de trabalho (pares Setor+Função — NR-17, obrigatório para exportação GRO)
  situacoes_trabalho?: SituacaoTrabalhoCampanha[];
  // Campos para reaplicação extraordinária
  motivo_extraordinaria?: string;
  evento_gatilho_tipo?: EventoGatilhoTipo;
  evento_gatilho_id?: string;
  campanha_anterior_id?: string;
}

// Dados para gerar convites
export interface GerarConvitesInput {
  campanha_id: string;
  colaboradores: {
    id?: string;
    nome: string;
    cpf?: string;
    cargo?: string;
    departamento?: string;
  }[];
  enviado_via?: ConviteEnviadoVia;
}

// ========================================
// DEFINIÇÃO DO QUESTIONÁRIO COMPLETO
// ========================================

export const BLOCOS_PSICOSSOCIAL: BlocoPsicossocial[] = [
  {
    id: 'bloco_1',
    numero: 1,
    titulo: 'Demandas Quantitativas e Ritmo de Trabalho',
    descricao: 'Carga, pressão por tempo, volume',
    objetivo: 'Identificar sobrecarga e pressão no trabalho',
    perguntas: [
      {
        id: 'p1_1',
        texto: 'O volume de trabalho que recebo é maior do que consigo realizar dentro do meu horário normal.',
        blocoId: 'bloco_1',
        mapeamento: ['NR-01', 'NR-17', 'ISO 45003'],
      },
      {
        id: 'p1_2',
        texto: 'Preciso trabalhar muito rápido para dar conta das tarefas.',
        blocoId: 'bloco_1',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p1_3',
        texto: 'O ritmo do trabalho é imposto sem considerar limites físicos ou mentais.',
        blocoId: 'bloco_1',
        mapeamento: ['NR-17'],
      },
      {
        id: 'p1_4',
        texto: 'Frequentemente levo trabalho para além do horário normal.',
        blocoId: 'bloco_1',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'bloco_2',
    numero: 2,
    titulo: 'Demandas Cognitivas',
    descricao: 'Atenção, concentração, decisões',
    objetivo: 'Identificar sobrecarga cognitiva',
    perguntas: [
      {
        id: 'p2_1',
        texto: 'Meu trabalho exige atenção constante durante toda a jornada.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p2_2',
        texto: 'Preciso lidar com muitas informações ao mesmo tempo.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-17'],
      },
      {
        id: 'p2_3',
        texto: 'Tomo decisões importantes sob pressão ou com pouco tempo.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p2_4',
        texto: 'Sinto dificuldade de concentração ao longo do trabalho.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'bloco_3',
    numero: 3,
    titulo: 'Demandas Emocionais',
    descricao: 'Desgaste emocional do trabalho',
    objetivo: 'Avaliar impacto emocional do trabalho',
    perguntas: [
      {
        id: 'p3_1',
        texto: 'Meu trabalho envolve lidar com conflitos ou situações emocionalmente difíceis.',
        blocoId: 'bloco_3',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p3_2',
        texto: 'Preciso esconder o que realmente sinto para continuar trabalhando.',
        blocoId: 'bloco_3',
        mapeamento: ['ISO 45003'],
      },
      {
        id: 'p3_3',
        texto: 'Saio do trabalho emocionalmente esgotado(a).',
        blocoId: 'bloco_3',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'bloco_4',
    numero: 4,
    titulo: 'Autonomia, Controle e Influência',
    descricao: 'Capacidade de decidir e organizar o trabalho',
    objetivo: 'Identificar nível de autonomia e controle',
    perguntas: [
      {
        id: 'p4_1',
        texto: 'Tenho autonomia para decidir como executar minhas tarefas.',
        blocoId: 'bloco_4',
        mapeamento: ['NR-17', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'p4_2',
        texto: 'Consigo organizar meu ritmo de trabalho.',
        blocoId: 'bloco_4',
        mapeamento: ['NR-17'],
        invertida: true,
      },
      {
        id: 'p4_3',
        texto: 'Posso fazer pausas quando sinto necessidade.',
        blocoId: 'bloco_4',
        mapeamento: ['NR-17'],
        invertida: true,
      },
      {
        id: 'p4_4',
        texto: 'Tenho espaço para opinar sobre mudanças que afetam meu trabalho.',
        blocoId: 'bloco_4',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_5',
    numero: 5,
    titulo: 'Clareza de Papéis e Organização do Trabalho',
    descricao: 'Trabalho real × prescrito',
    objetivo: 'Identificar ambiguidade e conflito de papéis',
    perguntas: [
      {
        id: 'p5_1',
        texto: 'Sei exatamente quais são minhas responsabilidades no trabalho.',
        blocoId: 'bloco_5',
        mapeamento: ['NR-01', 'NR-17'],
        invertida: true,
      },
      {
        id: 'p5_2',
        texto: 'As expectativas sobre meu desempenho são claras.',
        blocoId: 'bloco_5',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p5_3',
        texto: 'Recebo orientações contraditórias de pessoas diferentes.',
        blocoId: 'bloco_5',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p5_4',
        texto: 'O trabalho que realizo corresponde ao que foi definido para minha função.',
        blocoId: 'bloco_5',
        mapeamento: ['NR-17'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_6',
    numero: 6,
    titulo: 'Reconhecimento, Justiça e Valorização',
    descricao: 'Avaliação de percepção de justiça organizacional',
    objetivo: 'Identificar falta de reconhecimento e injustiça',
    perguntas: [
      {
        id: 'p6_1',
        texto: 'Meu esforço é reconhecido pela liderança.',
        blocoId: 'bloco_6',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p6_2',
        texto: 'Sou tratado(a) de forma justa no trabalho.',
        blocoId: 'bloco_6',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p6_3',
        texto: 'Existe coerência entre esforço, responsabilidade e recompensas.',
        blocoId: 'bloco_6',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_7',
    numero: 7,
    titulo: 'Relacionamentos, Clima e Suporte Social',
    descricao: 'Avaliação de suporte de colegas e liderança',
    objetivo: 'Identificar qualidade dos relacionamentos',
    perguntas: [
      {
        id: 'p7_1',
        texto: 'Posso contar com meus colegas quando preciso de ajuda.',
        blocoId: 'bloco_7',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p7_2',
        texto: 'Meu líder demonstra apoio quando enfrento dificuldades.',
        blocoId: 'bloco_7',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p7_3',
        texto: 'O ambiente de trabalho é respeitoso.',
        blocoId: 'bloco_7',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_8',
    numero: 8,
    titulo: 'Sentido do Trabalho e Engajamento',
    descricao: 'Avaliação de significado, pertencimento e motivação',
    objetivo: 'Identificar nível de engajamento',
    perguntas: [
      {
        id: 'p8_1',
        texto: 'Meu trabalho tem significado para mim.',
        blocoId: 'bloco_8',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p8_2',
        texto: 'Sinto orgulho do que faço.',
        blocoId: 'bloco_8',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'p8_3',
        texto: 'Sinto vontade de continuar trabalhando nesta empresa.',
        blocoId: 'bloco_8',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_9',
    numero: 9,
    titulo: 'Recuperação, Pausas e Equilíbrio Trabalho–Vida',
    descricao: 'Avaliação de descanso, recuperação e limites',
    objetivo: 'Identificar problemas de recuperação',
    perguntas: [
      {
        id: 'p9_1',
        texto: 'Consigo descansar adequadamente entre uma jornada e outra.',
        blocoId: 'bloco_9',
        mapeamento: ['NR-17', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'p9_2',
        texto: 'O trabalho interfere negativamente na minha vida pessoal.',
        blocoId: 'bloco_9',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p9_3',
        texto: 'Chego em casa com energia para atividades pessoais.',
        blocoId: 'bloco_9',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_10',
    numero: 10,
    titulo: 'Sinais Precoces de Sofrimento Psíquico',
    descricao: 'Identificação de alertas iniciais (não diagnóstico)',
    objetivo: 'Detectar sinais de alerta precoces',
    perguntas: [
      {
        id: 'p10_1',
        texto: 'Tenho tido dificuldades para dormir.',
        blocoId: 'bloco_10',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p10_2',
        texto: 'Tenho me sentido mais irritado(a) ou tenso(a).',
        blocoId: 'bloco_10',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p10_3',
        texto: 'Tenho me sentido desmotivado(a) com o trabalho.',
        blocoId: 'bloco_10',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p10_4',
        texto: 'Tenho dificuldade para relaxar, mesmo fora do trabalho.',
        blocoId: 'bloco_10',
        mapeamento: ['ISO 45003'],
      },
    ],
  },
  // ========================================
  // NOVOS BLOCOS NR-01 (Fatores Faltantes)
  // ========================================
  {
    id: 'bloco_11',
    numero: 11,
    titulo: 'Assédio e Violência no Trabalho',
    descricao: 'Avaliação de exposição a assédio moral, sexual e discriminação (R01)',
    objetivo: 'Identificar situações de assédio e violência organizacional',
    perguntas: [
      {
        id: 'p11_1',
        texto: 'Já presenciei ou fui alvo de humilhações, gritos ou tratamento desrespeitoso no trabalho.',
        blocoId: 'bloco_11',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p11_2',
        texto: 'Já fui excluído(a) de reuniões, decisões ou atividades sem justificativa.',
        blocoId: 'bloco_11',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p11_3',
        texto: 'Sinto que existe intimidação ou ameaças no ambiente de trabalho.',
        blocoId: 'bloco_11',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p11_4',
        texto: 'Já fui alvo de piadas, comentários ou comportamentos de natureza sexual indesejados.',
        blocoId: 'bloco_11',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p11_5',
        texto: 'Sinto que existe discriminação (gênero, raça, idade, orientação) no meu ambiente de trabalho.',
        blocoId: 'bloco_11',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'bloco_12',
    numero: 12,
    titulo: 'Gestão de Mudanças Organizacionais',
    descricao: 'Avaliação de como mudanças são conduzidas e comunicadas (R02)',
    objetivo: 'Identificar impacto de mudanças mal geridas na saúde mental',
    perguntas: [
      {
        id: 'p12_1',
        texto: 'As mudanças na empresa (reestruturações, novas regras, sistemas) são comunicadas com antecedência.',
        blocoId: 'bloco_12',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'p12_2',
        texto: 'Recebo apoio adequado durante períodos de mudança organizacional.',
        blocoId: 'bloco_12',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'p12_3',
        texto: 'Mudanças no trabalho geram insegurança sobre meu futuro na empresa.',
        blocoId: 'bloco_12',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p12_4',
        texto: 'Sou consultado(a) antes de mudanças que afetam diretamente minha função.',
        blocoId: 'bloco_12',
        mapeamento: ['ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_13',
    numero: 13,
    titulo: 'Eventos Violentos ou Traumáticos',
    descricao: 'Avaliação de exposição a eventos potencialmente traumáticos (R08)',
    objetivo: 'Identificar exposição a violência externa e eventos traumáticos no trabalho',
    perguntas: [
      {
        id: 'p13_1',
        texto: 'Já vivenciei ou presenciei situação de violência física no ambiente de trabalho.',
        blocoId: 'bloco_13',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p13_2',
        texto: 'Já fui exposto(a) a situações de roubo, assalto ou ameaça externa no trabalho.',
        blocoId: 'bloco_13',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p13_3',
        texto: 'Já presenciei acidente grave ou fatalidade no ambiente de trabalho.',
        blocoId: 'bloco_13',
        mapeamento: ['NR-01'],
      },
      {
        id: 'p13_4',
        texto: 'Sinto que a empresa oferece suporte adequado após eventos traumáticos.',
        blocoId: 'bloco_13',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
    ],
  },
  {
    id: 'bloco_14',
    numero: 14,
    titulo: 'Comunicação Organizacional',
    descricao: 'Avaliação da qualidade e fluxo de comunicação interna (R12)',
    objetivo: 'Identificar falhas de comunicação que impactam a saúde psicossocial',
    perguntas: [
      {
        id: 'p14_1',
        texto: 'Recebo informações claras e suficientes para realizar meu trabalho.',
        blocoId: 'bloco_14',
        mapeamento: ['NR-01', 'NR-17', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'p14_2',
        texto: 'Existe um canal eficiente para expressar opiniões e preocupações.',
        blocoId: 'bloco_14',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'p14_3',
        texto: 'A comunicação entre setores é falha e gera retrabalho ou conflitos.',
        blocoId: 'bloco_14',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p14_4',
        texto: 'Decisões importantes são comunicadas de forma transparente pela liderança.',
        blocoId: 'bloco_14',
        mapeamento: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
    ],
  },
];

// Blocos dinâmicos (CET - Condições Especiais de Trabalho)
export const BLOCOS_DINAMICOS: BlocoPsicossocial[] = [
  {
    id: 'cet_noturno',
    numero: 11,
    titulo: 'Ritmo Biológico, Sono e Fadiga – 3º Turno',
    descricao: 'Avaliação específica de riscos do trabalho noturno (ativado automaticamente conforme jornada cadastrada)',
    objetivo: 'Identificar impactos do trabalho noturno na saúde, sono e convivência social',
    dinamico: true,
    condicao: 'trabalho_noturno',
    perguntas: [
      {
        id: 'cet_n1',
        texto: 'Meu horário de trabalho prejudica meu sono.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'cet_n2',
        texto: 'Tenho dificuldade para manter um padrão regular de sono nos dias de trabalho.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'cet_n3',
        texto: 'Sinto sonolência durante o turno de trabalho.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'cet_n4',
        texto: 'Já cometi erros ou quase-erros por cansaço ou sono.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-01', 'NR-17'],
      },
      {
        id: 'cet_n5',
        texto: 'Consigo recuperar adequadamente o sono nos dias de folga.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-17', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'cet_n6',
        texto: 'Sinto impacto do trabalho noturno na minha saúde física ou mental.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-01'],
      },
      {
        id: 'cet_n7',
        texto: 'O trabalho noturno dificulta minha convivência social ou familiar.',
        blocoId: 'cet_noturno',
        mapeamento: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'cet_altura',
    numero: 12,
    titulo: 'Trabalho em Altura',
    descricao: 'Avaliação específica para trabalhadores em altura',
    objetivo: 'Identificar fatores de estresse em trabalho em altura',
    dinamico: true,
    condicao: 'trabalho_altura',
    perguntas: [
      {
        id: 'cet_a1',
        texto: 'Sinto ansiedade ou medo ao realizar trabalhos em altura.',
        blocoId: 'cet_altura',
        mapeamento: ['NR-35', 'ISO 45003'],
      },
      {
        id: 'cet_a2',
        texto: 'As condições de segurança para trabalho em altura são adequadas.',
        blocoId: 'cet_altura',
        mapeamento: ['NR-35'],
        invertida: true,
      },
    ],
  },
  {
    id: 'cet_confinado',
    numero: 13,
    titulo: 'Espaço Confinado',
    descricao: 'Avaliação específica para trabalhadores em espaço confinado',
    objetivo: 'Identificar fatores de estresse em espaço confinado',
    dinamico: true,
    condicao: 'espaco_confinado',
    perguntas: [
      {
        id: 'cet_c1',
        texto: 'Sinto claustrofobia ou desconforto em espaços confinados.',
        blocoId: 'cet_confinado',
        mapeamento: ['NR-33', 'ISO 45003'],
      },
      {
        id: 'cet_c2',
        texto: 'A comunicação com a equipe externa é eficiente durante o trabalho.',
        blocoId: 'cet_confinado',
        mapeamento: ['NR-33'],
        invertida: true,
      },
    ],
  },
  {
    id: 'cet_isolado',
    numero: 14,
    titulo: 'Trabalho Isolado',
    descricao: 'Avaliação específica para trabalhadores isolados',
    objetivo: 'Identificar impactos do isolamento no trabalho',
    dinamico: true,
    condicao: 'trabalho_isolado',
    perguntas: [
      {
        id: 'cet_i1',
        texto: 'Sinto-me isolado(a) no meu ambiente de trabalho.',
        blocoId: 'cet_isolado',
        mapeamento: ['ISO 45003'],
      },
      {
        id: 'cet_i2',
        texto: 'Tenho acesso fácil a ajuda em caso de emergência.',
        blocoId: 'cet_isolado',
        mapeamento: ['NR-01'],
        invertida: true,
      },
    ],
  },
];

// Função para obter todas as perguntas (incluindo dinâmicas se necessário)
export function obterTodasPerguntas(blocosDinamicosAtivos?: string[]): PerguntaPsicossocial[] {
  const perguntasBase = BLOCOS_PSICOSSOCIAL.flatMap(b => b.perguntas);
  
  if (blocosDinamicosAtivos && blocosDinamicosAtivos.length > 0) {
    const perguntasDinamicas = BLOCOS_DINAMICOS
      .filter(b => blocosDinamicosAtivos.includes(b.id))
      .flatMap(b => b.perguntas);
    return [...perguntasBase, ...perguntasDinamicas];
  }
  
  return perguntasBase;
}

// Função para obter todos os blocos (incluindo dinâmicos se necessário)
export function obterTodosBlocos(blocosDinamicosAtivos?: string[]): BlocoPsicossocial[] {
  if (blocosDinamicosAtivos && blocosDinamicosAtivos.length > 0) {
    const blocosDinamicosParaIncluir = BLOCOS_DINAMICOS
      .filter(b => blocosDinamicosAtivos.includes(b.id));
    return [...BLOCOS_PSICOSSOCIAL, ...blocosDinamicosParaIncluir];
  }
  
  return BLOCOS_PSICOSSOCIAL;
}
