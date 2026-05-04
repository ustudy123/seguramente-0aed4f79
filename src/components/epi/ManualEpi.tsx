/**
 * Manual do Usuário — Módulo de Gestão de EPIs
 * Gerado em PDF via jsPDF.
 * Todos os caracteres são ASCII puro para compatibilidade com Helvetica do jsPDF.
 */
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RGB = [number, number, number];

const VERDE: RGB   = [21, 128, 61];
const VERDE_LIGHT: RGB = [187, 247, 208];
const CINZA: RGB   = [50, 50, 50];
const MUTED: RGB   = [120, 120, 120];
const AZUL: RGB    = [37, 99, 235];
const LARANJA: RGB = [180, 80, 0];
const VERMELHO: RGB = [220, 38, 38];
const AMBER: RGB   = [180, 120, 0];
const WHITE: RGB   = [255, 255, 255];

function fill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB)   { doc.setTextColor(c[0], c[1], c[2]); }

const PASSOS = [
  {
    num: "01",
    titulo: "Cadastre os Tipos de EPI",
    subtitulo: "A base do controle",
    cor: VERDE,
    paragrafos: [
      'Acesse o menu "Gestao de EPIs" e clique em "+ Categoria" ou "+ Novo EPI". Os tipos de EPI definem as caracteristicas dos equipamentos: nome, categoria (ex: Protecao da Cabeca), CA (Certificado de Aprovacao), marca, fabricante e validade.',
      'O campo CA e fundamental: e o numero do certificado emitido pelo Ministerio do Trabalho que valida o EPI para uso. Informe sempre o numero e a validade do CA para garantir rastreabilidade e conformidade.',
      'Configure tambem o estoque minimo e a periodicidade de troca (em dias). Esses parametros alimentam os alertas automaticos do modulo.',
    ],
    dica: "Dica: Use as categorias padrao (Protecao da Cabeca, Auditiva, Respiratoria etc.) para facilitar a pesquisa e os relatorios. Voce pode criar categorias personalizadas conforme a necessidade.",
  },
  {
    num: "02",
    titulo: "Registre as Entradas no Estoque",
    subtitulo: "Controle de recebimento",
    cor: AZUL,
    paragrafos: [
      'Na aba "Movimentar", registre cada entrada de EPI no estoque. Informe o tipo de EPI, a quantidade recebida, o local de destino (estabelecimento e almoxarifado), a nota fiscal (NF) e o fornecedor.',
      'O sistema suporta entrada manual ou por importacao de XML de NF-e. A entrada sempre credita o saldo no local especificado, mantendo o historico rastreavel de cada movimentacao.',
      'O campo "Local" e composto por dois niveis: Empresa/Obra (nivel superior) e Almoxarifado (nivel inferior). Isso permite controlar estoques distribuidos em multiplos centros.',
    ],
    dica: "Conformidade: Toda entrada registrada fica no historico de movimentacoes com data, usuario e nota fiscal. Isso e essencial para auditorias e comprovacao de conformidade com a NR-06.",
  },
  {
    num: "03",
    titulo: "Registre a Entrega ao Colaborador",
    subtitulo: "O evento principal do modulo",
    cor: VERDE,
    paragrafos: [
      'Clique em "Registrar Entrega" no topo da pagina. O assistente em etapas vai guiar o processo: selecione o colaborador, o EPI a ser entregue (por tipo ou numero de serie), a quantidade e o motivo (admissao, substituicao, treinamento etc.).',
      'O colaborador assina digitalmente na propria tela, confirmando o recebimento. A assinatura e armazenada junto ao registro. O sistema tambem captura data, hora, IP e user-agent para auditoria.',
      'Apos a entrega, o saldo do EPI e automaticamente debitado do estoque. O status do EPI muda para "Em Uso" e um registro de entrega ativa e criado na aba Entregas.',
    ],
    dica: "Legal: O registro digital de entrega substitui o Ficha de EPI em papel, com validade legal quando acompanhado de assinatura digital. O sistema gera comprovante imprimivel a qualquer momento.",
  },
  {
    num: "04",
    titulo: "Gerencie Devolucoes",
    subtitulo: "Destino correto para cada EPI devolvido",
    cor: LARANJA,
    paragrafos: [
      'Na aba "Entregas", localize a entrega ativa e clique em "Registrar Devolucao". Informe o destino do EPI: Estoque (EPI em bom estado), Manutencao (requer reparo) ou Descarte (danificado/vencido).',
      'Ao devolver para Estoque, o saldo e creditado novamente. Ao selecionar Manutencao ou Descarte, o EPI muda de status para "Danificado" ou "Descartado" e nao retorna ao estoque utilizavel automaticamente.',
      'Registre sempre uma observacao ao devolver — especialmente em casos de dano, perda ou vencimento. Isso garante rastreabilidade e subsidia a analise de causa raiz.',
    ],
    dica: "Auditoria: Toda devolucao registra o usuario que executou, a data, o destino e as observacoes. O historico completo esta disponivel na aba Historico de Movimentacoes.",
  },
  {
    num: "05",
    titulo: "Monitore Alertas e Estoque Minimo",
    subtitulo: "Prevencao e conformidade continua",
    cor: VERMELHO,
    paragrafos: [
      'A aba "Alertas" consolida automaticamente todas as situacoes que exigem atencao: EPIs com CA vencido, estoque abaixo do minimo configurado, EPIs proximos do vencimento e colaboradores com EPIs em atraso de troca.',
      'Cada alerta indica o tipo de problema, o EPI afetado e a acao recomendada. Os alertas de CA vencido sao criticos: um EPI com CA vencido nao pode ser legalmente entregue ao colaborador.',
      'Configure o "Estoque Minimo" em cada tipo de EPI para que o sistema gere o alerta de reposicao antes que o estoque se esgote. Use tambem a "Periodicidade de Troca (dias)" para alertas preventivos.',
    ],
    dica: "NR-06: A empresa e responsavel por fornecer EPIs em perfeito estado e com CA valido. O modulo de Alertas e o principal aliado para garantir esse cumprimento de forma proativa.",
  },
  {
    num: "06",
    titulo: "Consulte Saldo por Local",
    subtitulo: "Visibilidade distribuida do estoque",
    cor: AZUL,
    paragrafos: [
      'A aba "Por Local" exibe um dashboard com o saldo atual de cada tipo de EPI agrupado por empresa/obra e almoxarifado. Visualize facilmente quais locais estao com estoque critico.',
      'Use essa visao para planejar transferencias entre locais e garantir que cada ponto de trabalho tenha os EPIs necessarios disponiveis. Transferencias tambem sao registradas como movimentacoes.',
      'O grafico de distribuicao facilita a identificacao visual de desbalanceamentos — por exemplo, quando um almoxarifado esta superabastecido enquanto outro esta zerado.',
    ],
    dica: "Gestao eficiente: Mantenha um nivel de seguranca de estoque em cada local (acima do minimo configurado). Isso evita interrupcoes no fornecimento de EPIs em campo.",
  },
  {
    num: "07",
    titulo: "Utilize a Matriz de Protecao",
    subtitulo: "Definicao de EPIs obrigatorios por funcao",
    cor: AMBER,
    paragrafos: [
      'A aba "Matriz" permite definir quais EPIs sao obrigatorios para cada cargo/funcao da empresa. Essa configuracao e exigida pela NR-06 e serve de base para validar se todos os colaboradores estao com os EPIs necessarios.',
      'Configure cada linha da matriz: funcao x EPI x quantidade minima. O sistema cruza essa configuracao com os registros de entregas ativas para identificar colaboradores sem os EPIs obrigatorios.',
      'A Matriz tambem subsidia o assistente de entrega: ao selecionar um colaborador, o sistema pode sugerir os EPIs necessarios com base na funcao cadastrada.',
    ],
    dica: "NR-06: A empresa deve fornecer gratuitamente os EPIs adequados ao risco. A Matriz garante que nenhuma funcao fica sem o equipamento necessario — e que as entregas sao padronizadas.",
  },
  {
    num: "08",
    titulo: "Exporte e Audite com IA",
    subtitulo: "Conformidade e rastreabilidade total",
    cor: VERDE,
    paragrafos: [
      'A aba "Auditoria" usa inteligencia artificial para analisar os dados do modulo e identificar inconsistencias, lacunas de conformidade e oportunidades de melhoria. Gera um relatorio executivo automatico.',
      'Use o "Historico de Movimentacoes" para exportar todos os registros em formato tabular. O historico inclui entradas, saidas, entregas e devolucoes com data, usuario e detalhes de cada operacao.',
      'O historico de movimentacoes e o principal documento de conformidade para auditorias da NR-06, SESMT e orgaos fiscalizadores. Mantenha-o sempre atualizado e correto.',
    ],
    dica: "Dica: Realize uma auditoria mensal usando a aba Auditoria IA para identificar colaboradores com EPIs vencidos ou CA expirado antes que isso se torne um problema em uma fiscalizacao.",
  },
];

