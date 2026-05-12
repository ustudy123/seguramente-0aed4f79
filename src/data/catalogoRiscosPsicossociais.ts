/**
 * Catálogo de Riscos Psicossociais — Fatores Padrão
 * --------------------------------------------------------------------------
 * Espelha o catálogo padrão da empresa (tabela `psicossocial_riscos`,
 * registros com `padrao = true`). Cada fator é um "perigo psicossocial"
 * (NR-01 item 1.5.4.4.6) com severidade pré-classificada (1 a 5).
 *
 * Referências: NR-01 (GRO/PGR), NR-17 (Ergonomia/Org. do Trabalho),
 * ISO 45003:2021, Lei 14.457/2022, CID-11 (QD85 Burnout),
 * Modelos COPSOQ III, JD-R, Karasek (Demanda-Controle).
 *
 * Aliases mantidos para permitir o mapeamento automático das dimensões
 * dos instrumentos (SIPRO, COPSOQ III, HSE-MS, ProART) a esses fatores.
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
  /** Severidade padrão do fator (1=Insignificante … 5=Catastrófico) */
  severidadePadrao: 1 | 2 | 3 | 4 | 5;
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

export const SEVERIDADE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Insignificante',
  2: 'Menor',
  3: 'Moderado',
  4: 'Grave',
  5: 'Catastrófico',
};

/**
 * Catálogo principal — 13 fatores padrão usados pelo Inventário PGR.
 */
