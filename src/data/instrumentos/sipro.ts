/**
 * SIPRO — Instrumento Psicossocial Seguramente
 * Instrumento proprietário do Seguramente
 *
 * 10 eixos — 35 questões base:
 *   1. Demandas Quantitativas e Ritmo de Trabalho (4q) — peso 15%
 *   2. Demandas Cognitivas (4q) — peso 15%
 *   3. Demandas Emocionais (3q) — peso 10%
 *   4. Autonomia, Controle e Influência (4q) — peso 10%
 *   5. Clareza de Papéis e Organização do Trabalho (4q) — peso 10%
 *   6. Reconhecimento, Justiça e Valorização (3q) — peso 10%
 *   7. Relacionamentos, Clima e Suporte Social (3q) — peso 10%
 *   8. Sentido do Trabalho e Engajamento (3q) — peso 5%
 *   9. Recuperação, Pausas e Equilíbrio Trabalho–Vida (3q) — peso 10%
 *   10. Sinais Precoces de Sofrimento Psíquico (4q) — peso 5%
 *
 * Fundamentado em: JD-R · COPSOQ · ISO 45003 · NR-01 · NR-17
 * Escala: 0 = Nunca | 1 = Raramente | 2 = Às vezes | 3 = Frequentemente | 4 = Sempre
 * "invertida: true" → maior pontuação = melhor condição (fatores protetores)
 */

import type { DimensaoInstrumento } from './copsoq';

