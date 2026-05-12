/**
 * Catálogo de Riscos Psicossociais
 * --------------------------------------------------------------------------
 * Referências: NR-01 (GRO/PGR), NR-17 (Ergonomia/Org. do Trabalho),
 * ISO 45003:2021 (Saúde Psicológica no Trabalho), CID-11 (QD85 Burnout),
 * Modelos COPSOQ III, JD-R (Job Demands-Resources), Karasek (Demanda-Controle).
 *
 * Cada fator psicossocial é um "perigo" no sentido da NR-01 (item 1.5.4.4.6)
 * que, sob exposição, pode gerar dano à saúde mental e física do trabalhador.
 * --------------------------------------------------------------------------
 */

export type CategoriaRiscoPsicossocial =
  | 'demandas'
  | 'organizacao'
  | 'relacoes'
  | 'interface'
  | 'manifestacoes';

export interface FatorRiscoPsicossocial {
  /** Chave canônica (slug) */
  id: string;
  /** Nome curto do fator (rótulo principal) */
  nome: string;
  /** Categoria do catálogo */
  categoria: CategoriaRiscoPsicossocial;
  /** Descrição objetiva do perigo psicossocial */
  descricao: string;
  /** Manifestações típicas observáveis (sinais/sintomas) */
  manifestacoes: string[];
  /** Bases normativas aplicáveis */
  baseNormativa: string[];
  /** Aliases — termos usados nos instrumentos (SIPRO, COPSOQ, HSE, ProART…) */
  aliases: string[];
}

export const CATEGORIA_LABELS: Record<CategoriaRiscoPsicossocial, string> = {
  demandas: 'Demandas do Trabalho',
  organizacao: 'Organização e Conteúdo',
  relacoes: 'Relações Sociais e Liderança',
  interface: 'Interface Trabalho-Indivíduo',
  manifestacoes: 'Manifestações e Desfechos',
};

export const CATEGORIA_DESCRICAO: Record<CategoriaRiscoPsicossocial, string> = {
  demandas:
    'Exigências quantitativas, cognitivas e emocionais impostas pela tarefa.',
  organizacao:
    'Forma como o trabalho é planejado, distribuído e controlado.',
  relacoes:
    'Qualidade dos vínculos com pares, gestores e cultura de suporte.',
  interface:
    'Equilíbrio entre vida pessoal, recuperação e exigências do trabalho.',
  manifestacoes:
    'Indicadores precoces de adoecimento — efeitos da exposição prolongada.',
};

/**
 * Catálogo principal — base unificada usada pelo Inventário PGR.
 */