export const CATALOGO_RISCOS_PSICOSSOCIAIS: FatorRiscoPsicossocial[] = [
  // ── DEMANDAS DO TRABALHO ──────────────────────────────────────────────────
  {
    id: 'excesso-demandas',
    nome: 'Excesso de demandas (sobrecarga)',
    categoria: 'demandas',
    severidadePadrao: 4,
    descricao:
      'Volume de trabalho, ritmo, complexidade ou carga emocional acima dos recursos disponíveis (tempo, equipe, ferramentas).',
    manifestacoes: [
      'Horas extras recorrentes',
      'Erros por desatenção e fadiga',
      'Esgotamento empático',
    ],
    baseNormativa: ['NR-01', 'NR-17 (17.6.2 / 17.6.3)', 'ISO 45003 §6.1.2.2'],
    aliases: [
      'Sobrecarga Quantitativa',
      'Demandas Quantitativas',
      'Demanda Quantitativa',
      'Sobrecarga de Trabalho',
      'Ritmo de Trabalho',
      'Pressão por Tempo',
      'Sobrecarga Cognitiva',
      'Demandas Cognitivas',
      'Demanda Cognitiva',
      'Carga Mental',
      'Atenção Constante',
      'Demanda Emocional',
      'Demandas Emocionais',
      'Trabalho Emocional',
      'Esgotamento Empático',
    ],
  },
  {
    id: 'baixa-demanda',
    nome: 'Baixa demanda de trabalho (subcarga)',
    categoria: 'demandas',
    severidadePadrao: 2,
    descricao:
      'Tarefas insuficientes, monótonas ou aquém da qualificação, gerando tédio crônico (boreout) e perda de propósito.',
    manifestacoes: ['Apatia', 'Tédio crônico (boreout)', 'Queda de engajamento'],
    baseNormativa: ['NR-17', 'ISO 45003 §6.1.2.3'],
    aliases: ['Subcarga', 'Boreout', 'Monotonia', 'Sentido do Trabalho', 'Propósito'],
  },

  // ── ORGANIZAÇÃO E CONTEÚDO DO TRABALHO ────────────────────────────────────
  {
    id: 'baixo-controle',
    nome: 'Baixo controle no trabalho / Falta de autonomia',
    categoria: 'organizacao',
    severidadePadrao: 3,
    descricao:
      'Pouca influência sobre como, quando e em que ordem o trabalho é executado. Microgestão e rigidez de métodos (modelo Karasek).',
    manifestacoes: [
      'Sentimento de impotência',
      'Desengajamento',
      'Adoecimento por estresse crônico',
    ],
    baseNormativa: ['NR-17 (17.6.3)', 'ISO 45003 §6.1.2.3'],
    aliases: [
      'Baixa Autonomia / Controle',
      'Autonomia e Controle',
      'Autonomia',
      'Influência e Controle',
      'Influência',
      'Controle',
      'Margem de Decisão',
    ],
  },
  {
    id: 'baixa-clareza-papel',
    nome: 'Baixa clareza de papel/função',
    categoria: 'organizacao',
    severidadePadrao: 3,
    descricao:
      'Ausência de definição clara de responsabilidades, metas e limites. Inclui conflito de papéis (exigências contraditórias).',
    manifestacoes: [
      'Retrabalho',
      'Conflitos entre áreas',
      'Insegurança sobre o desempenho',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.3'],
    aliases: [
      'Clareza de Papéis',
      'Clareza de Função',
      'Clareza de',
      'Definição de Papéis',
      'Função',
      'Conflito de Papéis',
      'Exigências Contraditórias',
      'Ambiguidade de Papéis',
    ],
  },
  {
    id: 'ma-gestao-mudancas',
    nome: 'Má gestão de mudanças organizacionais',
    categoria: 'organizacao',
    severidadePadrao: 3,
    descricao:
      'Mudanças sem comunicação prévia, participação ou previsibilidade — reestruturações, troca de gestão, novas metas impostas.',
    manifestacoes: ['Ansiedade antecipatória', 'Boatos', 'Resistência a mudanças'],
    baseNormativa: ['ISO 45003 §6.1.2.3', 'NR-01'],
    aliases: [
      'Previsibilidade',
      'Gestão de Mudanças',
      'Mudanças Organizacionais',
      'Insegurança no Trabalho',
      'Insegurança',
      'Estabilidade',
    ],
  },

  // ── RELAÇÕES SOCIAIS E LIDERANÇA ──────────────────────────────────────────
  {
    id: 'falta-suporte',
    nome: 'Falta de suporte no trabalho',
    categoria: 'relacoes',
    severidadePadrao: 3,
    descricao:
      'Ausência de apoio prático e emocional da liderança e dos pares — feedback, orientação e ajuda em momentos de pico.',
    manifestacoes: [
      'Sensação de abandono',
      'Isolamento profissional',
      'Baixa confiança no time',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Suporte da Liderança',
      'Suporte da',
      'Suporte do Gestor',
      'Liderança',
      'Suporte dos Pares',
      'Suporte dos Colegas',
      'Suporte Social',
      'Apoio Social',
    ],
  },
  {
    id: 'mas-relacoes',
    nome: 'Más relações no ambiente de trabalho',
    categoria: 'relacoes',
    severidadePadrao: 3,
    descricao:
      'Conflitos interpessoais frequentes, clima hostil, fofocas, competição nociva e baixa coesão de equipe.',
    manifestacoes: [
      'Conflitos abertos',
      'Panelas e exclusão',
      'Pedidos de transferência',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Relacionamentos',
      'Relacionamentos e',
      'Qualidade das',
      'Qualidade das Relações',
      'Clima de Equipe',
      'Conflitos Interpessoais',
    ],
  },
  {
    id: 'baixa-justica',
    nome: 'Baixa justiça organizacional',
    categoria: 'relacoes',
    severidadePadrao: 3,
    descricao:
      'Percepção de iniquidade nas decisões — distribuição de cargas, oportunidades, promoções e tratamento desigual.',
    manifestacoes: [
      'Sentimento de injustiça',
      'Aumento de queixas trabalhistas',
      'Desmotivação',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: ['Justiça Organizacional', 'Equidade', 'Imparcialidade'],
  },
  {
    id: 'baixas-recompensas',
    nome: 'Baixas recompensas e reconhecimento',
    categoria: 'relacoes',
    severidadePadrao: 3,
    descricao:
      'Esforço sustentado sem reconhecimento proporcional — financeiro, simbólico ou de carreira (modelo Esforço-Recompensa).',
    manifestacoes: [
      'Desmotivação',
      'Cinismo organizacional',
      'Pedidos de demissão',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Reconhecimento',
      'Reconhecimento e',
      'Reconhecimento e Justiça',
      'Recompensa',
      'Esforço-Recompensa',
    ],
  },
  {
    id: 'assedio',
    nome: 'Assédio de qualquer natureza',
    categoria: 'relacoes',
    severidadePadrao: 4,
    descricao:
      'Exposição a comportamentos hostis, humilhantes, discriminatórios — assédio moral, sexual, racial ou organizacional.',
    manifestacoes: [
      'Afastamentos por transtornos mentais',
      'Denúncias na ouvidoria',
      'Silenciamento e medo de retaliação',
    ],
    baseNormativa: ['Lei 14.457/2022', 'CLT art. 223-A', 'ISO 45003 §6.1.2.4'],
    aliases: [
      'Assédio',
      'Assédio Moral',
      'Assédio Sexual',
      'Hostilidade',
      'Discriminação',
      'Segurança Psicológica',
    ],
  },

  // ── INTERFACE TRABALHO-INDIVÍDUO ──────────────────────────────────────────
  {
    id: 'trabalho-remoto-isolado',
    nome: 'Trabalho remoto e isolado',
    categoria: 'interface',
    severidadePadrao: 3,
    descricao:
      'Atividade executada de forma remota, solitária ou geograficamente dispersa, com baixo contato social e supervisão à distância.',
    manifestacoes: [
      'Solidão profissional',
      'Hiperconexão fora do expediente',
      'Conflitos família-trabalho',
    ],
    baseNormativa: ['NR-01', 'CLT art. 75-A a 75-E (teletrabalho)', 'ISO 45003 §6.1.2.5'],
    aliases: [
      'Trabalho Remoto',
      'Home Office',
      'Trabalho Isolado',
      'Isolamento',
      'Teletrabalho',
      'Equilíbrio Trabalho-Vida',
      'Recuperação e Equilíbrio',
      'Recuperação e',
      'Conciliação',
    ],
  },
  {
    id: 'dificil-comunicacao',
    nome: 'Trabalho em condições de difícil comunicação',
    categoria: 'interface',
    severidadePadrao: 2,
    descricao:
      'Barreiras físicas, tecnológicas ou organizacionais que dificultam a comunicação — ruído, equipes dispersas, idiomas distintos, canais ineficazes.',
    manifestacoes: [
      'Mal-entendidos frequentes',
      'Decisões mal-informadas',
      'Frustração e retrabalho',
    ],
    baseNormativa: ['NR-17 (17.5.2)', 'ISO 45003 §6.1.2.3'],
    aliases: [
      'Comunicação Deficiente',
      'Barreiras de Comunicação',
      'Comunicação Organizacional',
    ],
  },

  // ── MANIFESTAÇÕES E DESFECHOS ─────────────────────────────────────────────
  {
    id: 'eventos-violentos',
    nome: 'Eventos violentos ou traumáticos',
    categoria: 'manifestacoes',
    severidadePadrao: 5,
    descricao:
      'Exposição a assaltos, agressões físicas, acidentes graves, mortes ou ameaças durante o trabalho — pode gerar TEPT.',
    manifestacoes: [
      'TEPT (Transtorno de Estresse Pós-Traumático)',
      'Afastamentos prolongados',
      'Ansiedade e flashbacks',
    ],
    baseNormativa: ['NR-01', 'ISO 45003 §6.1.2.4', 'CID-11 6B40'],
    aliases: [
      'Violência',
      'Eventos Traumáticos',
      'Trauma',
      'TEPT',
      'Burnout',
      'Sinais Precoces',
      'Esgotamento',
    ],
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
