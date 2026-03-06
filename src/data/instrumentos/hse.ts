/**
 * HSE Management Standards Indicator Tool
 * Health and Safety Executive – UK (adaptado para o Brasil)
 * 
 * 7 dimensões: Demanda, Controle, Suporte do Gestor, Suporte dos Pares,
 *              Relacionamentos, Função, Gestão de Mudanças
 * 
 * Escala: 0 = Nunca | 1 = Raramente | 2 = Às vezes | 3 = Frequentemente | 4 = Sempre
 * Perguntas "invertida: true" → maior pontuação = melhor
 */

import type { DimensaoInstrumento } from './copsoq';

export const HSE_DIMENSOES: DimensaoInstrumento[] = [
  {
    id: 'hse_demanda',
    nome: 'Demanda',
    descricao: 'Carga de trabalho, padrões de trabalho e ambiente',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'hse_d1',
        texto: 'Tenho que trabalhar com intensidade para cumprir todas as minhas tarefas.',
        dimensao: 'hse_demanda',
        normas: ['NR-17'],
      },
      {
        id: 'hse_d2',
        texto: 'Tenho prazos impossíveis de cumprir.',
        dimensao: 'hse_demanda',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'hse_d3',
        texto: 'Tenho que negligenciar algumas tarefas porque tenho muito o que fazer.',
        dimensao: 'hse_demanda',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'hse_d4',
        texto: 'Não consigo fazer uma pausa quando preciso.',
        dimensao: 'hse_demanda',
        normas: ['NR-17'],
      },
      {
        id: 'hse_d5',
        texto: 'Trabalho em horas excessivas.',
        dimensao: 'hse_demanda',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },
  {
    id: 'hse_controle',
    nome: 'Controle',
    descricao: 'Participação dos trabalhadores na tomada de decisão',
    tipo: 'protetor',
    normas: ['NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'hse_c1',
        texto: 'Tenho autonomia para tomar decisões sobre meu ritmo de trabalho.',
        dimensao: 'hse_controle',
        invertida: true,
        normas: ['NR-17'],
      },
      {
        id: 'hse_c2',
        texto: 'Tenho opção de como faço meu trabalho.',
        dimensao: 'hse_controle',
        invertida: true,
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'hse_c3',
        texto: 'Tenho possibilidade de desenvolver novas habilidades.',
        dimensao: 'hse_controle',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_c4',
        texto: 'Tenho controle sobre o que faço no trabalho.',
        dimensao: 'hse_controle',
        invertida: true,
        normas: ['NR-17'],
      },
      {
        id: 'hse_c5',
        texto: 'Tenho a possibilidade de interferir quando as coisas não vão bem no trabalho.',
        dimensao: 'hse_controle',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'hse_suporte_gestor',
    nome: 'Suporte do Gestor',
    descricao: 'Suporte do gestor imediato e feedback',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      {
        id: 'hse_sg1',
        texto: 'Posso contar com meu gestor para me ajudar com um problema difícil no trabalho.',
        dimensao: 'hse_suporte_gestor',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_sg2',
        texto: 'Recebo feedback útil sobre como estou realizando meu trabalho.',
        dimensao: 'hse_suporte_gestor',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_sg3',
        texto: 'Meu gestor me trata com respeito.',
        dimensao: 'hse_suporte_gestor',
        invertida: true,
        normas: ['ISO 45003'],
        peso: 2,
      },
      {
        id: 'hse_sg4',
        texto: 'Meu gestor apoia meu desenvolvimento.',
        dimensao: 'hse_suporte_gestor',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_sg5',
        texto: 'Meu gestor encoraja o trabalho em equipe.',
        dimensao: 'hse_suporte_gestor',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'hse_suporte_pares',
    nome: 'Suporte dos Pares',
    descricao: 'Apoio e suporte dos colegas de trabalho',
    tipo: 'protetor',
    normas: ['ISO 45003'],
    perguntas: [
      {
        id: 'hse_sp1',
        texto: 'Se o trabalho fica difícil, meus colegas me ajudam.',
        dimensao: 'hse_suporte_pares',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_sp2',
        texto: 'Recebo o tipo certo de apoio dos meus colegas quando tenho problemas.',
        dimensao: 'hse_suporte_pares',
        invertida: true,
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_sp3',
        texto: 'No trabalho, as pessoas me tratam com respeito.',
        dimensao: 'hse_suporte_pares',
        invertida: true,
        normas: ['ISO 45003'],
        peso: 2,
      },
      {
        id: 'hse_sp4',
        texto: 'Meus colegas estão dispostos a ouvir meus problemas relacionados ao trabalho.',
        dimensao: 'hse_suporte_pares',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
  {
    id: 'hse_relacionamentos',
    nome: 'Relacionamentos',
    descricao: 'Comportamentos inaceitáveis, conflitos no trabalho',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'hse_r1',
        texto: 'Fui alvo de comportamento pessoal ofensivo no trabalho (ex: grosseria, maus-tratos).',
        dimensao: 'hse_relacionamentos',
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'hse_r2',
        texto: 'Existem conflitos que resultam em tensão ou atrito entre as pessoas no trabalho.',
        dimensao: 'hse_relacionamentos',
        normas: ['ISO 45003'],
      },
      {
        id: 'hse_r3',
        texto: 'As pessoas no trabalho fazem coisas para me dificultar a vida.',
        dimensao: 'hse_relacionamentos',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'hse_r4',
        texto: 'Fui assediado(a) ou intimidado(a) no trabalho.',
        dimensao: 'hse_relacionamentos',
        normas: ['NR-01'],
        peso: 2,
      },
    ],
  },
  {
    id: 'hse_funcao',
    nome: 'Função',
    descricao: 'Compreensão das responsabilidades e do papel no trabalho',
    tipo: 'protetor',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'hse_f1',
        texto: 'Sei o que é esperado de mim no trabalho.',
        dimensao: 'hse_funcao',
        invertida: true,
        normas: ['NR-01', 'NR-17'],
      },
      {
        id: 'hse_f2',
        texto: 'Sei como meu trabalho se encaixa nos objetivos gerais da empresa.',
        dimensao: 'hse_funcao',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'hse_f3',
        texto: 'Entendo como meu trabalho se relaciona com o de outras pessoas na empresa.',
        dimensao: 'hse_funcao',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'hse_f4',
        texto: 'Tenho clareza sobre os limites da minha autoridade no trabalho.',
        dimensao: 'hse_funcao',
        invertida: true,
        normas: ['NR-17'],
      },
    ],
  },
  {
    id: 'hse_mudancas',
    nome: 'Gestão de Mudanças',
    descricao: 'Como as mudanças organizacionais são comunicadas e gerenciadas',
    tipo: 'protetor',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'hse_m1',
        texto: 'Tenho uma visão clara de como as mudanças que acontecem no trabalho me afetarão.',
        dimensao: 'hse_mudancas',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'hse_m2',
        texto: 'Quando há mudanças no trabalho, sei como isso funcionará na prática.',
        dimensao: 'hse_mudancas',
        invertida: true,
        normas: ['NR-01'],
      },
      {
        id: 'hse_m3',
        texto: 'Os funcionários são consultados sobre as mudanças que afetam seu trabalho.',
        dimensao: 'hse_mudancas',
        invertida: true,
        normas: ['NR-01', 'ISO 45003'],
        peso: 2,
      },
      {
        id: 'hse_m4',
        texto: 'Quando passam por mudanças, recebo suporte suficiente do trabalho.',
        dimensao: 'hse_mudancas',
        invertida: true,
        normas: ['ISO 45003'],
      },
    ],
  },
];

export const HSE_TOTAL_PERGUNTAS = HSE_DIMENSOES.reduce(
  (total, d) => total + d.perguntas.length,
  0
);

export const HSE_DIMENSOES_RISCO = HSE_DIMENSOES.filter(d => d.tipo === 'risco').map(d => d.id);
export const HSE_DIMENSOES_PROTETOR = HSE_DIMENSOES.filter(d => d.tipo === 'protetor').map(d => d.id);
