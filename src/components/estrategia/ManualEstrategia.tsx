/**
 * Manual do Usuario — Modulo Estrategia & Governanca
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
    titulo: "Analise SWOT",
    subtitulo: "Diagnostico estrategico da organizacao",
    cor: AZUL,
    paragrafos: [
      'A analise SWOT mapeia Forcas, Fraquezas, Oportunidades e Ameacas da empresa. Acesse a aba "SWOT" e cadastre itens em cada quadrante para construir o diagnostico estrategico.',
      'Cada item pode receber prioridade (alta, media, baixa) e descricao detalhada. O sistema consolida o diagnostico e permite gerar acoes estrategicas vinculadas a cada item identificado.',
      'A SWOT pode ser aplicada no escopo da empresa individual ou do grupo economico, permitindo analises comparativas entre unidades.',
    ],
    dica: "Revise a SWOT trimestralmente. Mudancas no mercado, legislacao ou estrutura interna podem alterar significativamente o posicionamento estrategico da empresa.",
  },
  {
    num: "02",
    titulo: "Estrategia Oceano Azul",
    subtitulo: "Inovacao e diferenciacao competitiva",
    cor: VERDE,
    paragrafos: [
      'O Oceano Azul identifica oportunidades de inovacao atraves de 4 acoes estrategicas: Eliminar, Reduzir, Elevar e Criar. Cada acao representa uma dimensao de diferenciacao competitiva.',
      'Cadastre itens em cada quadrante e vincule acoes concretas com responsavel, prazo e status. O sistema acompanha a execucao e permite monitorar o progresso de cada iniciativa.',
      'A metodologia ajuda a empresa a se diferenciar no mercado, criando valor unico em vez de competir por preco ou volume.',
    ],
    dica: "Foque em itens que os concorrentes consideram obvios mas ninguem questiona. A inovacao real surge ao eliminar custos desnecessarios e criar valor onde ninguem oferece.",
  },
  {
    num: "03",
    titulo: "Cultura Organizacional",
    subtitulo: "Valores, comportamentos e identidade",
    cor: LARANJA,
    paragrafos: [
      'A aba "Cultura" permite mapear e gerir os pilares da cultura organizacional: missao, visao, valores, comportamentos esperados e rituais corporativos.',
      'O sistema oferece ferramentas para avaliar o alinhamento entre a cultura desejada e a cultura praticada, identificando gaps e oportunidades de desenvolvimento.',
      'Vincule iniciativas culturais a acoes concretas com prazos e responsaveis. A cultura nao e apenas um quadro na parede — e o conjunto de comportamentos que o sistema ajuda a monitorar.',
    ],
    dica: "A cultura organizacional impacta diretamente a seguranca do trabalho. Empresas com cultura forte de prevencao apresentam menos acidentes e maior engajamento.",
  },
  {
    num: "04",
    titulo: "Organograma Empresarial",
    subtitulo: "Estrutura hierarquica e funcional",
    cor: AZUL,
    paragrafos: [
      'O Organograma permite visualizar e gerenciar a estrutura hierarquica da empresa. O sistema pode gerar automaticamente a hierarquia baseada no campo "Gestor Imediato" dos colaboradores cadastrados.',
      'A opcao "Limpar e Gerar" reconstroi a estrutura corrigindo vinculos orfaos. A selecao de funcoes ignora o filtro de empresa ativa, listando todos os cargos do tenant com o departamento correspondente.',
      'O organograma suporta estruturas de grupos economicos e se sincroniza reativamente com a empresa ativa selecionada no seletor de escopo.',
    ],
    dica: "Mantenha o organograma atualizado. Ele alimenta avaliacoes de desempenho, fluxos de aprovacao e a identificacao de gestores imediatos em diversos modulos do sistema.",
  },
  {
    num: "05",
    titulo: "Seletor de Escopo",
    subtitulo: "Empresa individual ou grupo economico",
    cor: VERDE,
    paragrafos: [
      'O seletor de escopo permite alternar entre a visao de uma empresa individual e a visao consolidada do grupo economico. Todas as ferramentas do modulo (SWOT, Oceano Azul, Cultura, Organograma) respeitam o escopo selecionado.',
      'Ao trocar a empresa ativa, o seletor se redefine automaticamente para o nivel "Empresa", evitando a exibicao de dados inconsistentes sem necessidade de recarregamento.',
      'Para grupos economicos, a visao consolidada permite comparacoes estrategicas entre unidades e a identificacao de sinergias ou redundancias.',
    ],
    dica: "Use o escopo de grupo economico para reunioes de diretoria e o escopo de empresa para planejamento operacional de cada unidade.",
  },
  {
    num: "06",
    titulo: "Documentos e Recursos",
    subtitulo: "Registros e material de referencia",
    cor: AZUL,
    paragrafos: [
      'Todas as analises (SWOT, Oceano Azul, Cultura) sao registradas com historico, responsavel e data, garantindo rastreabilidade completa das decisoes estrategicas.',
      'O organograma pode ser exportado e utilizado em apresentacoes, auditorias e processos de integracao de novos colaboradores.',
      'Baixe este Manual do Modulo em PDF para ter um guia de referencia offline com todos os passos e orientacoes sobre planejamento estrategico e governanca.',
    ],
    dica: "Documente as decisoes estrategicas e suas justificativas. Em auditorias e due diligences, a rastreabilidade das decisoes demonstra maturidade de governanca.",
  },
];

const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Diagnostico SWOT",        sistema: "Forcas, Fraquezas, Oportunidades e Ameacas | Prioridades e acoes vinculadas",          cor: AZUL },
  { etapa: "Oceano Azul",             sistema: "Eliminar, Reduzir, Elevar e Criar | Acoes com responsavel e prazo",                    cor: VERDE },
  { etapa: "Cultura Organizacional",  sistema: "Missao, Visao, Valores | Comportamentos e rituais | Gaps culturais",                   cor: LARANJA },
  { etapa: "Organograma",             sistema: "Geracao automatica via Gestor Imediato | Estrutura hierarquica visual",                 cor: AZUL },
  { etapa: "Escopo Empresa/Grupo",    sistema: "Alternancia entre empresa e grupo economico | Sincronizacao reativa",                   cor: VERDE },
  { etapa: "Acoes Estrategicas",      sistema: "Vinculacao a itens SWOT e Oceano Azul | Status e acompanhamento",                      cor: AZUL },
];

const GLOSSARIO: [string, string][] = [
  ["SWOT",           "Strengths (Forcas), Weaknesses (Fraquezas), Opportunities (Oportunidades), Threats (Ameacas). Ferramenta de diagnostico estrategico."],
  ["Oceano Azul",    "Estrategia de inovacao que busca criar mercados inexplorados em vez de competir em mercados existentes (oceanos vermelhos)."],
  ["GHE",            "Grupo Homogeneo de Exposicao. Conjunto de trabalhadores com exposicao similar a riscos ocupacionais."],
  ["Grupo Economico","Conjunto de empresas sob controle comum. No sistema, permite visao consolidada e comparativa entre unidades."],
  ["Governanca",     "Conjunto de praticas que garantem transparencia, prestacao de contas e equidade na tomada de decisoes corporativas."],
  ["Cultura Org.",   "Conjunto de valores, crencas e comportamentos que definem como a organizacao opera e toma decisoes."],
  ["Organograma",    "Representacao grafica da estrutura hierarquica e funcional da organizacao."],
  ["Escopo",         "Abrangencia da analise: pode ser uma empresa individual ou o grupo economico consolidado."],
];

export function ManualEstrategia() {
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
      doc.text("Estrategia & Governanca", margin, 76);
      doc.setFontSize(14);
      doc.text("Planejamento, Cultura e Estrutura Organizacional", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(191, 219, 254);
      doc.text("Passo a passo em linguagem simples para", margin, 106);
      doc.text("gestores, diretoria e equipes de RH.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(191, 219, 254);
      doc.text("SWOT  |  Oceano Azul  |  Cultura  |  Organograma  |  Governanca", pageW / 2, 133, { align: "center" });

      const etapasCapa = ["SWOT","Oceano Azul","Cultura","Organograma"];
      const boxW = (pageW - 2 * margin - (etapasCapa.length - 1) * 2) / etapasCapa.length;
      const boxY = 148;
      etapasCapa.forEach((etapa, i) => {
        const bx = margin + i * (boxW + 2);
        doc.setFillColor(20, 50, 130);
        doc.roundedRect(bx, boxY, boxW, 14, 1, 1, "F");
        doc.setFontSize(7);
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
        ["Passo 01","Analise SWOT","3"],
        ["Passo 02","Estrategia Oceano Azul","4"],
        ["Passo 03","Cultura Organizacional","5"],
        ["Passo 04","Organograma Empresarial","6"],
        ["Passo 05","Seletor de Escopo","7"],
        ["Passo 06","Documentos e Recursos","8"],
        ["---","Fluxo Resumido","9"],
        ["---","Glossario de Termos","10"],
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
      doc.roundedRect(margin, y, pageW - 2 * margin, 32, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, AZUL);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introLinhas = doc.splitTextToSize(
        "Este material foi escrito para gestores, diretores e equipes de RH que utilizam o modulo de Estrategia & Governanca. Cada passo explica como utilizar as ferramentas de planejamento estrategico, cultura organizacional e estrutura hierarquica para fortalecer a governanca corporativa.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introLinhas.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 14 + i * 5);
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
      doc.text("FLUXO RESUMIDO — Estrategia & Governanca", margin, 18);

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
            `YourEyes  |  Estrategia & Governanca  |  Pag. ${pg}/${totalPages}`,
            pageW / 2, pageH - 8, { align: "center" }
          );
        }
      }

      doc.save("manual-estrategia-governanca.pdf");
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
