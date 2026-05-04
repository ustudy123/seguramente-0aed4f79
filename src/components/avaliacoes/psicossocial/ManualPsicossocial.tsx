/**
 * Manual do Usuário — Módulo de Gestão Psicossocial
 * Gerado em PDF via jsPDF. Reescrito com base no manual GRO/PGR revisado.
 *
 * Fixes v2:
 * - Todos os caracteres Unicode (→, —, etc.) substituídos por ASCII puro
 * - Altura das linhas do FLUXO calculada dinamicamente por linha
 * - checkY usa altura real de cada bloco antes de renderizar
 * - Colunas etapa/sistema com larguras ajustadas para evitar overflow
 */
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RGB = [number, number, number];

const ROXO: RGB   = [88, 28, 135];
const ROXO_LIGHT: RGB = [233, 213, 255];
const CINZA: RGB  = [50, 50, 50];
const MUTED: RGB  = [120, 120, 120];
const VERDE: RGB  = [16, 185, 129];
const AZUL: RGB   = [37, 99, 235];
const LARANJA: RGB = [234, 88, 12];
const VERMELHO: RGB = [220, 38, 38];
const AMBER: RGB  = [180, 120, 0];
const WHITE: RGB  = [255, 255, 255];

function fill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB)   { doc.setTextColor(c[0], c[1], c[2]); }

