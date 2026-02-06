/**
 * Tipos do Questionário Psicossocial Seguramente
 * Baseado em modelos internacionais (JD-R, COPSOQ, ISO 45003)
 * Adaptado à legislação brasileira (NR-01 e NR-17)
 */

// Enums
export type CampanhaPsicossocialStatus = 'rascunho' | 'ativa' | 'encerrada';
export type ConvitePsicossocialStatus = 'pendente' | 'iniciado' | 'concluido' | 'expirado';
export type ConviteEnviadoVia = 'link' | 'qrcode' | 'whatsapp' | 'email';

// Escala padrão de respostas
export const ESCALA_RESPOSTAS = [
  { valor: 1, label: 'Nunca', emoji: '😊', cor: 'text-emerald-500' },
  { valor: 2, label: 'Raramente', emoji: '🙂', cor: 'text-green-500' },
  { valor: 3, label: 'Às vezes', emoji: '😐', cor: 'text-amber-500' },
  { valor: 4, label: 'Frequentemente', emoji: '😟', cor: 'text-orange-500' },
  { valor: 5, label: 'Sempre', emoji: '😰', cor: 'text-red-500' },
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

// Campanhas
export interface CampanhaPsicossocial {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string;
  status: CampanhaPsicossocialStatus;
  data_inicio: string;
  data_fim: string;
  anonimo: boolean;
  departamentos_ids?: string[];
  cargos_ids?: string[];
  blocos_dinamicos?: string[];
  criado_por?: string;
  criado_por_nome?: string;
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
  // Relacionamentos
  campanha?: CampanhaPsicossocial;
}

// Respostas
export interface RespostaPsicossocial {
  id: string;
  tenant_id: string;
  campanha_id: string;
  convite_id: string;
  colaborador_id?: string;
  respostas: Record<string, number>; // { pergunta_id: valor }
  indicadores?: IndicadoresPsicossociais;
  tempo_resposta_segundos?: number;
  ip_address?: string;
  user_agent?: string;
  concluido_em?: string;
  created_at: string;
}

// Indicadores calculados
export interface IndicadoresPsicossociais {
  IRP_S: number; // Índice Risco Psicossocial (geral)
  IBO_S: number; // Índice Burnout
  IBD_S: number; // Índice Boreout
  IREC_S: number; // Índice Recuperação
  ICOP_S: number; // Índice Clareza Organizacional
  detalhes: {
    bloco: string;
    media: number;
    nivel: 'baixo' | 'moderado' | 'alto' | 'critico';
  }[];
}

// Estatísticas de campanha
export interface EstatisticasCampanha {
  total_convites: number;
  pendentes: number;
  iniciados: number;
  concluidos: number;
  expirados: number;
  taxa_participacao: number;
  media_IRP_S?: number;
  media_IBO_S?: number;
  media_IBD_S?: number;
  media_IREC_S?: number;
  media_ICOP_S?: number;
}

// Dados para criar campanha
export interface NovaCampanha {
  nome: string;
  descricao?: string;
  data_inicio: string;
  data_fim: string;
  anonimo: boolean;
  departamentos_ids?: string[];
  cargos_ids?: string[];
  blocos_dinamicos?: string[];
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
    descricao: 'Avaliação de carga de trabalho, pressão por tempo e ritmo imposto',
    objetivo: 'Identificar sobrecarga e pressão no trabalho',
    perguntas: [
      {
        id: 'p1_1',
        texto: 'O volume de trabalho que recebo é maior do que consigo realizar no meu horário normal.',
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
        mapeamento: ['NR-17', 'ISO 45003'],
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
    titulo: 'Demandas Cognitivas (Esforço Mental e Atenção)',
    descricao: 'Avaliação de exigência de atenção, concentração e tomada de decisão',
    objetivo: 'Identificar sobrecarga cognitiva',
    perguntas: [
      {
        id: 'p2_1',
        texto: 'Meu trabalho exige atenção constante durante todo o tempo.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p2_2',
        texto: 'Preciso lidar com muitas informações ao mesmo tempo.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p2_3',
        texto: 'Tomo decisões importantes sob pressão ou com pouco tempo.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'p2_4',
        texto: 'Sinto dificuldade de concentração ao longo da jornada.',
        blocoId: 'bloco_2',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'bloco_3',
    numero: 3,
    titulo: 'Demandas Emocionais',
    descricao: 'Identificação de desgaste emocional decorrente do trabalho',
    objetivo: 'Avaliar impacto emocional do trabalho',
    perguntas: [
      {
        id: 'p3_1',
        texto: 'Meu trabalho envolve lidar com conflitos, reclamações ou situações emocionalmente difíceis.',
        blocoId: 'bloco_3',
        mapeamento: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'p3_2',
        texto: 'Preciso esconder o que realmente sinto para conseguir trabalhar.',
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
    descricao: 'Avaliação do grau de controle do trabalhador sobre seu trabalho',
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
        mapeamento: ['NR-17', 'ISO 45003'],
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
    descricao: 'Avaliação de clareza de função, responsabilidades e conflitos de papel',
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
];

// Blocos dinâmicos (CET - Condições Especiais de Trabalho)
export const BLOCOS_DINAMICOS: BlocoPsicossocial[] = [
  {
    id: 'cet_noturno',
    numero: 11,
    titulo: 'Trabalho Noturno / 3º Turno',
    descricao: 'Avaliação específica para trabalhadores noturnos',
    objetivo: 'Identificar impactos do trabalho noturno',
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
        texto: 'Sinto impacto do trabalho noturno na minha saúde.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-01'],
      },
      {
        id: 'cet_n3',
        texto: 'Tenho dificuldade de recuperação física e mental após o turno.',
        blocoId: 'cet_noturno',
        mapeamento: ['NR-17', 'ISO 45003'],
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