const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Cadastrar Tipo EPI",        sistema: "Define caracteristicas, CA, estoque minimo e periodicidade de troca",                               cor: VERDE },
  { etapa: "Entrada no Estoque",        sistema: "Credita saldo no local (empresa/almoxarifado) | Registra NF e fornecedor",                          cor: AZUL },
  { etapa: "Registrar Entrega",         sistema: "Debita estoque | Captura assinatura digital | Registra motivo e data",                              cor: VERDE },
  { etapa: "EPI em Uso",                sistema: "Status 'Em Uso' | Vinculo ativo colaborador-EPI | Prazo de validade monitorado",                    cor: LARANJA },
  { etapa: "Alerta de Vencimento/CA",   sistema: "Alerta automatico quando CA ou EPI esta proximo do vencimento",                                     cor: VERMELHO },
  { etapa: "Devolucao",                 sistema: "Destino: Estoque (credita) | Manutencao | Descarte | Registra observacoes",                         cor: LARANJA },
  { etapa: "Estoque abaixo do minimo",  sistema: "Alerta de reposicao gerado automaticamente | Notificacao para gestor",                              cor: VERMELHO },
  { etapa: "Auditoria IA",              sistema: "Analise de inconsistencias | Relatorio de conformidade NR-06 | Recomendacoes",                      cor: AZUL },
];