// ── Conteúdo — SOMENTE ASCII para compatibilidade com Helvetica do jsPDF ──────
const PASSOS = [
  {
    num: "01",
    titulo: "Crie uma Campanha de Avaliacao",
    subtitulo: "O ponto de partida",
    cor: ROXO,
    paragrafos: [
      'Acesse o menu lateral > "Avaliacoes" > "Psicossocial". Clique no botao "Nova Campanha" no canto superior direito da tela.',
      'O Assistente de Selecao ira aparecer para recomendar o instrumento mais adequado. Para a maioria das empresas, o SIPRO e o instrumento mais indicado. Ele e um instrumento autoral do YourEyes, desenvolvido com base nos tres modelos internacionais validados (COPSOQ III, HSE e PROART) e adaptado ao contexto brasileiro. Sua principal vantagem e a integracao nativa com os demais modulos da plataforma - GRO, Planos de Acao, Motor AET, Afastamentos e Indicadores de Saude -, tornando a avaliacao muito mais assertiva do que um questionario isolado. Atende aos requisitos da NR-01.',
      'Preencha o nome da campanha e defina o periodo de coleta (data de inicio e fim). Voce pode criar campanhas regulares (trimestrais, semestrais ou anuais) ou campanhas extraordinarias para situacoes urgentes.',
    ],
    dica: "Dica: Campanhas trimestrais constroem um historico robusto e permitem medir o impacto das acoes ao longo do tempo.",
  },
  {
    num: "02",
    titulo: "Vincule Setor + Funcao (Obrigatorio - NR-17)",
    subtitulo: "Etapa exigida por lei",
    cor: VERMELHO,
    paragrafos: [
      'Esta e a etapa mais importante do processo. Voce precisa informar quais grupos de trabalho serao avaliados. Nao sao os nomes das pessoas - sao as combinacoes de Setor e Funcao.',
      'Exemplos: "Producao + Operador de Maquinas", "Comercial + Consultor de Vendas". Cada par representa uma situacao de trabalho que sera analisada separadamente.',
      'Use os campos com autocomplete - o sistema ja sugere os setores e funcoes cadastrados. Voce pode selecionar da lista ou digitar um novo. Adicione quantos pares precisar.',
    ],
    dica: "Atencao: Sem pelo menos um par Setor+Funcao, a campanha nao pode ser criada. Isso garante que os riscos identificados sejam rastreaveis no GRO e no PGR.",
  },
  {
    num: "03",
    titulo: "Distribua para os Colaboradores",
    subtitulo: "Como as pessoas respondem",
    cor: AZUL,
    paragrafos: [
      'Apos ativar a campanha, o sistema gera um link unico de participacao. Acesse a campanha e clique em "Distribuir" para ver o link, QR Code e modelos de mensagem prontos.',
      'Envie o link por WhatsApp, e-mail ou imprima o QR Code para fixar nos murais. O colaborador nao precisa ter login no sistema.',
      'Ao acessar o link, o colaborador passa por uma verificacao via codigo WhatsApp (apenas para garantir que cada pessoa responde uma vez). Apos a verificacao, o codigo e descartado - a identidade nunca e vinculada as respostas.',
    ],
    dica: "Seguranca: Nome, CPF e telefone nunca sao armazenados junto as respostas. O sistema usa apenas um codigo hash anonimo que nao permite rastrear a identidade.",
  },
  {
    num: "04",
    titulo: "Regra do Anonimato",
    subtitulo: "Como o sistema protege os colaboradores",
    cor: VERDE,
    paragrafos: [
      'O sistema aplica automaticamente a regra de confidencialidade: resultados so sao exibidos quando o grupo tem no minimo 5 respondentes. Isso impede que qualquer pessoa seja identificada pelas respostas.',
      'Quando um grupo tem menos de 5 respondentes, os dados sao agrupados automaticamente: primeiro tenta mostrar por Setor; se ainda nao atinge o minimo, exibe o resultado geral da empresa.',
      'Para empresas com menos de 20 funcionarios, recomenda-se nao segmentar por Funcao - use apenas o nivel Setor ou empresa inteira para garantir que os resultados aparecam.',
    ],
    dica: "Conformidade: Esta regra segue a ISO 45003 e o COPSOQ III. Se nao for possivel garantir anonimato, o sistema exibe: 'Dados insuficientes para garantir confidencialidade'.",
  },
  {
    num: "05",
    titulo: "Encerre e Veja os Resultados",
    subtitulo: "O diagnostico automatico",
    cor: ROXO,
    paragrafos: [
      'Ao final do prazo (ou manualmente), encerre a campanha. O sistema calcula automaticamente o IPS (Indice Psicossocial) de 0 a 100 e classifica cada dimensao avaliada.',
      'Voce vera graficos radar com os pontos fortes e areas de atencao. O sistema tambem gera uma analise interpretativa em texto simples, explicando o que os numeros significam na pratica.',
      'O IPS e classificado em: 0-49 (Risco), 50-64 (Atencao), 65-79 (Estavel), 80-100 (Saudavel). Clique em "Ver Resultados" na campanha encerrada para acessar o diagnostico completo.',
    ],
    dica: "Dica: Clique em 'Exportar Relatorio PDF' para gerar um documento formal que pode ser arquivado no PGR da empresa.",
  },
  {
    num: "06",
    titulo: "Riscos Vao para o GRO Automaticamente",
    subtitulo: "Integracao com o inventario de riscos (PGR)",
    cor: LARANJA,
    paragrafos: [
      'Ao encerrar a campanha, todos os fatores de risco identificados sao exportados automaticamente para o GRO - o Inventario de Riscos Ocupacionais exigido pelo PGR (NR-01).',
      'Cada risco fica vinculado ao Setor + Funcao correspondente. Por exemplo: "Sobrecarga de Trabalho - Operador de Maquinas (Producao)".',
      'Riscos classificados como Alto (score 51-74) ou Critico (score 75-100) geram automaticamente um Plano de Acao 5W2H com prazo definido: 30 dias para Critico, 60 dias para Alto.',
    ],
    dica: "Importante: Nao e possivel arquivar ou encerrar um risco Alto ou Critico sem ter um plano de acao vinculado. Isso garante conformidade continua com a NR-01.",
  },
  {
    num: "07",
    titulo: "Quando o Sistema Recomenda a AET",
    subtitulo: "Analise Ergonomica do Trabalho (NR-17)",
    cor: AMBER,
    paragrafos: [
      'Quando o sistema identifica situacoes criticas - IPS abaixo de 65, riscos recorrentes ou multiplos fatores simultaneos - ele recomenda a realizacao de uma AET (Analise Ergonomica do Trabalho).',
      'A recomendacao aparece automaticamente na tela de resultados da campanha. IPS abaixo de 50 ou multiplos fatores criticos geram uma indicacao de AET obrigatoria, conforme exige a NR-17.',
      'Os dados psicossociais alimentam a Avaliacao Ergonomica Preliminar (AEP) do modulo de Ergonomia. O psicossocial nao e isolado - ele integra a ergonomia e contribui para a analise da organizacao do trabalho.',
    ],
    dica: "Acesse o modulo de Ergonomia para iniciar a AET. Os dados da campanha psicossocial ja estarao disponiveis como insumo para a analise.",
  },
  {
    num: "08",
    titulo: "Monitore e Reaprecie os Riscos",
    subtitulo: "O ciclo nao termina na primeira campanha",
    cor: VERDE,
    paragrafos: [
      'Apos executar as acoes do plano, o sistema exige que os riscos sejam reavaliados. Isso garante que as intervencoes foram eficazes e que o ciclo GRO esta completo.',
      'O Historico IPS mostra a evolucao do indice ao longo das campanhas, permitindo identificar tendencias e medir o impacto das acoes. Compare resultados antes e depois de intervencoes.',
      'O Inventario PGR consolida os dados de todas as campanhas encerradas em um unico relatorio auditavel, com medias ponderadas pelo numero de respondentes. Exporte para PDF para auditoria da NR-01.',
    ],
    dica: "Recomendacao: Realize campanhas pelo menos a cada 6 meses. A NR-01 exige atualizacao periodica do PGR sempre que houver mudancas organizacionais significativas.",
  },
];

