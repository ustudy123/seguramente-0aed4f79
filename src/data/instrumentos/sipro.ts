/**
 * SIPRO — Índice Seguramente de Risco Psicossocial Organizacional
 * Instrumento autoral do Seguramente
 *
 * 12 dimensões — 52 questões:
 *   Grupo 1 — Demanda e Carga de Trabalho:
 *     1. Demanda Quantitativa (4q)
 *     2. Demanda Cognitiva (4q)
 *     3. Demanda Emocional (4q)
 *   Grupo 2 — Organização do Trabalho:
 *     4. Autonomia e Controle (4q)
 *     5. Clareza de Papéis (4q)
 *     6. Justiça Organizacional (4q)
 *   Grupo 3 — Relações e Suporte:
 *     7. Suporte da Liderança (4q)
 *     8. Suporte Social (4q)
 *     9. Qualidade das Relações (4q)
 *   Grupo 4 — Segurança Psicológica:
 *     10. Segurança Psicológica (4q)
 *     11. Reconhecimento e Sentido do Trabalho (4q)
 *   Grupo 5 — Condições Especiais de Trabalho:
 *     12. Ritmo Biológico e Recuperação (4q + 2 opcionais turno)
 *
 * Baseado em: COPSOQ · HSE Management Standards · PROART · ISO 45001 · ISO 45003 · NR-01
 * Escala: 0 = Nunca | 1 = Raramente | 2 = Às vezes | 3 = Frequentemente | 4 = Sempre
 * "invertida: true" → maior pontuação = melhor condição (fatores protetores)
 */

import type { DimensaoInstrumento } from './copsoq';