const GLOSSARIO: [string, string][] = [
  ["CA",          "Certificado de Aprovacao. Numero emitido pelo Ministerio do Trabalho que certifica o EPI para uso no Brasil. Obrigatorio pela NR-06."],
  ["NR-06",       "Norma Regulamentadora 6 — obriga as empresas a fornecer gratuitamente EPIs adequados ao risco identificado."],
  ["EPI",         "Equipamento de Protecao Individual. Todo dispositivo ou produto destinado a proteger a saude e integridade fisica do trabalhador."],
  ["Ficha de EPI","Documento que registra cada entrega de EPI ao colaborador, incluindo assinatura de recebimento. O sistema digitaliza esse registro."],
  ["Almoxarifado","Local fisico onde os EPIs sao armazenados. O sistema suporta multiplos almoxarifados por empresa."],
  ["Estoque Min.","Quantidade minima configurada de um tipo de EPI. Abaixo desse valor, o sistema gera um alerta de reposicao."],
  ["Matriz EPI",  "Tabela que define quais EPIs sao obrigatorios para cada funcao da empresa, exigida pela NR-06."],
  ["Mov. Estoque","Toda entrada ou saida de EPI registrada no sistema, com rastreabilidade completa de usuario, data e motivo."],
  ["Duravel",     "EPI que pode ser reutilizado (ex: capacete, botina). Diferente do descartavel (ex: mascara PFF2)."],
  ["Descartavel", "EPI de uso unico ou de curta duracao que deve ser substituido regularmente (ex: protetor auricular plug, mascara)."],
  ["SESMT",       "Servico Especializado em Engenharia de Seguranca e em Medicina do Trabalho. Responsavel pela gestao de EPIs."],
];