export const SIPRO_DIMENSOES: DimensaoInstrumento[] = [
  // ══════════════════════════════════════════════════════════════
  // EIXO 1 — DEMANDAS QUANTITATIVAS E RITMO DE TRABALHO (15%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_demandas_quantitativas',
    nome: 'Demandas Quantitativas e Ritmo',
    descricao: 'Carga de trabalho, pressão por tempo e ritmo imposto',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    grupo: 'Demanda e Carga de Trabalho',
    perguntas: [
      {
        id: 'sipro_dq1',
        texto: 'O volume de trabalho que recebo é maior do que consigo realizar no meu horário normal.',
        dimensao: 'sipro_demandas_quantitativas',
        normas: ['NR-01', 'NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_dq2',
        texto: 'Preciso trabalhar muito rápido para dar conta das tarefas.',
        dimensao: 'sipro_demandas_quantitativas',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_dq3',
        texto: 'O ritmo do trabalho é imposto sem considerar limites físicos ou mentais.',
        dimensao: 'sipro_demandas_quantitativas',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_dq4',
        texto: 'Frequentemente levo trabalho para além do horário normal.',
        dimensao: 'sipro_demandas_quantitativas',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 2 — DEMANDAS COGNITIVAS (15%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_demandas_cognitivas',
    nome: 'Demandas Cognitivas',
    descricao: 'Exigência de atenção, concentração e tomada de decisão',
    tipo: 'risco',
    normas: ['NR-17', 'ISO 45003'],
    grupo: 'Demanda e Carga de Trabalho',
    perguntas: [
      {
        id: 'sipro_dc1',
        texto: 'Meu trabalho exige atenção constante durante toda a jornada.',
        dimensao: 'sipro_demandas_cognitivas',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_dc2',
        texto: 'Preciso lidar com muitas informações ao mesmo tempo.',
        dimensao: 'sipro_demandas_cognitivas',
        normas: ['NR-17'],
      },
      {
        id: 'sipro_dc3',
        texto: 'Tomo decisões importantes sob pressão ou com pouco tempo.',
        dimensao: 'sipro_demandas_cognitivas',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_dc4',
        texto: 'Sinto dificuldade de concentração ao longo da jornada.',
        dimensao: 'sipro_demandas_cognitivas',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 3 — DEMANDAS EMOCIONAIS (10%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_demandas_emocionais',
    nome: 'Demandas Emocionais',
    descricao: 'Desgaste emocional decorrente do trabalho',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Demanda e Carga de Trabalho',
    perguntas: [
      {
        id: 'sipro_de1',
        texto: 'Meu trabalho envolve lidar com conflitos, reclamações ou situações emocionalmente difíceis.',
        dimensao: 'sipro_demandas_emocionais',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'sipro_de2',
        texto: 'Preciso esconder o que realmente sinto para conseguir trabalhar.',
        dimensao: 'sipro_demandas_emocionais',
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_de3',
        texto: 'Saio do trabalho emocionalmente esgotado(a).',
        dimensao: 'sipro_demandas_emocionais',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 4 — AUTONOMIA, CONTROLE E INFLUÊNCIA (10%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_autonomia_controle',
    nome: 'Autonomia e Controle',
    descricao: 'Grau de controle do trabalhador sobre seu trabalho',
    tipo: 'protetor',
    normas: ['NR-17', 'ISO 45003'],
    grupo: 'Organização do Trabalho',
    perguntas: [
      {
        id: 'sipro_ac1',
        texto: 'Tenho autonomia para decidir como executar minhas tarefas.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_ac2',
        texto: 'Consigo organizar meu ritmo de trabalho.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['NR-17'],
      },
      {
        id: 'sipro_ac3',
        texto: 'Posso fazer pausas quando sinto necessidade.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['NR-17'],
      },
      {
        id: 'sipro_ac4',
        texto: 'Tenho espaço para opinar sobre mudanças que afetam meu trabalho.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 5 — CLAREZA DE PAPÉIS E ORGANIZAÇÃO DO TRABALHO (10%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_clareza_papeis',
    nome: 'Clareza de Papéis',
    descricao: 'Clareza de função, responsabilidades e conflitos de papel',
    tipo: 'protetor',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    grupo: 'Organização do Trabalho',
    perguntas: [
      {
        id: 'sipro_cp1',
        texto: 'Sei exatamente quais são minhas responsabilidades no trabalho.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['NR-01', 'NR-17'],
      },
      {
        id: 'sipro_cp2',
        texto: 'As expectativas sobre meu desempenho são claras.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_cp3',
        texto: 'Recebo orientações contraditórias de pessoas diferentes.',
        dimensao: 'sipro_clareza_papeis',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_cp4',
        texto: 'O trabalho que realizo corresponde ao que foi definido para minha função.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['NR-17'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 6 — RECONHECIMENTO, JUSTIÇA E VALORIZAÇÃO (10%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_reconhecimento_justica',
    nome: 'Reconhecimento e Justiça',
    descricao: 'Percepção de justiça organizacional e valorização',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Organização do Trabalho',
    perguntas: [
      {
        id: 'sipro_rj1',
        texto: 'Meu esforço é reconhecido pela liderança.',
        dimensao: 'sipro_reconhecimento_justica',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_rj2',
        texto: 'Sou tratado(a) de forma justa no trabalho.',
        dimensao: 'sipro_reconhecimento_justica',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_rj3',
        texto: 'Existe coerência entre esforço, responsabilidade e recompensas.',
        dimensao: 'sipro_reconhecimento_justica',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 7 — RELACIONAMENTOS, CLIMA E SUPORTE SOCIAL (10%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_relacionamentos_suporte',
    nome: 'Relacionamentos e Suporte',
    descricao: 'Suporte de colegas e liderança',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Relações e Suporte',
    perguntas: [
      {
        id: 'sipro_rs1',
        texto: 'Posso contar com meus colegas quando preciso de ajuda.',
        dimensao: 'sipro_relacionamentos_suporte',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_rs2',
        texto: 'Meu líder demonstra apoio quando enfrento dificuldades.',
        dimensao: 'sipro_relacionamentos_suporte',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_rs3',
        texto: 'O ambiente de trabalho é respeitoso.',
        dimensao: 'sipro_relacionamentos_suporte',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 8 — SENTIDO DO TRABALHO E ENGAJAMENTO (5%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_sentido_engajamento',
    nome: 'Sentido do Trabalho',
    descricao: 'Significado, pertencimento e motivação',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    grupo: 'Segurança Psicológica',
    perguntas: [
      {
        id: 'sipro_se1',
        texto: 'Meu trabalho tem significado para mim.',
        dimensao: 'sipro_sentido_engajamento',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_se2',
        texto: 'Sinto orgulho do que faço.',
        dimensao: 'sipro_sentido_engajamento',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_se3',
        texto: 'Sinto vontade de continuar trabalhando nesta empresa.',
        dimensao: 'sipro_sentido_engajamento',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 9 — RECUPERAÇÃO, PAUSAS E EQUILÍBRIO TRABALHO–VIDA (10%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_recuperacao_equilibrio',
    nome: 'Recuperação e Equilíbrio',
    descricao: 'Descanso, recuperação e limites trabalho-vida',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    grupo: 'Condições de Trabalho',
    perguntas: [
      {
        id: 'sipro_re1',
        texto: 'Consigo descansar adequadamente entre uma jornada e outra.',
        dimensao: 'sipro_recuperacao_equilibrio',
        invertida: true,
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_re2',
        texto: 'O trabalho interfere negativamente na minha vida pessoal.',
        dimensao: 'sipro_recuperacao_equilibrio',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'sipro_re3',
        texto: 'Chego em casa com energia para atividades pessoais.',
        dimensao: 'sipro_recuperacao_equilibrio',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // EIXO 10 — SINAIS PRECOCES DE SOFRIMENTO PSÍQUICO (5%)
  // ══════════════════════════════════════════════════════════════
  {
    id: 'sipro_sinais_precoces',
    nome: 'Sinais Precoces',
    descricao: 'Alertas iniciais de sofrimento psíquico (não diagnóstico)',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Monitoramento',
    perguntas: [
      {
        id: 'sipro_sp1',
        texto: 'Tenho tido dificuldades para dormir.',
        dimensao: 'sipro_sinais_precoces',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'sipro_sp2',
        texto: 'Tenho me sentido mais irritado(a) ou tenso(a).',
        dimensao: 'sipro_sinais_precoces',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'sipro_sp3',
        texto: 'Tenho me sentido desmotivado(a) com o trabalho.',
        dimensao: 'sipro_sinais_precoces',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'sipro_sp4',
        texto: 'Tenho dificuldade para relaxar, mesmo fora do trabalho.',
        dimensao: 'sipro_sinais_precoces',
        normas: ['ISO 45003'],
      },
    ],
  },
];

export const SIPRO_TOTAL_PERGUNTAS = SIPRO_DIMENSOES.reduce(
  (acc, d) => acc + d.perguntas.length,
  0
);