export const SIPRO_DIMENSOES: DimensaoInstrumento[] = [
  // ══════════════════════════════════════════════════════════════
  // GRUPO 1 — DEMANDA E CARGA DE TRABALHO
  // ══════════════════════════════════════════════════════════════

  {
    id: 'sipro_demanda_quantitativa',
    nome: 'Demanda Quantitativa',
    descricao: 'Avalia volume de trabalho e pressão de tempo',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    grupo: 'Demanda e Carga de Trabalho',
    perguntas: [
      {
        id: 'sipro_dq1',
        texto: 'Meu trabalho exige que eu produza muito em pouco tempo.',
        dimensao: 'sipro_demanda_quantitativa',
        normas: ['NR-17'],
      },
      {
        id: 'sipro_dq2',
        texto: 'Preciso trabalhar em ritmo acelerado para dar conta das tarefas.',
        dimensao: 'sipro_demanda_quantitativa',
        normas: ['NR-17'],
      },
      {
        id: 'sipro_dq3',
        texto: 'Frequentemente tenho mais tarefas do que consigo realizar.',
        dimensao: 'sipro_demanda_quantitativa',
        normas: ['NR-01'],
      },
      {
        id: 'sipro_dq4',
        texto: 'Sinto pressão constante para cumprir prazos.',
        dimensao: 'sipro_demanda_quantitativa',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  {
    id: 'sipro_demanda_cognitiva',
    nome: 'Demanda Cognitiva',
    descricao: 'Avalia exigência mental e sobrecarga informacional',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    grupo: 'Demanda e Carga de Trabalho',
    perguntas: [
      {
        id: 'sipro_dc1',
        texto: 'Meu trabalho exige alta concentração por longos períodos.',
        dimensao: 'sipro_demanda_cognitiva',
        normas: ['NR-17'],
      },
      {
        id: 'sipro_dc2',
        texto: 'Preciso tomar decisões importantes com frequência.',
        dimensao: 'sipro_demanda_cognitiva',
        normas: ['NR-01'],
      },
      {
        id: 'sipro_dc3',
        texto: 'Preciso lidar com muitas informações ao mesmo tempo.',
        dimensao: 'sipro_demanda_cognitiva',
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_dc4',
        texto: 'Um pequeno erro no meu trabalho pode gerar consequências relevantes.',
        dimensao: 'sipro_demanda_cognitiva',
        normas: ['NR-01', 'ISO 45001'],
      },
    ],
  },

  {
    id: 'sipro_demanda_emocional',
    nome: 'Demanda Emocional',
    descricao: 'Avalia o esforço emocional exigido pelo trabalho',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Demanda e Carga de Trabalho',
    perguntas: [
      {
        id: 'sipro_de1',
        texto: 'Meu trabalho exige controlar minhas emoções constantemente.',
        dimensao: 'sipro_demanda_emocional',
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_de2',
        texto: 'Preciso lidar com situações emocionalmente difíceis.',
        dimensao: 'sipro_demanda_emocional',
        normas: ['NR-01'],
      },
      {
        id: 'sipro_de3',
        texto: 'Preciso lidar com pessoas irritadas, tristes ou agressivas.',
        dimensao: 'sipro_demanda_emocional',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'sipro_de4',
        texto: 'Após o trabalho, sinto-me emocionalmente esgotado.',
        dimensao: 'sipro_demanda_emocional',
        normas: ['NR-01'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // GRUPO 2 — ORGANIZAÇÃO DO TRABALHO
  // ══════════════════════════════════════════════════════════════

  {
    id: 'sipro_autonomia_controle',
    nome: 'Autonomia e Controle',
    descricao: 'Avalia grau de autonomia e participação nas decisões',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Organização do Trabalho',
    perguntas: [
      {
        id: 'sipro_ac1',
        texto: 'Tenho autonomia para organizar minhas tarefas.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_ac2',
        texto: 'Posso decidir como executar meu trabalho.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_ac3',
        texto: 'Tenho liberdade para sugerir melhorias no trabalho.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_ac4',
        texto: 'Minha opinião é considerada nas decisões que impactam meu trabalho.',
        dimensao: 'sipro_autonomia_controle',
        invertida: true,
        normas: ['NR-01', 'ISO 45001'],
      },
    ],
  },

  {
    id: 'sipro_clareza_papeis',
    nome: 'Clareza de Papéis',
    descricao: 'Avalia clareza das responsabilidades e orientações',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Organização do Trabalho',
    perguntas: [
      {
        id: 'sipro_cp1',
        texto: 'Sei exatamente quais são minhas responsabilidades.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_cp2',
        texto: 'Recebo orientações claras sobre o que é esperado de mim.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_cp3',
        texto: 'As tarefas do meu trabalho são bem definidas.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_cp4',
        texto: 'Raramente recebo ordens conflitantes ou contraditórias.',
        dimensao: 'sipro_clareza_papeis',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  {
    id: 'sipro_justica_organizacional',
    nome: 'Justiça Organizacional',
    descricao: 'Avalia equidade, respeito e valores organizacionais',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Organização do Trabalho',
    perguntas: [
      {
        id: 'sipro_jo1',
        texto: 'As decisões da empresa são tomadas de forma justa.',
        dimensao: 'sipro_justica_organizacional',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_jo2',
        texto: 'Todos são tratados com respeito no ambiente de trabalho.',
        dimensao: 'sipro_justica_organizacional',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_jo3',
        texto: 'As regras da empresa são aplicadas de forma igual para todos.',
        dimensao: 'sipro_justica_organizacional',
        invertida: true,
        normas: ['NR-01', 'ISO 45001'],
      },
      {
        id: 'sipro_jo4',
        texto: 'Sinto que a empresa valoriza seus colaboradores.',
        dimensao: 'sipro_justica_organizacional',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // GRUPO 3 — RELAÇÕES E SUPORTE
  // ══════════════════════════════════════════════════════════════

  {
    id: 'sipro_suporte_lideranca',
    nome: 'Suporte da Liderança',
    descricao: 'Avalia apoio, disponibilidade e qualidade da liderança',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Relações e Suporte',
    perguntas: [
      {
        id: 'sipro_sl1',
        texto: 'Minha liderança está disponível quando preciso de apoio.',
        dimensao: 'sipro_suporte_lideranca',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_sl2',
        texto: 'Recebo orientação adequada da minha liderança.',
        dimensao: 'sipro_suporte_lideranca',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_sl3',
        texto: 'Minha liderança se preocupa com o bem-estar da equipe.',
        dimensao: 'sipro_suporte_lideranca',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_sl4',
        texto: 'Posso conversar abertamente com minha liderança.',
        dimensao: 'sipro_suporte_lideranca',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  {
    id: 'sipro_suporte_social',
    nome: 'Suporte Social',
    descricao: 'Avalia cooperação e apoio entre colegas',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Relações e Suporte',
    perguntas: [
      {
        id: 'sipro_ss1',
        texto: 'Posso contar com meus colegas quando preciso de ajuda.',
        dimensao: 'sipro_suporte_social',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_ss2',
        texto: 'Existe cooperação entre os membros da equipe.',
        dimensao: 'sipro_suporte_social',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_ss3',
        texto: 'O ambiente de trabalho favorece o apoio entre colegas.',
        dimensao: 'sipro_suporte_social',
        invertida: true,
        normas: ['ISO 45001'],
      },
      {
        id: 'sipro_ss4',
        texto: 'Me sinto parte de uma equipe que trabalha unida.',
        dimensao: 'sipro_suporte_social',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },

  {
    id: 'sipro_qualidade_relacoes',
    nome: 'Qualidade das Relações',
    descricao: 'Avalia respeito, confiança e clima interpessoal',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Relações e Suporte',
    perguntas: [
      {
        id: 'sipro_qr1',
        texto: 'As relações entre colegas são respeitosas.',
        dimensao: 'sipro_qualidade_relacoes',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_qr2',
        texto: 'Existe confiança entre as pessoas da equipe.',
        dimensao: 'sipro_qualidade_relacoes',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_qr3',
        texto: 'Conflitos são resolvidos de forma adequada.',
        dimensao: 'sipro_qualidade_relacoes',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_qr4',
        texto: 'O ambiente de trabalho é psicologicamente saudável.',
        dimensao: 'sipro_qualidade_relacoes',
        invertida: true,
        normas: ['ISO 45001', 'ISO 45003'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // GRUPO 4 — SEGURANÇA PSICOLÓGICA
  // ══════════════════════════════════════════════════════════════

  {
    id: 'sipro_seguranca_psicologica',
    nome: 'Segurança Psicológica',
    descricao: 'Avalia liberdade de expressão sem medo de represálias',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Segurança Psicológica',
    perguntas: [
      {
        id: 'sipro_sp1',
        texto: 'Posso expressar opiniões sem medo de represálias.',
        dimensao: 'sipro_seguranca_psicologica',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_sp2',
        texto: 'Posso relatar erros sem receio de punição injusta.',
        dimensao: 'sipro_seguranca_psicologica',
        invertida: true,
        normas: ['ISO 45001'],
      },
      {
        id: 'sipro_sp3',
        texto: 'Posso fazer perguntas quando tenho dúvidas sem me sentir julgado.',
        dimensao: 'sipro_seguranca_psicologica',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_sp4',
        texto: 'Me sinto seguro para falar sobre problemas no trabalho.',
        dimensao: 'sipro_seguranca_psicologica',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  {
    id: 'sipro_reconhecimento_sentido',
    nome: 'Reconhecimento e Sentido do Trabalho',
    descricao: 'Avalia valorização, propósito e significado do trabalho',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    grupo: 'Segurança Psicológica',
    perguntas: [
      {
        id: 'sipro_rs1',
        texto: 'Meu trabalho é valorizado pela empresa.',
        dimensao: 'sipro_reconhecimento_sentido',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_rs2',
        texto: 'Recebo reconhecimento quando faço um bom trabalho.',
        dimensao: 'sipro_reconhecimento_sentido',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'sipro_rs3',
        texto: 'Meu trabalho tem significado e propósito para mim.',
        dimensao: 'sipro_reconhecimento_sentido',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'sipro_rs4',
        texto: 'Sinto orgulho do trabalho que realizo.',
        dimensao: 'sipro_reconhecimento_sentido',
        invertida: true,
        normas: ['NR-01'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // GRUPO 5 — CONDIÇÕES ESPECIAIS DE TRABALHO
  // ══════════════════════════════════════════════════════════════

  {
    id: 'sipro_ritmo_biologico',
    nome: 'Ritmo Biológico e Recuperação',
    descricao: 'Avalia impacto da jornada no sono, ritmo biológico e recuperação — dimensão inovadora do SIPRO',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    grupo: 'Condições Especiais de Trabalho',
    perguntas: [
      {
        id: 'sipro_rb1',
        texto: 'Minha jornada de trabalho interfere na qualidade do meu sono.',
        dimensao: 'sipro_ritmo_biologico',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_rb2',
        texto: 'Meu horário de trabalho dificulta manter uma rotina de vida saudável.',
        dimensao: 'sipro_ritmo_biologico',
        normas: ['NR-01'],
      },
      {
        id: 'sipro_rb3',
        texto: 'Sinto cansaço persistente decorrente dos horários de trabalho.',
        dimensao: 'sipro_ritmo_biologico',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_rb4',
        texto: 'Minha escala de trabalho dificulta o convívio familiar e social.',
        dimensao: 'sipro_ritmo_biologico',
        normas: ['NR-01'],
      },
      {
        id: 'sipro_rb5',
        texto: 'Meu horário de trabalho muda com frequência, afetando minha rotina.',
        dimensao: 'sipro_ritmo_biologico',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'sipro_rb6',
        texto: 'Tenho tempo suficiente para descansar entre uma jornada e outra.',
        dimensao: 'sipro_ritmo_biologico',
        invertida: true,
        normas: ['NR-17'],
      },
    ],
  },
];

export const SIPRO_TOTAL_PERGUNTAS = SIPRO_DIMENSOES.reduce(
  (acc, d) => acc + d.perguntas.length,
  0
);
