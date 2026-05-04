/**
 * Manual do Usuario — Modulo Compliance SST
 * Gerado em PDF via jsPDF. Caracteres ASCII puro.
 */
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RGB = [number, number, number];

const AZUL: RGB     = [30, 64, 175];
const AZUL_LIGHT: RGB = [191, 219, 254];
const CINZA: RGB    = [50, 50, 50];
const MUTED: RGB    = [120, 120, 120];
const VERDE: RGB    = [21, 128, 61];
const LARANJA: RGB  = [180, 80, 0];
const VERMELHO: RGB = [220, 38, 38];
const AMBER: RGB    = [180, 120, 0];
const WHITE: RGB    = [255, 255, 255];

function fill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB)   { doc.setTextColor(c[0], c[1], c[2]); }

const PASSOS = [
  {
    num: "01",
    titulo: "Importe Documentos com IA",
    subtitulo: "Extracao inteligente de PGR, PCMSO e LTCAT",
    cor: AZUL,
    paragrafos: [
      'Acesse a aba "Importacao IA" e faca upload do documento SST (PDF). Classifique o tipo: PGR, PCMSO, LTCAT ou outro documento legal. O sistema utiliza inteligencia artificial (GPT-4o) para extrair automaticamente os dados relevantes.',
      'O fluxo possui 4 etapas: Upload e Classificacao, Extracao IA, Revisao dos Dados e Consolidacao. Na etapa de revisao, voce pode ajustar os dados extraidos antes de salvar no sistema.',
      'Para PGR, o sistema extrai riscos ocupacionais e planos de acao 5W2H. Para PCMSO, extrai a matriz de exames por cargo/setor. Para LTCAT, identifica agentes nocivos e enquadramentos legais.',
    ],
    dica: "A classificacao manual do tipo de documento e essencial para guiar a IA. Documentos mal classificados podem resultar em extracao incompleta ou incorreta.",
  },
  {
    num: "02",
    titulo: "Revise os Dados Extraidos",
    subtitulo: "Validacao humana antes da consolidacao",
    cor: VERDE,
    paragrafos: [
      'Apos a extracao, o sistema apresenta os dados identificados para revisao. Verifique riscos, exames, agentes nocivos e planos de acao antes de consolidar.',
      'Voce pode editar, adicionar ou remover itens identificados pela IA. A revisao humana e fundamental para garantir a precisao dos dados que alimentarao alertas e acoes.',
      'Documentos extensos sao processados com chunking inteligente e varredura completa, garantindo que nenhuma informacao relevante seja perdida.',
    ],
    dica: "Sempre revise os dados extraidos com atencao. A IA e uma ferramenta de apoio, mas a validacao tecnica e responsabilidade do profissional habilitado.",
  },
  {
    num: "03",
    titulo: "Gerencie Documentos Importados",
    subtitulo: "Controle de vigencia e rastreabilidade",
    cor: AZUL,
    paragrafos: [
      'A aba "Documentos" lista todos os documentos importados com status de vigencia: vigente (verde), proximo do vencimento (amarelo) ou vencido (vermelho).',
      'Cada documento mantem o historico completo: data de importacao, profissional responsavel, empresa emissora e resultados da analise IA. Voce pode revisar os dados extraidos a qualquer momento.',
      'Documentos vencidos geram alertas automaticos e podem impactar o status de compliance da empresa.',
    ],
    dica: "Mantenha uma rotina de verificacao mensal dos documentos. PGR, PCMSO e LTCAT possuem validades distintas e devem ser renovados antes do vencimento.",
  },
  {
    num: "04",
    titulo: "Monitore o Painel de Indicadores",
    subtitulo: "Visao gerencial de compliance",
    cor: VERDE,
    paragrafos: [
      'A aba "Painel" apresenta indicadores consolidados: documentos vigentes, vencidos, analises IA concluidas e total de documentos no sistema.',
      'O Calendario de Vencimentos ordena os documentos por data de validade, com indicadores visuais de urgencia. Documentos proximos do vencimento (60 dias) recebem destaque em amarelo.',
      'Use o painel para reunioes de compliance e auditorias. Os indicadores demonstram o nivel de maturidade da gestao documental SST da empresa.',
    ],
    dica: "O Calendario de Vencimentos e a ferramenta mais importante para gestao proativa. Verifique-o semanalmente para evitar lacunas de conformidade.",
  },
  {
    num: "05",
    titulo: "Acompanhe Alertas e Pendencias",
    subtitulo: "Notificacoes automaticas de risco",
    cor: LARANJA,
    paragrafos: [
      'A aba "Alertas" consolida todas as pendencias identificadas: documentos vencidos, lacunas normativas, inconsistencias entre PGR/PCMSO/LTCAT e acoes pendentes.',
      'Os alertas sao classificados por prioridade (critica, alta, media, baixa) e podem gerar acoes corretivas automaticamente vinculadas ao Plano de Acao Global.',
      'O sistema audita a coerencia entre os documentos: se o PGR identifica um risco e o PCMSO nao preve o exame correspondente, um alerta de inconsistencia e gerado.',
    ],
    dica: "Alertas criticos devem ser tratados imediatamente. Lacunas entre PGR, PCMSO e LTCAT podem configurar passivo trabalhista e previdenciario.",
  },
  {
    num: "06",
    titulo: "Gerencie Acoes de Compliance",
    subtitulo: "Plano de acao 5W2H integrado",
    cor: VERMELHO,
    paragrafos: [
      'A aba "Acoes" lista todas as acoes corretivas e preventivas geradas a partir dos documentos importados e alertas identificados. Cada acao segue o modelo 5W2H.',
      'As acoes podem ser criadas automaticamente pela IA durante a importacao do PGR ou manualmente pelo usuario. Todas sao vinculadas ao documento de origem para rastreabilidade.',
      'O status das acoes (pendente, em andamento, concluida) alimenta os indicadores do Painel e impacta a nota de maturidade de compliance.',
    ],
    dica: "Acoes concluidas devem ser evidenciadas com documentos comprobatorios. Em caso de fiscalizacao, a rastreabilidade completa e fundamental.",
  },
  {
    num: "07",
    titulo: "Auditoria eSocial",
    subtitulo: "Confronto de eventos SST",
    cor: AZUL,
    paragrafos: [
      'A aba "eSocial" permitira (em breve) o confronto automatico entre eventos enviados ao eSocial (S-2210, S-2220, S-2240) e os dados dos documentos legais importados.',
      'O objetivo e identificar inconsistencias: riscos declarados no PGR que nao foram informados no evento S-2240, exames do PCMSO nao refletidos no S-2220, entre outros.',
      'Este recurso exigira a conexao do certificado digital da empresa para consulta automatica dos eventos no ambiente do eSocial.',
    ],
    dica: "O eSocial exige coerencia total entre PGR, PCMSO e LTCAT. Inconsistencias podem gerar notificacoes automaticas da Receita Federal e do INSS.",
  },
];

