/**
 * COPSOQ II-Br — Versão Curta (PURO, sem adaptação YourEyes)
 *
 * Reproduz literalmente a versão brasileira curta do Copenhagen
 * Psychosocial Questionnaire II (Kristensen et al., 2005) traduzida e
 * validada por Josiane Sotrate Gonçalves (UFSCar) e referenciada pelos
 * estudos da USP. As 33 perguntas estão agrupadas nas 10 dimensões
 * originais do instrumento, sem ajustes para NR-01/ISO 45003.
 *
 * Para análises que exijam adaptação às normas brasileiras, use o
 * COPSOQ III (instrumento `copsoq`) ou o SIPRO (`sipro`).
 *
 * Escala de resposta: 0 = Nunca · 1 = Raramente · 2 = Às vezes ·
 *                     3 = Frequentemente · 4 = Sempre
 * Itens "invertida: true" → maior valor = melhor (protetor).
 *
 * Nomes de dimensão foram escolhidos para casar com os aliases do
 * catálogo de Riscos Psicossociais (src/data/catalogoRiscosPsicossociais.ts),
 * garantindo o mapeamento automático aos 13 fatores padrão usados pelo
 * Inventário PGR.
 */

import type { DimensaoInstrumento } from './copsoq';

export const COPSOQ2BR_DIMENSOES: DimensaoInstrumento[] = [
  // ─── 1. Demandas no Trabalho (6 itens) ──────────────────────────────────
  {
    id: 'c2br_demandas',
    nome: 'Demandas no Trabalho',
    descricao: 'Volume, ritmo e demanda emocional do trabalho (itens 1A-3B)',
    tipo: 'risco',
    normas: ['NR-17', 'ISO 45003'],
    perguntas: [
      { id: 'c2br_1A', dimensao: 'c2br_demandas', texto: 'Você fica com trabalho atrasado?' },
      { id: 'c2br_1B', dimensao: 'c2br_demandas', texto: 'Você tem tempo suficiente para realizar suas tarefas de trabalho?', invertida: true },
      { id: 'c2br_2A', dimensao: 'c2br_demandas', texto: 'É necessário manter um ritmo rápido no trabalho?' },
      { id: 'c2br_2B', dimensao: 'c2br_demandas', texto: 'Você trabalha em ritmo elevado durante toda a jornada?' },
      { id: 'c2br_3A', dimensao: 'c2br_demandas', texto: 'Seu trabalho coloca você em situações emocionalmente desgastantes?' },
      { id: 'c2br_3B', dimensao: 'c2br_demandas', texto: 'Como parte do seu trabalho, você precisa lidar com problemas pessoais de outras pessoas?' },
    ],
  },

  // ─── 2. Influência e Desenvolvimento (4 itens) ──────────────────────────
  {
    id: 'c2br_influencia',
    nome: 'Influência e Desenvolvimento',
    descricao: 'Autonomia decisória e oportunidades de aprendizagem (itens 4A-5B)',
    tipo: 'protetor',
    normas: ['NR-17', 'ISO 45003'],
    perguntas: [
      { id: 'c2br_4A', dimensao: 'c2br_influencia', texto: 'Você tem elevado grau de influência nas decisões sobre seu trabalho?', invertida: true },
      { id: 'c2br_4B', dimensao: 'c2br_influencia', texto: 'Você pode influenciar a quantidade de trabalho que lhe é atribuída?', invertida: true },
      { id: 'c2br_5A', dimensao: 'c2br_influencia', texto: 'Você tem possibilidade de aprender coisas novas por meio do seu trabalho?', invertida: true },
      { id: 'c2br_5B', dimensao: 'c2br_influencia', texto: 'Seu trabalho exige que você tenha iniciativa?', invertida: true },
    ],
  },

  // ─── 3. Significado e Compromisso (4 itens) ─────────────────────────────
  {
    id: 'c2br_significado',
    nome: 'Sentido do Trabalho',
    descricao: 'Significado do trabalho e vínculo com o local (itens 6A-7B)',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      { id: 'c2br_6A', dimensao: 'c2br_significado', texto: 'Seu trabalho tem sentido para você?', invertida: true },
      { id: 'c2br_6B', dimensao: 'c2br_significado', texto: 'Você sente que o trabalho que realiza é importante?', invertida: true },
      { id: 'c2br_7A', dimensao: 'c2br_significado', texto: 'Você sente que seu local de trabalho é muito importante para você?', invertida: true },
      { id: 'c2br_7B', dimensao: 'c2br_significado', texto: 'Você recomendaria a um amigo que se candidatasse a uma vaga em seu local de trabalho?', invertida: true },
    ],
  },

  // ─── 4. Previsibilidade (2 itens) ───────────────────────────────────────
  {
    id: 'c2br_previsibilidade',
    nome: 'Previsibilidade',
    descricao: 'Informação antecipada sobre mudanças e instruções claras (itens 8A-8B)',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      { id: 'c2br_8A', dimensao: 'c2br_previsibilidade', texto: 'No seu local de trabalho, você é informado com antecedência sobre decisões importantes, mudanças ou planos futuros?', invertida: true },
      { id: 'c2br_8B', dimensao: 'c2br_previsibilidade', texto: 'Você recebe todas as informações necessárias para realizar bem o seu trabalho?', invertida: true },
    ],
  },

  // ─── 5. Reconhecimento e Justiça (2 itens) ──────────────────────────────
  {
    id: 'c2br_reconhecimento',
    nome: 'Reconhecimento',
    descricao: 'Apreciação pela gestão e justiça no tratamento (itens 9A-9B)',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      { id: 'c2br_9A', dimensao: 'c2br_reconhecimento', texto: 'Seu trabalho é reconhecido e apreciado pela gestão?', invertida: true },
      { id: 'c2br_9B', dimensao: 'c2br_reconhecimento', texto: 'Você é tratado de forma justa no seu local de trabalho?', invertida: true },
    ],
  },

  // ─── 6. Clareza de Papéis (2 itens) ─────────────────────────────────────
  {
    id: 'c2br_clareza',
    nome: 'Clareza de Papéis',
    descricao: 'Clareza sobre objetivos e expectativas (itens 10A-10B)',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      { id: 'c2br_10A', dimensao: 'c2br_clareza', texto: 'Seu trabalho possui objetivos ou metas claros?', invertida: true },
      { id: 'c2br_10B', dimensao: 'c2br_clareza', texto: 'Você sabe exatamente o que se espera de você no trabalho?', invertida: true },
    ],
  },

  // ─── 7. Qualidade da Liderança (4 itens) ────────────────────────────────
  {
    id: 'c2br_lideranca',
    nome: 'Suporte da Liderança',
    descricao: 'Priorização da satisfação, planejamento e apoio do superior imediato (itens 11A-12B)',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      { id: 'c2br_11A', dimensao: 'c2br_lideranca', texto: 'Você diria que seu superior imediato dá alta prioridade à satisfação no trabalho?', invertida: true },
      { id: 'c2br_11B', dimensao: 'c2br_lideranca', texto: 'Você diria que seu superior é bom no planejamento do trabalho?', invertida: true },
      { id: 'c2br_12A', dimensao: 'c2br_lideranca', texto: 'Com que frequência seu superior imediato está disposto a ouvir seus problemas no trabalho?', invertida: true },
      { id: 'c2br_12B', dimensao: 'c2br_lideranca', texto: 'Com que frequência você recebe ajuda e apoio do seu superior imediato?', invertida: true },
    ],
  },

  // ─── 8. Saúde Geral (1 item) ────────────────────────────────────────────
  {
    id: 'c2br_saude',
    nome: 'Sinais Precoces de Saúde',
    descricao: 'Percepção geral de saúde (item 17). Não substitui avaliação clínica.',
    tipo: 'risco',
    normas: ['ISO 45003'],
    perguntas: [
      { id: 'c2br_17', dimensao: 'c2br_saude', texto: 'De modo geral, como você diria que está sua saúde? (Considere 0 = Excelente, 4 = Ruim)' },
    ],
  },

  // ─── 9. Burnout e Estresse (4 itens) ────────────────────────────────────
  {
    id: 'c2br_burnout',
    nome: 'Burnout',
    descricao: 'Esgotamento físico, emocional, estresse e irritação (itens 18A-19B)',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      { id: 'c2br_18A', dimensao: 'c2br_burnout', texto: 'Com que frequência você tem se sentido fisicamente esgotado?', peso: 2 },
      { id: 'c2br_18B', dimensao: 'c2br_burnout', texto: 'Com que frequência você tem se sentido emocionalmente esgotado?', peso: 2 },
      { id: 'c2br_19A', dimensao: 'c2br_burnout', texto: 'Com que frequência você tem se sentido estressado?' },
      { id: 'c2br_19B', dimensao: 'c2br_burnout', texto: 'Com que frequência você tem se sentido irritado?' },
    ],
  },

  // ─── 10. Comportamentos Ofensivos (4 itens) ─────────────────────────────
  {
    id: 'c2br_ofensivos',
    nome: 'Assédio',
    descricao: 'Exposição a comportamentos ofensivos nos últimos 12 meses (itens 20-23)',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003', 'Lei 14.457/2022'],
    perguntas: [
      { id: 'c2br_20', dimensao: 'c2br_ofensivos', texto: 'Nos últimos 12 meses, você foi exposto a atenção sexual indesejada no seu local de trabalho?', peso: 2 },
      { id: 'c2br_21', dimensao: 'c2br_ofensivos', texto: 'Nos últimos 12 meses, você foi exposto a ameaças de violência no seu local de trabalho?', peso: 2 },
      { id: 'c2br_22', dimensao: 'c2br_ofensivos', texto: 'Nos últimos 12 meses, você foi exposto a violência física no seu local de trabalho?', peso: 2 },
      { id: 'c2br_23', dimensao: 'c2br_ofensivos', texto: 'Nos últimos 12 meses, você foi exposto a bullying no seu local de trabalho?', peso: 2 },
    ],
  },
];

export const COPSOQ2BR_TOTAL_PERGUNTAS = COPSOQ2BR_DIMENSOES.reduce(
  (total, d) => total + d.perguntas.length,
  0
);
