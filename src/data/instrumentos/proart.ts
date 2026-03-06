/**
 * PROART — Protocolo de Avaliação dos Riscos Psicossociais no Trabalho
 * Desenvolvido no Brasil (Mendes & Ferreira, 2007) — validado para NR-01, ISO 45003
 *
 * 5 dimensões — 50 questões:
 *   1. Organização do Trabalho (10)
 *   2. Estilo de Gestão (10)
 *   3. Laços Sociais (10)
 *   4. Sofrimento Patogênico (10)
 *   5. Danos Relacionados ao Trabalho (10)
 *
 * Escala: 0 = Nunca | 1 = Raramente | 2 = Às vezes | 3 = Frequentemente | 4 = Sempre
 * "invertida: true" → maior pontuação = melhor condição (fatores protetores)
 */

import type { DimensaoInstrumento } from './copsoq';

export const PROART_DIMENSOES: DimensaoInstrumento[] = [
  // ── 1. Organização do Trabalho ───────────────────────────────────────
  {
    id: 'proart_org_trabalho',
    nome: 'Organização do Trabalho',
    descricao: 'Divisão, conteúdo, ritmo, jornada e modos operatórios prescritos',
    tipo: 'risco',
    normas: ['NR-01', 'NR-17', 'ISO 45003'],
    perguntas: [
      {
        id: 'pa_ot1',
        texto: 'O ritmo de trabalho é acelerado.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-17'],
      },
      {
        id: 'pa_ot2',
        texto: 'As tarefas são repetitivas.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'pa_ot3',
        texto: 'Existe fiscalização rígida sobre o desempenho dos trabalhadores.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_ot4',
        texto: 'O trabalho é realizado sob pressão de prazos.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-17'],
      },
      {
        id: 'pa_ot5',
        texto: 'Há sobrecarga de tarefas.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-01', 'NR-17'],
      },
      {
        id: 'pa_ot6',
        texto: 'O trabalho impede o uso da criatividade.',
        dimensao: 'proart_org_trabalho',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_ot7',
        texto: 'As normas de produção são rígidas e difíceis de cumprir.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'pa_ot8',
        texto: 'As tarefas são cumpridas sem interrupção ou pausa.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-17'],
      },
      {
        id: 'pa_ot9',
        texto: 'O volume de trabalho não corresponde ao tempo disponível.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_ot10',
        texto: 'O trabalho exige que eu me esforce além dos meus limites físicos.',
        dimensao: 'proart_org_trabalho',
        normas: ['NR-17', 'ISO 45003'],
      },
    ],
  },

  // ── 2. Estilo de Gestão ──────────────────────────────────────────────
  {
    id: 'proart_estilo_gestao',
    nome: 'Estilo de Gestão',
    descricao: 'Práticas de gestão, poder e autonomia no processo de trabalho',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'pa_eg1',
        texto: 'Os gerentes utilizam punições para obter resultados.',
        dimensao: 'proart_estilo_gestao',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_eg2',
        texto: 'A chefia trata os trabalhadores sem respeito.',
        dimensao: 'proart_estilo_gestao',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_eg3',
        texto: 'A gerência ignora as sugestões dos trabalhadores.',
        dimensao: 'proart_estilo_gestao',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_eg4',
        texto: 'O estilo de gestão favorece o individualismo.',
        dimensao: 'proart_estilo_gestao',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_eg5',
        texto: 'A chefia sobrecarrega os trabalhadores que considera mais competentes.',
        dimensao: 'proart_estilo_gestao',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_eg6',
        texto: 'Os gerentes utilizam assédio moral para obter produtividade.',
        dimensao: 'proart_estilo_gestao',
        normas: ['NR-01'],
      },
      {
        id: 'pa_eg7',
        texto: 'A chefia não reconhece os esforços realizados pelos trabalhadores.',
        dimensao: 'proart_estilo_gestao',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_eg8',
        texto: 'As chefias imediatas pressionam os trabalhadores.',
        dimensao: 'proart_estilo_gestao',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_eg9',
        texto: 'As relações entre a chefia e os trabalhadores são conflituosas.',
        dimensao: 'proart_estilo_gestao',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_eg10',
        texto: 'Os chefes se preocupam somente com a produção e não com o bem-estar dos trabalhadores.',
        dimensao: 'proart_estilo_gestao',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },

  // ── 3. Laços Sociais ─────────────────────────────────────────────────
  {
    id: 'proart_lacos_sociais',
    nome: 'Laços Sociais',
    descricao: 'Qualidade das relações socioprofissionais no ambiente de trabalho',
    tipo: 'protetor',
    normas: ['ISO 45003', 'NR-01'],
    perguntas: [
      {
        id: 'pa_ls1',
        texto: 'Existe cooperação entre os colegas de trabalho.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls2',
        texto: 'Os colegas me apoiam quando tenho dificuldades.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls3',
        texto: 'As relações entre colegas são baseadas no respeito mútuo.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls4',
        texto: 'O ambiente de trabalho favorece a amizade entre colegas.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls5',
        texto: 'Existe reconhecimento pelos colegas pela qualidade do meu trabalho.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls6',
        texto: 'As divergências entre colegas são tratadas com respeito.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls7',
        texto: 'A comunicação entre colegas favorece a qualidade do trabalho.',
        dimensao: 'proart_lacos_sociais',
        normas: ['NR-01', 'ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls8',
        texto: 'Existe solidariedade entre os colegas.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls9',
        texto: 'Os colegas me ajudam quando tenho excesso de trabalho.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
      {
        id: 'pa_ls10',
        texto: 'O clima de trabalho é de confiança mútua entre os colegas.',
        dimensao: 'proart_lacos_sociais',
        normas: ['ISO 45003'],
        invertida: true,
      },
    ],
  },

  // ── 4. Sofrimento Patogênico ─────────────────────────────────────────
  {
    id: 'proart_sofrimento',
    nome: 'Sofrimento Patogênico',
    descricao: 'Vivências de sofrimento relacionadas ao trabalho: inutilidade, indignidade e falta de sentido',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'pa_sp1',
        texto: 'Sinto-me inútil no trabalho.',
        dimensao: 'proart_sofrimento',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_sp2',
        texto: 'Sinto-me desvalorizado pela organização onde trabalho.',
        dimensao: 'proart_sofrimento',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_sp3',
        texto: 'Sinto-me inseguro no trabalho.',
        dimensao: 'proart_sofrimento',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_sp4',
        texto: 'Sinto-me frustrado com o trabalho que realizo.',
        dimensao: 'proart_sofrimento',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_sp5',
        texto: 'Sinto-me envergonhado pelo trabalho que faço.',
        dimensao: 'proart_sofrimento',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_sp6',
        texto: 'Sinto-me sem perspectiva de crescimento profissional.',
        dimensao: 'proart_sofrimento',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_sp7',
        texto: 'Tenho medo de cometer erros no trabalho que provoquem consequências graves.',
        dimensao: 'proart_sofrimento',
        normas: ['NR-01'],
      },
      {
        id: 'pa_sp8',
        texto: 'Sinto-me desumanizado pelas condições de trabalho.',
        dimensao: 'proart_sofrimento',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_sp9',
        texto: 'Sinto-me humilhado no trabalho.',
        dimensao: 'proart_sofrimento',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_sp10',
        texto: 'O trabalho que realizo é desprovido de sentido.',
        dimensao: 'proart_sofrimento',
        normas: ['ISO 45003'],
      },
    ],
  },

  // ── 5. Danos Relacionados ao Trabalho ───────────────────────────────
  {
    id: 'proart_danos',
    nome: 'Danos Relacionados ao Trabalho',
    descricao: 'Manifestações físicas, psicológicas e sociais decorrentes das condições de trabalho',
    tipo: 'risco',
    normas: ['NR-01', 'ISO 45003'],
    perguntas: [
      {
        id: 'pa_dr1',
        texto: 'Tenho dores no corpo em função do trabalho.',
        dimensao: 'proart_danos',
        normas: ['NR-17', 'ISO 45003'],
      },
      {
        id: 'pa_dr2',
        texto: 'Sinto-me esgotado emocionalmente pelo trabalho.',
        dimensao: 'proart_danos',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_dr3',
        texto: 'Tenho dificuldade para dormir em função das preocupações com o trabalho.',
        dimensao: 'proart_danos',
        normas: ['NR-01'],
      },
      {
        id: 'pa_dr4',
        texto: 'Sinto irritação excessiva fora do trabalho por causa dele.',
        dimensao: 'proart_danos',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_dr5',
        texto: 'Tenho dores de cabeça relacionadas ao trabalho.',
        dimensao: 'proart_danos',
        normas: ['NR-17'],
      },
      {
        id: 'pa_dr6',
        texto: 'Sinto ansiedade ou nervosismo por causa do trabalho.',
        dimensao: 'proart_danos',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_dr7',
        texto: 'Me afastei de amigos e familiares por causa do trabalho.',
        dimensao: 'proart_danos',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_dr8',
        texto: 'Tenho dificuldade de concentração fora do trabalho em função do cansaço.',
        dimensao: 'proart_danos',
        normas: ['ISO 45003'],
      },
      {
        id: 'pa_dr9',
        texto: 'Apresento sintomas físicos (tremores, suores, palpitações) relacionados ao trabalho.',
        dimensao: 'proart_danos',
        normas: ['NR-01', 'ISO 45003'],
      },
      {
        id: 'pa_dr10',
        texto: 'O trabalho prejudicou minha qualidade de vida geral.',
        dimensao: 'proart_danos',
        normas: ['NR-01', 'ISO 45003'],
      },
    ],
  },
];

export const PROART_TOTAL_PERGUNTAS = PROART_DIMENSOES.reduce(
  (acc, d) => acc + d.perguntas.length,
  0
); // 50