const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Upload do Documento",      sistema: "Classificacao manual do tipo (PGR/PCMSO/LTCAT) | Upload de PDF",                       cor: AZUL },
  { etapa: "Extracao IA",              sistema: "GPT-4o processa o documento | Chunking inteligente | Varredura completa",               cor: VERDE },
  { etapa: "Revisao Humana",           sistema: "Validacao dos dados extraidos | Edicao e ajustes manuais",                              cor: AZUL },
  { etapa: "Consolidacao",             sistema: "Salva no sistema | Gera alertas | Vincula acoes 5W2H",                                  cor: VERDE },
  { etapa: "Monitoramento",            sistema: "Calendario de vencimentos | Alertas automaticos | Indicadores",                         cor: LARANJA },
  { etapa: "Auditoria Normativa",      sistema: "Coerencia PGR x PCMSO x LTCAT | Lacunas identificadas | Passivos juridicos",           cor: VERMELHO },
  { etapa: "Acoes Corretivas",         sistema: "Plano de acao 5W2H | Vinculacao ao documento | Rastreabilidade completa",               cor: AZUL },
  { etapa: "eSocial (futuro)",         sistema: "Confronto S-2210/S-2220/S-2240 | Consistencia com documentos legais",                   cor: AZUL },
];

const GLOSSARIO: [string, string][] = [
  ["PGR",         "Programa de Gerenciamento de Riscos. Substituiu o PPRA. Documento obrigatorio que identifica e controla riscos ocupacionais (NR-01)."],
  ["PCMSO",       "Programa de Controle Medico de Saude Ocupacional. Define exames obrigatorios por funcao e periodicidade (NR-07)."],
  ["LTCAT",       "Laudo Tecnico das Condicoes Ambientais de Trabalho. Documenta agentes nocivos para fins previdenciarios."],
  ["5W2H",        "Metodologia de plano de acao: What (O que), Why (Por que), Where (Onde), When (Quando), Who (Quem), How (Como), How much (Quanto custa)."],
  ["S-2210",      "Evento do eSocial para comunicacao de acidente de trabalho (CAT)."],
  ["S-2220",      "Evento do eSocial para monitoramento da saude do trabalhador (ASO)."],
  ["S-2240",      "Evento do eSocial para condicoes ambientais de trabalho (agentes nocivos)."],
  ["LINACH",      "Lista Nacional de Agentes Cancerigenos para Humanos. Referencia para classificacao de riscos."],
  ["GRO",         "Gerenciamento de Riscos Ocupacionais. Processo sistematico da NR-01 para identificacao, avaliacao e controle de riscos."],
  ["Compliance",  "Conformidade com leis, normas e politicas internas. No contexto SST, refere-se ao cumprimento das NRs e legislacao trabalhista."],
  ["NR-01",       "Norma Regulamentadora sobre disposicoes gerais e gerenciamento de riscos ocupacionais."],
];