// Linhas do FLUXO — todas em ASCII puro (sem setas Unicode)
const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Criar campanha",             sistema: "Gera link unico de participacao e configura o questionario selecionado",                          cor: AZUL },
  { etapa: "Vincular Setor+Funcao",      sistema: "Registra as situacoes de trabalho obrigatorias (NR-17) para rastreabilidade",                     cor: ROXO },
  { etapa: "Colaborador responde",       sistema: "Verificacao via WhatsApp (unicidade) > armazena hash anonimo > descarta identidade",              cor: VERDE },
  { etapa: "< 5 respostas no grupo",     sistema: "Agrupa dados: Funcao > Setor > Empresa (protecao de anonimato - ISO 45003)",                      cor: LARANJA },
  { etapa: "Encerrar campanha",          sistema: "Calcula IPS | Gera radar | Identifica fatores de risco | Interpretacao automatica",               cor: ROXO },
  { etapa: "Risco identificado",         sistema: "Exporta para GRO com Setor+Funcao vinculados | Registra no inventario do PGR",                    cor: VERMELHO },
  { etapa: "Risco Alto ou Critico",      sistema: "Plano de Acao 5W2H automatico | 30d (Critico) ou 60d (Alto) | Bloqueio sem acao",                 cor: VERMELHO },
  { etapa: "IPS < 65 ou multi-critico",  sistema: "Recomendacao ou obrigacao de AET (NR-17) | Dados alimentam AEP do modulo Ergonomia",              cor: AMBER },
  { etapa: "Apos execucao das acoes",    sistema: "Sistema exige reavaliacao dos riscos | Atualiza historico IPS | Mantém PGR atualizado",           cor: VERDE },
];

const GLOSSARIO: [string, string][] = [
  ["IPS",           "Indice Psicossocial. Score de 0 a 100 que indica a saude psicossocial da empresa. Quanto maior, melhor."],
  ["GRO",           "Gerenciamento de Riscos Ocupacionais. Inventario de todos os riscos identificados, exigido pela NR-01."],
  ["PGR",           "Programa de Gerenciamento de Riscos. Documento obrigatorio que inclui o inventario de riscos e o plano de acao."],
  ["NR-01",         "Norma Regulamentadora 1 — obriga as empresas a identificar, avaliar e controlar riscos ocupacionais, incluindo psicossociais."],
  ["NR-17",         "Norma Regulamentadora 17 — foca em ergonomia e condicoes de trabalho, exigindo avaliacao das situacoes de trabalho."],
  ["ISO 45003",     "Norma internacional sobre gestao de saude psicologica no trabalho."],
  ["AET",           "Analise Ergonomica do Trabalho. Estudo aprofundado de situacoes criticas, exigido pela NR-17."],
  ["5W2H",          "Modelo de plano de acao: O que, Por que, Onde, Quando, Quem, Como, Quanto custa."],
  ["Sit. Trabalho", "Combinacao de Setor + Funcao que representa um grupo de colaboradores avaliados."],
  ["SIPRO",         "Instrumento autoral do YourEyes, criado com base no COPSOQ III, HSE e PROART. Integrado nativamente com GRO, Planos de Acao, Motor AET e indicadores da plataforma. Recomendado na maioria dos cenarios."],
  ["Camp. Regular", "Avaliacao periodica programada (trimestral, semestral ou anual)."],
  ["Camp. Extraord.","Avaliacao urgente disparada por evento critico (acidente, reestruturacao)."],
];