export const CATALOGO_RISCOS_PSICOSSOCIAIS: FatorRiscoPsicossocial[] = [
  // ── DEMANDAS DO TRABALHO ──────────────────────────────────────────────────
  {
    id: 'demanda-quantitativa',
    nome: 'Sobrecarga Quantitativa',
    categoria: 'demandas',
    descricao:
      'Volume de trabalho excessivo em relação ao tempo e recursos disponíveis. Pressão por prazos e ritmo intenso.',
    manifestacoes: [
      'Horas extras recorrentes',
      'Sensação de "não dar conta"',
      'Fadiga ao final do expediente',
    ],
    baseNormativa: ['NR-01', 'NR-17 (17.6.2)', 'ISO 45003 §6.1.2.2'],
    aliases: [
      'Demandas Quantitativas',
      'Demanda Quantitativa',
      'Sobrecarga de Trabalho',
      'Ritmo de Trabalho',
      'Pressão por Tempo',
    ],
  },
  {
    id: 'demanda-cognitiva',
    nome: 'Sobrecarga Cognitiva',
    categoria: 'demandas',
    descricao:
      'Exigência elevada de atenção sustentada, memória, tomada de decisão e processamento simultâneo de informações.',
    manifestacoes: [
      'Erros por desatenção',
      'Esquecimentos frequentes',
      'Dificuldade de concentração após o expediente',
    ],
    baseNormativa: ['NR-17 (17.6.3)', 'ISO 45003 §6.1.2.2'],
    aliases: [
      'Demandas Cognitivas',
      'Demanda Cognitiva',
      'Carga Mental',
      'Atenção Constante',
    ],
  },
  {
    id: 'demanda-emocional',
    nome: 'Demanda Emocional',
    categoria: 'demandas',
    descricao:
      'Necessidade de suprimir, modular ou expressar emoções como parte do trabalho. Lidar com sofrimento, conflitos ou clientes hostis.',
    manifestacoes: [
      'Esgotamento empático',
      'Irritabilidade pós-jornada',
      'Sintomas depressivos',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.2'],
    aliases: [
      'Demandas Emocionais',
      'Demanda Emocional',
      'Trabalho Emocional',
      'Esgotamento Empático',
    ],
  },
  {
    id: 'ritmo-biologico',
    nome: 'Perturbação do Ritmo Biológico',
    categoria: 'demandas',
    descricao:
      'Trabalho noturno, em turnos, escalas alternadas ou jornadas que desorganizam o ciclo circadiano.',
    manifestacoes: [
      'Distúrbios de sono',
      'Problemas gastrointestinais',
      'Risco cardiovascular elevado',
    ],
    baseNormativa: ['NR-17 (17.6.4)', 'NR-01', 'CLT art. 73'],
    aliases: ['Ritmo Biológico', 'Trabalho Noturno', 'Turnos'],
  },

  // ── ORGANIZAÇÃO E CONTEÚDO DO TRABALHO ────────────────────────────────────
  {
    id: 'autonomia-controle',
    nome: 'Baixa Autonomia / Controle',
    categoria: 'organizacao',
    descricao:
      'Pouca influência sobre como, quando e em que ordem o trabalho é executado. Microgestão e rigidez de métodos.',
    manifestacoes: [
      'Sentimento de impotência',
      'Desengajamento',
      'Adoecimento por estresse (modelo Karasek)',
    ],
    baseNormativa: ['NR-17 (17.6.3)', 'ISO 45003 §6.1.2.3'],
    aliases: [
      'Autonomia e Controle',
      'Autonomia',
      'Influência e Controle',
      'Controle',
      'Margem de Decisão',
    ],
  },
  {
    id: 'clareza-papeis',
    nome: 'Clareza de Papéis',
    categoria: 'organizacao',
    descricao:
      'Ausência de definição clara de responsabilidades, metas e limites de função. Ambiguidade sobre o que se espera.',
    manifestacoes: [
      'Retrabalho',
      'Conflitos entre áreas',
      'Insegurança sobre o desempenho',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.3'],
    aliases: ['Clareza de Papéis', 'Clareza de', 'Função', 'Definição de Papéis'],
  },
  {
    id: 'conflito-papeis',
    nome: 'Conflito de Papéis',
    categoria: 'organizacao',
    descricao:
      'Exigências contraditórias entre superiores, áreas ou tarefas. Demandas incompatíveis simultâneas.',
    manifestacoes: [
      'Estresse moral',
      'Decisões evitadas',
      'Perda de eficiência',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.3'],
    aliases: ['Conflito de Papéis', 'Exigências Contraditórias'],
  },
  {
    id: 'previsibilidade',
    nome: 'Previsibilidade',
    categoria: 'organizacao',
    descricao:
      'Falta de informações antecipadas sobre mudanças, metas ou decisões que afetam o trabalho.',
    manifestacoes: [
      'Ansiedade antecipatória',
      'Boatos',
      'Resistência a mudanças',
    ],
    baseNormativa: ['ISO 45003 §6.1.2.3'],
    aliases: ['Previsibilidade', 'Gestão de Mudanças'],
  },
  {
    id: 'sentido-trabalho',
    nome: 'Sentido do Trabalho',
    categoria: 'organizacao',
    descricao:
      'Percepção de propósito, significado e contribuição do que se faz. Monotonia e tarefas sem propósito reduzem este fator.',
    manifestacoes: [
      'Apatia',
      'Cinismo organizacional',
      'Boreout (tédio crônico)',
    ],
    baseNormativa: ['NR-17', 'ISO 45003 §6.1.2.3'],
    aliases: ['Sentido do Trabalho', 'Sentido do', 'Propósito', 'Significado'],
  },

  // ── RELAÇÕES SOCIAIS E LIDERANÇA ──────────────────────────────────────────
  {
    id: 'suporte-lideranca',
    nome: 'Suporte da Liderança',
    categoria: 'relacoes',
    descricao:
      'Disponibilidade do gestor para orientar, ouvir, dar feedback e remover barreiras.',
    manifestacoes: [
      'Sensação de abandono',
      'Baixa confiança',
      'Pedidos de demissão por gestão',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Suporte da Liderança',
      'Suporte da',
      'Suporte do Gestor',
      'Liderança',
    ],
  },
  {
    id: 'suporte-pares',
    nome: 'Suporte dos Pares',
    categoria: 'relacoes',
    descricao:
      'Apoio mútuo entre colegas — colaboração, ajuda em momentos de pico e clima de equipe.',
    manifestacoes: [
      'Isolamento',
      'Competição interna nociva',
      'Ausência de coesão de time',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Suporte dos Colegas',
      'Suporte dos Pares',
      'Suporte Social',
      'Relacionamentos',
      'Relacionamentos e',
      'Qualidade das',
    ],
  },
  {
    id: 'reconhecimento',
    nome: 'Reconhecimento e Justiça',
    categoria: 'relacoes',
    descricao:
      'Percepção de que o esforço é justamente reconhecido (financeiro, simbólico e de carreira) e de que decisões são equitativas.',
    manifestacoes: [
      'Desmotivação',
      'Sentimento de injustiça',
      'Aumento de queixas trabalhistas',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Reconhecimento',
      'Reconhecimento e',
      'Justiça Organizacional',
      'Recompensa',
    ],
  },
  {
    id: 'seguranca-psicologica',
    nome: 'Segurança Psicológica',
    categoria: 'relacoes',
    descricao:
      'Liberdade para falar, discordar, errar e propor sem medo de retaliação ou humilhação.',
    manifestacoes: [
      'Silêncio organizacional',
      'Ocultamento de erros',
      'Assédio moral velado',
    ],
    baseNormativa: ['ISO 45003 §6.1.2.4', 'NR-01'],
    aliases: ['Segurança Psicológica'],
  },
  {
    id: 'assedio-violencia',
    nome: 'Assédio e Violência no Trabalho',
    categoria: 'relacoes',
    descricao:
      'Exposição a comportamentos hostis, humilhantes, discriminatórios ou de violência (física, verbal ou simbólica).',
    manifestacoes: [
      'TEPT',
      'Afastamentos por transtornos mentais',
      'Denúncias na ouvidoria',
    ],
    baseNormativa: ['Lei 14.457/2022', 'CLT art. 223-A', 'ISO 45003 §6.1.2.4'],
    aliases: ['Assédio', 'Violência', 'Hostilidade'],
  },

  // ── INTERFACE TRABALHO-INDIVÍDUO ──────────────────────────────────────────
  {
    id: 'equilibrio-trabalho-vida',
    nome: 'Equilíbrio Trabalho-Vida',
    categoria: 'interface',
    descricao:
      'Interferência do trabalho no tempo de descanso, família e lazer. Conexão fora do expediente.',
    manifestacoes: [
      'Conflitos familiares',
      'Insônia',
      'Sintomas de estresse crônico',
    ],
    baseNormativa: ['NR-01', 'CLT art. 4º (tempo à disposição)'],
    aliases: [
      'Equilíbrio Trabalho-Vida',
      'Recuperação e',
      'Recuperação e Equilíbrio',
      'Conciliação',
    ],
  },
  {
    id: 'inseguranca-trabalho',
    nome: 'Insegurança no Trabalho',
    categoria: 'interface',
    descricao:
      'Incerteza sobre permanência no emprego, mudanças contratuais ou continuidade da função.',
    manifestacoes: [
      'Ansiedade',
      'Apresentismo',
      'Redução do engajamento',
    ],
    baseNormativa: ['ISO 45003 §6.1.2.5'],
    aliases: ['Insegurança', 'Estabilidade'],
  },

  // ── MANIFESTAÇÕES E DESFECHOS ─────────────────────────────────────────────
  {
    id: 'burnout',
    nome: 'Burnout (Esgotamento Profissional)',
    categoria: 'manifestacoes',
    descricao:
      'Síndrome resultante de estresse crônico no trabalho não gerenciado. Exaustão, distanciamento e baixa eficácia.',
    manifestacoes: [
      'Exaustão emocional',
      'Despersonalização/cinismo',
      'Queda de desempenho',
    ],
    baseNormativa: ['CID-11 QD85', 'NR-01', 'ISO 45003 §6.1.2'],
    aliases: ['Burnout', 'Sinais Precoces', 'Esgotamento'],
  },
];

/**
 * Resolve um subject vindo de instrumento (SIPRO/COPSOQ/HSE) ao fator do catálogo.
 * Faz match exato e, em seguida, busca por aliases (case-insensitive, contains).
 */
export function resolverFatorPorSubject(
  subject: string
): FatorRiscoPsicossocial | null {
  if (!subject) return null;
  const norm = subject.trim().toLowerCase();

  // Match exato em nome ou alias
  for (const f of CATALOGO_RISCOS_PSICOSSOCIAIS) {
    if (f.nome.toLowerCase() === norm) return f;
    if (f.aliases.some((a) => a.toLowerCase() === norm)) return f;
  }
  // Match por contains (alias dentro do subject ou vice-versa)
  for (const f of CATALOGO_RISCOS_PSICOSSOCIAIS) {
    if (
      f.aliases.some(
        (a) =>
          norm.includes(a.toLowerCase()) || a.toLowerCase().includes(norm)
      )
    ) {
      return f;
    }
  }
  return null;
}