export function ManualEpi() {
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
        stroke(doc, VERDE);
        doc.setLineWidth(0.3);
        doc.line(margin, 10, pageW - margin, 10);
      };

      const checkY = (needed: number) => {
        if (y + needed > pageH - 16) addPage();
      };

      // ── CAPA ─────────────────────────────────────────────────────────────
      fill(doc, VERDE);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("MANUAL DO USUARIO", margin, 62);
      doc.setFontSize(20);
      doc.text("Gestao de EPIs", margin, 76);
      doc.setFontSize(14);
      doc.text("Controle de Equipamentos de Protecao Individual", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(187, 247, 208);
      doc.text("Passo a passo em linguagem simples para", margin, 106);
      doc.text("RH, gestores e responsaveis de SST.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(167, 243, 208);
      doc.text("NR-06  |  NR-15  |  CLT Art. 166/167  |  Portaria MTE", pageW / 2, 133, { align: "center" });

      const etapasCapa = ["Cadastro","Entrada","Entrega","Uso","Alerta","Devolucao","Auditoria"];
      const boxW = (pageW - 2 * margin - (etapasCapa.length - 1) * 2) / etapasCapa.length;
      const boxY = 148;
      etapasCapa.forEach((etapa, i) => {
        const bx = margin + i * (boxW + 2);
        doc.setFillColor(15, 90, 40);
        doc.roundedRect(bx, boxY, boxW, 14, 1, 1, "F");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(etapa, bx + boxW / 2, boxY + 9, { align: "center" });
      });

      doc.setFontSize(8);
      doc.setTextColor(167, 243, 208);
      doc.text(
        `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        margin, pageH - 20
      );
      doc.text("YourEyes.app", pageW - margin, pageH - 20, { align: "right" });

      // ── SUMARIO ──────────────────────────────────────────────────────────
      doc.addPage();
      y = margin + 4;

      fill(doc, VERDE);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMARIO", margin, 18);

      y = 40;
      const itens = [
        ["Passo 01","Cadastre os Tipos de EPI","3"],
        ["Passo 02","Registre as Entradas no Estoque","4"],
        ["Passo 03","Registre a Entrega ao Colaborador","5"],
        ["Passo 04","Gerencie Devolucoes","6"],
        ["Passo 05","Monitore Alertas e Estoque Minimo","7"],
        ["Passo 06","Consulte Saldo por Local","8"],
        ["Passo 07","Utilize a Matriz de Protecao","9"],
        ["Passo 08","Exporte e Audite com IA","10"],
        ["---","Fluxo Resumido","11"],
        ["---","Glossario de Termos","12"],
      ];

      doc.setFontSize(9);
      itens.forEach(([num, titulo, pag], i) => {
        const bgYi = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(240, 253, 244);
          doc.rect(margin, bgYi, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        text(doc, VERDE);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        doc.text(titulo, margin + 28, y + 1);
        text(doc, MUTED);
        doc.text(`pag. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;
      fill(doc, VERDE_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 32, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, VERDE);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introLinhas = doc.splitTextToSize(
        "Este material foi escrito para gestores de RH, tecnicos de SST e responsaveis pelo controle de EPIs. Voce nao precisa de conhecimento tecnico avancado - cada passo explica exatamente o que fazer. O sistema automatiza os calculos, alertas e documentos; voce cuida das decisoes.",
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
        const tituloLines = doc.splitTextToSize(`PASSO ${passo.num} — ${passo.titulo}`, pageW - 2 * margin - 8);
        tituloLines.forEach((line: string, li: number) => {
          doc.text(line, margin + 4, y + 9 + li * 6);
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(220, 252, 231);
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

        // Dica
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


      // ── FLUXO RESUMIDO ───────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, VERDE);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("FLUXO RESUMIDO — Gestao de EPIs", margin, 18);

      y = 36;

      const col1W = 52;
      const col2W = pageW - 2 * margin - col1W - 4;

      // Header tabela
      fill(doc, VERDE);
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
          doc.setFillColor(240, 253, 244);
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

      // ── GLOSSARIO ────────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, VERDE);
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
          doc.setFillColor(240, 253, 244);
          doc.rect(margin, y, pageW - 2 * margin, rowH, "F");
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        text(doc, VERDE);
        doc.text(termo, margin + 2, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        text(doc, CINZA);
        defLines.forEach((l: string, li: number) => {
          doc.text(l, margin + 38, y + 5 + li * 4.5);
        });

        y += rowH;
      });

      // ── Rodapé última página ─────────────────────────────────────────────
      const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        if (pg > 1) {
          doc.setFontSize(7);
          text(doc, MUTED);
          doc.text(
            `YourEyes - Manual do Usuario | Gestao de EPIs | Pagina ${pg}/${totalPages}`,
            pageW / 2, pageH - 8, { align: "center" }
          );
        }
      }

      doc.save("manual-gestao-epis.pdf");
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
      {gerando ? "Gerando PDF..." : "Baixar Manual do Módulo (PDF)"}
    </Button>
  );
}