export function ManualPsicossocial() {
  const [gerando, setGerando] = useState(false);

  const gerarPDF = async () => {
    setGerando(true);
    try {
      const doc = new jsPDF({ format: "a4", unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      let y = 0;

      // ── Helpers ──────────────────────────────────────────────────────────
      const addPage = () => {
        doc.addPage();
        y = margin;
        stroke(doc, ROXO);
        doc.setLineWidth(0.3);
        doc.line(margin, 10, pageW - margin, 10);
      };

      const checkY = (needed: number) => {
        if (y + needed > pageH - 16) addPage();
      };

      const rodape = () => {
        const total = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
        const cur = total;
        doc.setFontSize(7);
        text(doc, MUTED);
        doc.text(
          `YourEyes - Manual do Usuario | Gestao Psicossocial | Pagina ${cur}/${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      // ── CAPA ─────────────────────────────────────────────────────────────
      fill(doc, ROXO);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("MANUAL DO USUARIO", margin, 62);
      doc.setFontSize(20);
      doc.text("Gestao de Riscos Psicossociais", margin, 76);
      doc.setFontSize(14);
      doc.text("GRO / PGR - NR-01", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(233, 213, 255);
      doc.text("Passo a passo em linguagem simples para", margin, 106);
      doc.text("RH, gestores e responsaveis de SST.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(216, 180, 254);
      doc.text("NR-01  |  NR-17  |  ISO 45001  |  ISO 45003  |  LGPD", pageW / 2, 133, { align: "center" });

      // Fluxo visual na capa (sem setas Unicode)
      const etapasCapa = ["Coleta","Vinculo","Identificacao","Avaliacao","Inventario","Acao","Monitoramento"];
      const boxW = (pageW - 2 * margin - (etapasCapa.length - 1) * 2) / etapasCapa.length;
      const boxY = 148;
      etapasCapa.forEach((etapa, i) => {
        const bx = margin + i * (boxW + 2);
        doc.setFillColor(120, 40, 180);
        doc.roundedRect(bx, boxY, boxW, 14, 1, 1, "F");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(etapa, bx + boxW / 2, boxY + 9, { align: "center" });
      });

      doc.setFontSize(8);
      doc.setTextColor(196, 181, 253);
      doc.text(
        `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        margin, pageH - 20
      );
      doc.text("YourEyes.app", pageW - margin, pageH - 20, { align: "right" });

      // ── SUMARIO ──────────────────────────────────────────────────────────
      doc.addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMARIO", margin, 18);

      y = 40;
      const itens = [
        ["Passo 01","Crie uma Campanha de Avaliacao","3"],
        ["Passo 02","Vincule Setor + Funcao (Obrigatorio - NR-17)","4"],
        ["Passo 03","Distribua para os Colaboradores","5"],
        ["Passo 04","Regra do Anonimato","6"],
        ["Passo 05","Encerre e Veja os Resultados","7"],
        ["Passo 06","Riscos Vao para o GRO Automaticamente","8"],
        ["Passo 07","Quando o Sistema Recomenda a AET","9"],
        ["Passo 08","Monitore e Reaprecie os Riscos","10"],
        ["---","Fluxo Resumido","11"],
        ["---","Glossario de Termos","12"],
      ];

      doc.setFontSize(9);
      itens.forEach(([num, titulo, pag], i) => {
        const bgYi = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, bgYi, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        text(doc, ROXO);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        doc.text(titulo, margin + 28, y + 1);
        text(doc, MUTED);
        doc.text(`pag. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;
      fill(doc, ROXO_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 32, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, ROXO);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introLinhas = doc.splitTextToSize(
        "Este material foi escrito para gestores de RH, responsaveis de SST e lideres de equipe. Voce nao precisa ter conhecimento tecnico - cada passo explica exatamente o que fazer e o que acontece automaticamente nos bastidores. O sistema cuida das analises; voce cuida das decisoes.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introLinhas.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 14 + i * 5);
      });

      // ── PASSOS ───────────────────────────────────────────────────────────
      PASSOS.forEach((passo) => {
        addPage();
        y = margin + 4;

        fill(doc, passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        text(doc, WHITE);
        // Título pode ser longo — usar largura máxima
        const tituloLinhas = doc.splitTextToSize(passo.titulo, pageW - 2 * margin - 20);
        tituloLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 4, y + 9 + li * 5);
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(220, 220, 255);
        doc.text(passo.subtitulo, margin + 4, y + 18);

        doc.setFontSize(34);
        doc.setTextColor(255, 255, 255);
        doc.text(passo.num, pageW - margin - 4, y + 18, { align: "right" });

        y += 30;
        text(doc, CINZA);

        passo.paragrafos.forEach((para) => {
          const linhas = doc.splitTextToSize(para, pageW - 2 * margin - 10);
          const blocoH = linhas.length * 5.5 + 8;
          checkY(blocoH);

          fill(doc, passo.cor);
          doc.circle(margin + 2, y + 1.5, 1.5, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          text(doc, CINZA);
          linhas.forEach((l: string, li: number) => {
            doc.text(l, margin + 7, y + li * 5.5);
          });
          y += blocoH;
        });

        y += 2;

        const dicaLinhas = doc.splitTextToSize(passo.dica, pageW - 2 * margin - 12);
        const dicaH = dicaLinhas.length * 5 + 12;
        checkY(dicaH);

        doc.setFillColor(255, 251, 235);
        stroke(doc, AMBER);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, pageW - 2 * margin, dicaH, 2, 2, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(180, 120, 0);
        doc.text("Dica:", margin + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        text(doc, CINZA);
        dicaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 4, y + 13 + li * 5);
        });
        y += dicaH + 6;
      });

      // ── FLUXO RESUMIDO ───────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("FLUXO RESUMIDO - O QUE ACONTECE EM CADA ETAPA", margin, margin + 11);
      y = margin + 24;

      // Larguras das colunas
      const colEtapa = 50;   // mm para a coluna de etapa
      const seta = 6;        // mm para a seta
      const colSistema = pageW - 2 * margin - colEtapa - seta; // restante para o sistema
      const LINE_H = 5;      // altura de cada linha de texto (mm)
      const PAD_V = 5;       // padding vertical do bloco

      FLUXO_LINHAS.forEach((f, i) => {
        doc.setFontSize(8.5);

        // Pré-calcular linhas para dimensionar bloco
        const etapaLinhas = doc.splitTextToSize(f.etapa, colEtapa - 4);
        const sysLinhas   = doc.splitTextToSize(f.sistema, colSistema - 4);
        const maxLinhas   = Math.max(etapaLinhas.length, sysLinhas.length);
        const rowH        = maxLinhas * LINE_H + PAD_V * 2;

        checkY(rowH);

        // Fundo zebrado
        if (i % 2 === 0) {
          doc.setFillColor(248, 248, 255);
          doc.rect(margin, y, pageW - 2 * margin, rowH, "F");
        }

        // Barra colorida esquerda
        fill(doc, f.cor);
        doc.roundedRect(margin, y + 1, 3, rowH - 2, 1, 1, "F");

        // Texto etapa
        doc.setFont("helvetica", "bold");
        text(doc, f.cor);
        etapaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 6, y + PAD_V + li * LINE_H);
        });

        // Seta separadora
        doc.setFont("helvetica", "normal");
        text(doc, MUTED);
        doc.text("->", margin + colEtapa + 1, y + PAD_V + (maxLinhas - 1) * LINE_H / 2);

        // Texto sistema
        text(doc, CINZA);
        sysLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + colEtapa + seta, y + PAD_V + li * LINE_H);
        });

        y += rowH + 1;
      });

      rodape();

      // ── GLOSSARIO ────────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("GLOSSARIO DE TERMOS", margin, margin + 11);
      y = margin + 24;

      const colTermo  = 36;
      const colDef    = pageW - 2 * margin - colTermo - 4;

      GLOSSARIO.forEach(([termo, def], i) => {
        doc.setFontSize(8.5);
        const defLinhas = doc.splitTextToSize(def, colDef);
        const itemH = defLinhas.length * 5 + 8;
        checkY(itemH);

        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, y - 1, pageW - 2 * margin, itemH, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        text(doc, ROXO);
        const termoLinhas = doc.splitTextToSize(termo, colTermo);
        termoLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 2, y + 4 + li * 5);
        });

        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        defLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + colTermo + 4, y + 4 + li * 5);
        });
        y += itemH;
      });

      rodape();

      doc.save(`Manual_Psicossocial_YourEyes_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Manual gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o manual. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={gerarPDF}
      disabled={gerando}
      className="gap-2"
    >
      {gerando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando Manual...</>
      ) : (
        <><BookOpen className="h-4 w-4" /> Baixar Manual PDF</>
      )}
    </Button>
  );
}