export function ManualComplianceSST() {
  const [gerando, setGerando] = useState(false);

  const gerarPDF = async () => {
    setGerando(true);
    try {
      const doc = new jsPDF({ format: "a4", unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      let y = 0;

      const addPage = () => {
        doc.addPage();
        y = margin;
        stroke(doc, AZUL);
        doc.setLineWidth(0.3);
        doc.line(margin, 10, pageW - margin, 10);
      };

      const checkY = (needed: number) => {
        if (y + needed > pageH - 16) addPage();
      };

      // ── CAPA ──
      fill(doc, AZUL);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("MANUAL DO USUARIO", margin, 62);
      doc.setFontSize(20);
      doc.text("Compliance SST", margin, 76);
      doc.setFontSize(14);
      doc.text("Governanca e Inteligencia em Saude e Seguranca", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(191, 219, 254);
      doc.text("Passo a passo em linguagem simples para", margin, 106);
      doc.text("gestores de SST, RH e profissionais de compliance.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(191, 219, 254);
      doc.text("NR-01  |  NR-07  |  eSocial  |  LINACH  |  Tema 555 STF", pageW / 2, 133, { align: "center" });

      const etapasCapa = ["Importacao IA","Documentos","Painel","Alertas","Acoes","eSocial"];
      const boxW = (pageW - 2 * margin - (etapasCapa.length - 1) * 2) / etapasCapa.length;
      const boxY = 148;
      etapasCapa.forEach((etapa, i) => {
        const bx = margin + i * (boxW + 2);
        doc.setFillColor(20, 50, 130);
        doc.roundedRect(bx, boxY, boxW, 14, 1, 1, "F");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(etapa, bx + boxW / 2, boxY + 9, { align: "center" });
      });

      doc.setFontSize(8);
      doc.setTextColor(191, 219, 254);
      doc.text(
        `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        margin, pageH - 20
      );
      doc.text("YourEyes.app", pageW - margin, pageH - 20, { align: "right" });

      // ── SUMARIO ──
      doc.addPage();
      y = margin + 4;

      fill(doc, AZUL);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMARIO", margin, 18);

      y = 40;
      const itens = [
        ["Passo 01","Importe Documentos com IA","3"],
        ["Passo 02","Revise os Dados Extraidos","4"],
        ["Passo 03","Gerencie Documentos Importados","5"],
        ["Passo 04","Monitore o Painel de Indicadores","6"],
        ["Passo 05","Acompanhe Alertas e Pendencias","7"],
        ["Passo 06","Gerencie Acoes de Compliance","8"],
        ["Passo 07","Auditoria eSocial","9"],
        ["---","Fluxo Resumido","10"],
        ["---","Glossario de Termos","11"],
      ];

      doc.setFontSize(9);
      itens.forEach(([num, titulo, pag], i) => {
        const bgYi = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(239, 246, 255);
          doc.rect(margin, bgYi, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        text(doc, AZUL);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        doc.text(titulo, margin + 28, y + 1);
        text(doc, MUTED);
        doc.text(`pag. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;
      fill(doc, AZUL_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 38, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, AZUL);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introLinhas = doc.splitTextToSize(
        "Este material foi escrito para tecnicos de SST, gestores de RH e profissionais de compliance. Cada passo explica como utilizar o modulo de Compliance SST para importar documentos legais (PGR, PCMSO, LTCAT), extrair dados com inteligencia artificial, monitorar vencimentos e garantir a coerencia normativa da empresa.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introLinhas.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 14 + i * 5);
      });

      // ── Aviso legal ──
      y += 44;
      checkY(20);
      doc.setFillColor(254, 249, 195);
      doc.roundedRect(margin, y, pageW - 2 * margin, 18, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      text(doc, AMBER);
      doc.text("! Aviso legal:", margin + 4, y + 6);
      doc.setFont("helvetica", "normal");
      text(doc, [100, 70, 0] as RGB);
      const avisoLines = doc.splitTextToSize(
        "Este modulo nao substitui profissionais legalmente habilitados nem elabora documentos obrigatorios. Atua como orquestrador da execucao, auditor de coerencia e gerador de inteligencia preventiva.",
        pageW - 2 * margin - 8
      );
      avisoLines.forEach((line: string, li: number) => {
        doc.text(line, margin + 4, y + 11 + li * 4);
      });

      // ── PASSOS ──
      PASSOS.forEach((passo) => {
        addPage();
        y = margin + 4;

        fill(doc, passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        text(doc, WHITE);
        const tituloLines = doc.splitTextToSize(`PASSO ${passo.num} — ${passo.titulo}`, pageW - 2 * margin - 8);
        tituloLines.forEach((line: string, li: number) => {
          doc.text(line, margin + 4, y + 9 + li * 6);
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(220, 230, 255);
        doc.text(passo.subtitulo, margin + 4, y + 19);

        y += 28;

        passo.paragrafos.forEach((par) => {
          const lines = doc.splitTextToSize(par, pageW - 2 * margin);
          const h = lines.length * 5 + 6;
          checkY(h);
          text(doc, CINZA);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          lines.forEach((line: string, li: number) => {
            doc.text(line, margin, y + li * 5);
          });
          y += h;
        });

        const dicaLines = doc.splitTextToSize(passo.dica, pageW - 2 * margin - 14);
        const dicaH = dicaLines.length * 5 + 12;
        checkY(dicaH);
        doc.setFillColor(254, 249, 195);
        doc.roundedRect(margin, y, pageW - 2 * margin, dicaH, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        text(doc, AMBER);
        doc.text("! Atencao / Dica:", margin + 4, y + 6);
        doc.setFont("helvetica", "normal");
        text(doc, [100, 70, 0] as RGB);
        dicaLines.forEach((line: string, li: number) => {
          doc.text(line, margin + 4, y + 11 + li * 5);
        });
        y += dicaH + 4;
      });

      // ── FLUXO RESUMIDO ──
      addPage();
      y = margin + 4;

      fill(doc, AZUL);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("FLUXO RESUMIDO — Compliance SST", margin, 18);

      y = 36;

      const col1W = 52;
      const col2W = pageW - 2 * margin - col1W - 4;

      fill(doc, AZUL);
      doc.rect(margin, y, pageW - 2 * margin, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      text(doc, WHITE);
      doc.text("ETAPA / EVENTO", margin + 2, y + 5.5);
      doc.text("O QUE O SISTEMA FAZ", margin + col1W + 4, y + 5.5);
      y += 10;

      FLUXO_LINHAS.forEach((linha, i) => {
        const sistemaLines = doc.splitTextToSize(linha.sistema, col2W - 4);
        const rowH = Math.max(sistemaLines.length * 4.5, 8) + 4;
        checkY(rowH);

        if (i % 2 === 0) {
          doc.setFillColor(239, 246, 255);
          doc.rect(margin, y, pageW - 2 * margin, rowH, "F");
        }

        fill(doc, linha.cor);
        doc.rect(margin, y, 3, rowH, "F");

        const etapaLines = doc.splitTextToSize(linha.etapa, col1W - 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        text(doc, CINZA);
        etapaLines.forEach((l: string, li: number) => {
          doc.text(l, margin + 5, y + 5 + li * 4.5);
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        text(doc, CINZA);
        sistemaLines.forEach((l: string, li: number) => {
          doc.text(l, margin + col1W + 4, y + 5 + li * 4.5);
        });

        y += rowH + 1;
      });

      // ── GLOSSARIO ──
      addPage();
      y = margin + 4;

      fill(doc, AZUL);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("GLOSSARIO DE TERMOS", margin, 18);

      y = 36;

      GLOSSARIO.forEach(([termo, def], i) => {
        const defLines = doc.splitTextToSize(def, pageW - 2 * margin - 38);
        const rowH = defLines.length * 4.5 + 8;
        checkY(rowH);

        if (i % 2 === 0) {
          doc.setFillColor(239, 246, 255);
          doc.rect(margin, y, pageW - 2 * margin, rowH, "F");
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        text(doc, AZUL);
        doc.text(termo, margin + 2, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        text(doc, CINZA);
        defLines.forEach((l: string, li: number) => {
          doc.text(l, margin + 38, y + 5 + li * 4.5);
        });

        y += rowH;
      });

      // ── Rodape todas as paginas ──
      const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        if (pg > 1) {
          doc.setFontSize(7);
          text(doc, MUTED);
          doc.text(
            `YourEyes  |  Compliance SST  |  Pag. ${pg}/${totalPages}`,
            pageW / 2, pageH - 8, { align: "center" }
          );
        }
      }

      doc.save("manual-compliance-sst.pdf");
      toast.success("Manual baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o manual. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Button onClick={gerarPDF} disabled={gerando} className="gap-2">
      {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
      {gerando ? "Gerando PDF..." : "Baixar Manual do Modulo (PDF)"}
    </Button>
  );
}
