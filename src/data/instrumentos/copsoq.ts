/**
 * COPSOQ III – Copenhagen Psychosocial Questionnaire
 * Versão adaptada para o Brasil (NR-01 / NR-17 / ISO 45003)
 * 
 * Escala de resposta: 0 = Nunca | 1 = Raramente | 2 = Às vezes | 3 = Frequentemente | 4 = Sempre
 * Perguntas "invertida: true" → maior pontuação = melhor (protetor)
 */

export interface PerguntaInstrumento {
  id: string;
  texto: string;
  dimensao: string;
  subdimensao?: string;
  invertida?: boolean;
  normas?: string[];
  peso?: number; // 1 = normal, 2 = dobro de peso
}

export interface DimensaoInstrumento {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'risco' | 'protetor';
  normas: string[];
  grupo?: string;
  perguntas: PerguntaInstrumento[];
}

export const COPSOQ_DIMENSOES: DimensaoInstrumento[] = [
  {
    id: 'copsoq_demanda_quantitativa',
    nome: 'Demanda Quantitativa',
    descricao: 'Volume de trabalho, ritmo e pressão por tempo',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_dq1',
        texto: 'Com que frequência você não tem tempo suficiente para concluir todas as tarefas do trabalho?',
        dimensao: 'copsoq_demanda_quantitativa',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'cq_dq2',
        texto: 'Com que frequência você precisa trabalhar muito rápido?',
        dimensao: 'copsoq_demanda_quantitativa',
        normas: ['NR-17'],
      },
      {
        id: 'cq_dq3',
        texto: 'Com que frequência seu trabalho exige que você trabalhe muito intensamente?',
        dimensao: 'copsoq_demanda_quantitativa',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'cq_dq4',
        texto: 'Com que frequência é impossível terminar todas as tarefas durante o dia de trabalho?',
        dimensao: 'copsoq_demanda_quantitativa',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_demanda_cognitiva',
    nome: 'Demanda Cognitiva',
    descricao: 'Exigências de atenção, concentração, tomada de decisão',
    tipo: 'risco',
    normas: ['NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_dc1',
        texto: 'Seu trabalho requer que você memorize muitas coisas?',
        dimensao: 'copsoq_demanda_cognitiva',
        normas: ['NR-17'],
      },
      {
        id: 'cq_dc2',
        texto: 'Seu trabalho requer que você tome decisões difíceis?',
        dimensao: 'copsoq_demanda_cognitiva',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'cq_dc3',
        texto: 'Seu trabalho requer atenção constante?',
        dimensao: 'copsoq_demanda_cognitiva',
        normas: ['NR-17'],
      },
      {
        id: 'cq_dc4',
        texto: 'Seu trabalho exige que você tenha iniciativa?',
        dimensao: 'copsoq_demanda_cognitiva',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_demanda_emocional',
    nome: 'Demanda Emocional',
    descricao: 'Desgaste emocional, supressão de sentimentos',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_de1',
        texto: 'Seu trabalho coloca você em situações emocionalmente perturbadoras?',
        dimensao: 'copsoq_demanda_emocional',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'cq_de2',
        texto: 'Você se sente emocionalmente esgotado(a) após o trabalho?',
        dimensao: 'copsoq_demanda_emocional',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_de3',
        texto: 'Seu trabalho o(a) afeta emocionalmente?',
        dimensao: 'copsoq_demanda_emocional',
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_de4',
        texto: 'É necessário ocultar seus sentimentos no trabalho?',
        dimensao: 'copsoq_demanda_emocional',
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_influencia',
    nome: 'Influência e Controle',
    descricao: 'Autonomia, participação em decisões',
    tipo: 'protetor',
    normas: ['NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_in1',
        texto: 'Você tem influência sobre como executa suas tarefas de trabalho?',
        dimensao: 'copsoq_influencia',
        invertida: true,
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'cq_in2',
        texto: 'Você tem influência sobre a quantidade de trabalho que lhe é atribuída?',
        dimensao: 'copsoq_influencia',
        invertida: true,
        normas: ['NR-17'],
      },
      {
        id: 'cq_in3',
        texto: 'Você tem influência sobre quando fazer pausas?',
        dimensao: 'copsoq_influencia',
        invertida: true,
        normas: ['NR-17'],
      },
      {
        id: 'cq_in4',
        texto: 'Você pode influenciar a quantidade de trabalho que lhe é destinada?',
        dimensao: 'copsoq_influencia',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_suporte_colegas',
    nome: 'Suporte dos Colegas',
    descricao: 'Apoio e colaboração entre pares',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      {
        id: 'cq_sc1',
        texto: 'Com que frequência você recebe ajuda e apoio de seus colegas de trabalho?',
        dimensao: 'copsoq_suporte_colegas',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_sc2',
        texto: 'Seus colegas estão dispostos a ouvir seus problemas relacionados ao trabalho?',
        dimensao: 'copsoq_suporte_colegas',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_sc3',
        texto: 'Seus colegas falam com você?',
        dimensao: 'copsoq_suporte_colegas',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_suporte_lideranca',
    nome: 'Suporte da Liderança',
    descricao: 'Apoio do gestor direto',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      {
        id: 'cq_sl1',
        texto: 'Com que frequência você recebe ajuda e apoio do seu superior imediato?',
        dimensao: 'copsoq_suporte_lideranca',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_sl2',
        texto: 'Seu superior imediato está disposto a ouvir seus problemas relacionados ao trabalho?',
        dimensao: 'copsoq_suporte_lideranca',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_sl3',
        texto: 'Com que frequência seu superior imediato conversa com você sobre como você realiza seu trabalho?',
        dimensao: 'copsoq_suporte_lideranca',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_clareza_papeis',
    nome: 'Clareza de Papéis',
    descricao: 'Clareza das responsabilidades e expectativas',
    tipo: 'protetor',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_cp1',
        texto: 'Você sabe exatamente que responsabilidades tem?',
        dimensao: 'copsoq_clareza_papeis',
        invertida: true,
        normas: ['NR-01', 'NR-17'],
      },
      {
        id: 'cq_cp2',
        texto: 'Você sabe exatamente o que se espera de você no trabalho?',
        dimensao: 'copsoq_clareza_papeis',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_cp3',
        texto: 'Você sabe exatamente quais são os objetivos do seu trabalho?',
        dimensao: 'copsoq_clareza_papeis',
        invertida: true,
        normas: ['NR-01'],
      },
    ],
  },
  {
    id: 'copsoq_conflito_papeis',
    nome: 'Conflito de Papéis',
    descricao: 'Demandas contraditórias, trabalho prescrito × real',
    tipo: 'risco',
    normas: ['NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_cpr1',
        texto: 'Você precisa fazer coisas que contradizem seus valores pessoais?',
        dimensao: 'copsoq_conflito_papeis',
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_cpr2',
        texto: 'Com que frequência você recebe demandas contraditórias de diferentes pessoas no trabalho?',
        dimensao: 'copsoq_conflito_papeis',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'cq_cpr3',
        texto: 'Com que frequência você precisa fazer coisas que parecem desnecessárias?',
        dimensao: 'copsoq_conflito_papeis',
        normas: ['NR-17'],
      },
    ],
  },
  {
    id: 'copsoq_reconhecimento',
    nome: 'Reconhecimento e Recompensas',
    descricao: 'Justiça, reconhecimento pelo trabalho realizado',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_rr1',
        texto: 'Você é tratado(a) de forma justa no trabalho?',
        dimensao: 'copsoq_reconhecimento',
        invertida: true,
        normas: ['ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_rr2',
        texto: 'Você recebe reconhecimento pelo trabalho que realiza?',
        dimensao: 'copsoq_reconhecimento',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'cq_rr3',
        texto: 'A gestão resolve os conflitos de forma justa?',
        dimensao: 'copsoq_reconhecimento',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_previsibilidade',
    nome: 'Previsibilidade',
    descricao: 'Informação antecipada sobre mudanças importantes',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_pr1',
        texto: 'No trabalho, você é informado(a) com antecedência sobre decisões importantes, mudanças ou planos futuros?',
        dimensao: 'copsoq_previsibilidade',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'cq_pr2',
        texto: 'Você recebe todas as informações necessárias para realizar bem o seu trabalho?',
        dimensao: 'copsoq_previsibilidade',
        invertida: true,
        normas: ['NR-01'],
      },
    ],
  },
  {
    id: 'copsoq_sentido',
    nome: 'Sentido do Trabalho',
    descricao: 'Significado, propósito, motivação',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      {
        id: 'cq_sw1',
        texto: 'Seu trabalho tem sentido para você?',
        dimensao: 'copsoq_sentido',
        invertida: true,
        normas: ['ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_sw2',
        texto: 'Você se sente motivado(a) e comprometido(a) com seu trabalho?',
        dimensao: 'copsoq_sentido',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_sw3',
        texto: 'Seu trabalho é importante para você?',
        dimensao: 'copsoq_sentido',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_burnout',
    nome: 'Burnout / Esgotamento',
    descricao: 'Exaustão física e cognitiva relacionada ao trabalho',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_bu1',
        texto: 'Com que frequência você se sente esgotado(a)?',
        dimensao: 'copsoq_burnout',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_bu2',
        texto: 'Com que frequência você se sente fisicamente exausto(a)?',
        dimensao: 'copsoq_burnout',
        normas: ['NR-01'],
      },
      {
        id: 'cq_bu3',
        texto: 'Com que frequência você está emocionalmente exausto(a)?',
        dimensao: 'copsoq_burnout',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_bu4',
        texto: 'Com que frequência você pensa: "Não consigo mais suportar isso"?',
        dimensao: 'copsoq_burnout',
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_equilibrio',
    nome: 'Equilíbrio Trabalho–Vida',
    descricao: 'Interferência do trabalho na vida pessoal',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_eq1',
        texto: 'As exigências do trabalho interferem na sua vida familiar e social?',
        dimensao: 'copsoq_equilibrio',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'cq_eq2',
        texto: 'Você precisa sacrificar atividades pessoais por causa do trabalho?',
        dimensao: 'copsoq_equilibrio',
        normas: ['ISO 45003'],
      },
      {
        id: 'cq_eq3',
        texto: 'Quando você chega em casa do trabalho, você ainda consegue fazer o que precisa?',
        dimensao: 'copsoq_equilibrio',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_assedio',
    nome: 'Assédio e Comportamentos Ofensivos',
    descricao: 'Exposição a bullying, assédio moral e assédio sexual no trabalho (módulo Offensive Behaviours – COPSOQ III)',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_as1',
        texto: 'Nos últimos 12 meses, com que frequência você foi exposto(a) a bullying ou assédio moral no trabalho?',
        dimensao: 'copsoq_assedio',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_as2',
        texto: 'Nos últimos 12 meses, com que frequência você foi exposto(a) a assédio sexual?',
        dimensao: 'copsoq_assedio',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_as3',
        texto: 'Nos últimos 12 meses, com que frequência você foi exposto(a) a discriminação ou comportamentos ofensivos?',
        dimensao: 'copsoq_assedio',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'copsoq_violencia',
    nome: 'Ameaças e Violência',
    descricao: 'Exposição a ameaças, violência física ou eventos traumáticos no trabalho (módulo Offensive Behaviours – COPSOQ III)',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'cq_vi1',
        texto: 'Nos últimos 12 meses, com que frequência você foi exposto(a) a ameaças de violência no trabalho?',
        dimensao: 'copsoq_violencia',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_vi2',
        texto: 'Nos últimos 12 meses, com que frequência você foi exposto(a) a violência física no trabalho?',
        dimensao: 'copsoq_violencia',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'cq_vi3',
        texto: 'Nos últimos 12 meses, você presenciou ou vivenciou um evento traumático relacionado ao trabalho?',
        dimensao: 'copsoq_violencia',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },
];

export const COPSOQ_TOTAL_PERGUNTAS = COPSOQ_DIMENSOES.reduce(
  (total, d) => total + d.perguntas.length,
  0
);

// Mapear dimensões para cálculo do IPS
export const COPSOQ_DIMENSOES_RISCO = COPSOQ_DIMENSOES.filter(d => d.tipo === 'risco').map(d => d.id);
export const COPSOQ_DIMENSOES_PROTETOR = COPSOQ_DIMENSOES.filter(d => d.tipo === 'protetor').map(d => d.id);
