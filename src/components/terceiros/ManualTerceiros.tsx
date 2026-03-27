/**
 * Manual do Usuario — Modulo de Terceiros & SST
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
    titulo: "Cadastre a Empresa Terceirizada",
    subtitulo: "Base do controle de compliance",
    cor: AZUL,
    paragrafos: [
      'Acesse o modulo "Terceiros & SST" e clique em "+ Novo Terceiro". Preencha o CNPJ — o sistema consulta automaticamente a BrasilAPI e preenche razao social, nome fantasia, CNAE e atividade principal.',
      'Complete os dados de contato (responsavel, email, telefone), selecione os tipos de servico prestados (manutencao, eletrica, obras etc.) e defina o tipo de acesso: eventual, recorrente ou continuo.',
      'Informe as unidades e setores onde o terceiro atuara, o periodo do contrato e se as atividades envolvem riscos especiais. O status inicial sera "liberado", "restrito" ou "bloqueado" conforme a documentacao.',
    ],
    dica: "O CNAE automatico ajuda a identificar a atividade economica real do terceiro e validar se o servico contratado e compativel com o objeto social da empresa.",
  },
  {
    num: "02",
    titulo: "Cadastre os Trabalhadores do Terceiro",
    subtitulo: "Controle individual de cada prestador",
    cor: VERDE,
    paragrafos: [
      'Dentro da ficha do terceiro, acesse a aba "Trabalhadores" e clique em "+ Trabalhador". Informe nome, CPF, funcao e as atividades que serao executadas.',
      'Selecione a unidade e o setor onde o trabalhador atuara. Se houver atividades de risco (trabalho em altura, espaco confinado, eletricidade etc.), marque-as no campo correspondente.',
      'O status do trabalhador e recalculado automaticamente pelo sistema: se qualquer documento ou treinamento obrigatorio estiver vencido, o status muda para "bloqueado" automaticamente.',
    ],
    dica: "Mantenha o cadastro de trabalhadores sempre atualizado. Quando um prestador trocar de equipe, desative os trabalhadores antigos e cadastre os novos para manter a rastreabilidade.",
  },
  {
    num: "03",
    titulo: "Gerencie Documentos da Empresa e Trabalhadores",
    subtitulo: "Compliance documental completo",
    cor: AZUL,
    paragrafos: [
      'Na aba "Documentos" do terceiro, envie os documentos obrigatorios da empresa: PGR, PCMSO, LTCAT, contrato, seguros e certificados legais. Informe data de emissao e validade para controle automatico.',
      'Para documentos de trabalhadores, acesse o trabalhador especifico e envie: ASO, certificados de NRs (NR-10, NR-12, NR-33, NR-35), fichas de EPI e outros documentos pertinentes.',
      'O sistema monitora as validades e altera automaticamente o status para "a_vencer" (30 dias antes) ou "vencido" na data de expiracao. Documentos vencidos bloqueiam o trabalhador.',
    ],
    dica: "O painel de Vencimentos consolida todos os documentos proximos do vencimento em uma unica tela, facilitando a gestao proativa e evitando bloqueios inesperados.",
  },
  {
    num: "04",
    titulo: "Registre Treinamentos e Certificacoes",
    subtitulo: "Capacitacao e habilitacao tecnica",
    cor: VERDE,
    paragrafos: [
      'Na aba "Treinamentos" do trabalhador, registre cada capacitacao realizada: NR-10, NR-12, NR-33, NR-35, Integracao SST, NR-06 (EPI) e outros. Informe data de realizacao, carga horaria e validade.',
      'Faca upload do certificado para comprovacao. O sistema controla a validade e alerta quando o treinamento esta proximo de expirar, evitando que o trabalhador atue com habilitacao vencida.',
      'Treinamentos vencidos impactam diretamente o status do trabalhador — um eletricista com NR-10 vencida, por exemplo, sera automaticamente bloqueado ate a regularizacao.',
    ],
    dica: "Exija comprovantes originais dos treinamentos. Certificados sem carga horaria minima ou sem registro de instrutor podem ser invalidados em fiscalizacao.",
  },
  {
    num: "05",
    titulo: "Emita Permissoes de Trabalho Digitais",
    subtitulo: "Autorizacao formal para atividades de risco",
    cor: LARANJA,
    paragrafos: [
      'Na aba "Permissoes de Trabalho", crie uma PT (Permissao de Trabalho) para cada atividade de risco. Selecione o terceiro, o trabalhador, o tipo de atividade e a area de execucao.',
      'A PT deve conter: descricao da atividade, medidas de seguranca, EPIs obrigatorios, periodo de validade e responsavel pela autorizacao. O sistema gera o documento digital com todos os campos.',
      'O fluxo de aprovacao permite que o responsavel de SST revise e aprove a PT antes do inicio do trabalho. PTs vencidas ou nao aprovadas impedem o inicio da atividade.',
    ],
    dica: "A Permissao de Trabalho e obrigatoria para atividades como trabalho em altura (NR-35), espaco confinado (NR-33) e trabalho a quente. Nao permita inicio sem PT aprovada.",
  },
  {
    num: "06",
    titulo: "Monitore o Painel de Vencimentos",
    subtitulo: "Visao consolidada de prazos criticos",
    cor: VERMELHO,
    paragrafos: [
      'A aba "Vencimentos" consolida todos os documentos, treinamentos e certificacoes com datas de validade proximas ou vencidas. Use filtros por status (vencido, a vencer, valido) para priorizar acoes.',
      'O painel exibe alertas visuais: documentos vencidos em vermelho, proximos do vencimento em amarelo e validos em verde. Cada item mostra o terceiro, trabalhador e dias restantes.',
      'Configure notificacoes para receber alertas com antecedencia (30 dias padrao) e garantir tempo habil para solicitar renovacoes e atualizacoes ao terceiro.',
    ],
    dica: "Estabeleca uma rotina semanal de verificacao do painel de vencimentos. Isso evita surpresas em auditorias e garante que nenhum terceiro atue com documentacao irregular.",
  },
  {
    num: "07",
    titulo: "Acompanhe o Dashboard de Compliance",
    subtitulo: "Indicadores gerenciais em tempo real",
    cor: AZUL,
    paragrafos: [
      'O Dashboard do modulo apresenta indicadores consolidados: total de terceiros ativos, trabalhadores por status (liberado, restrito, bloqueado), documentos por situacao e alertas pendentes.',
      'Graficos de evolucao mostram a taxa de conformidade ao longo do tempo. Use esses dados para reunioes de compliance e para demonstrar diligencia em auditorias externas.',
      'O painel identifica automaticamente os terceiros com maior risco documental e os trabalhadores que necessitam de atencao imediata para regularizacao.',
    ],
    dica: "Mantenha uma meta de conformidade acima de 95%. Terceiros com conformidade abaixo de 80% devem ser notificados formalmente para regularizacao sob pena de suspensao.",
  },
  {
    num: "08",
    titulo: "Documentos e Recursos do Modulo",
    subtitulo: "Registros e materiais de referencia",
    cor: AZUL,
    paragrafos: [
      'O Seguramente gera automaticamente todos os registros necessarios para compliance com terceiros: fichas cadastrais, historico documental, permissoes de trabalho e relatorios de conformidade.',
      'Todos os registros possuem timestamp, usuario responsavel e rastreabilidade completa. Isso garante validade juridica e subsidia a defesa em processos trabalhistas.',
      'Baixe este Manual do Modulo em PDF para ter um guia de referencia offline com todos os passos e orientacoes normativas.',
    ],
    dica: "Em caso de acidente com terceirizado, a documentacao completa (PT, ASO, treinamentos, entregas de EPI) e a principal prova de diligencia da empresa contratante.",
  },
];

const FLUXO_LINHAS: { etapa: string; sistema: string; cor: RGB }[] = [
  { etapa: "Cadastrar Terceiro",       sistema: "Auto-preenchimento via CNPJ | Define tipo de acesso e servicos",                     cor: AZUL },
  { etapa: "Cadastrar Trabalhadores",  sistema: "Vincula ao terceiro | Define funcao, atividades e riscos",                            cor: VERDE },
  { etapa: "Enviar Documentos",        sistema: "Upload com controle de validade | Status automatico (valido/a vencer/vencido)",        cor: AZUL },
  { etapa: "Registrar Treinamentos",   sistema: "Controle de validade | Impacta status do trabalhador automaticamente",                cor: VERDE },
  { etapa: "Emitir PT",                sistema: "Permissao de Trabalho digital | Fluxo de aprovacao | Validade controlada",            cor: LARANJA },
  { etapa: "Alerta de Vencimento",     sistema: "Notificacao automatica 30 dias antes | Bloqueio no vencimento",                       cor: VERMELHO },
  { etapa: "Dashboard Compliance",     sistema: "Indicadores de conformidade | Terceiros em risco | Evolucao temporal",                cor: AZUL },
  { etapa: "Auditoria e Exportacao",   sistema: "Relatorios de conformidade | Historico completo rastreavel | Prova juridica",         cor: AZUL },
];

const GLOSSARIO: [string, string][] = [
  ["PGR",           "Programa de Gerenciamento de Riscos. Documento obrigatorio que substitui o antigo PPRA. Exigido de toda empresa com empregados."],
  ["PCMSO",         "Programa de Controle Medico de Saude Ocupacional. Define exames obrigatorios e periodicidade para cada funcao."],
  ["LTCAT",         "Laudo Tecnico das Condicoes Ambientais de Trabalho. Documenta os agentes nocivos presentes no ambiente."],
  ["ASO",           "Atestado de Saude Ocupacional. Documento que atesta aptidao do trabalhador para a funcao."],
  ["CA",            "Certificado de Aprovacao de EPI. Numero emitido pelo MTE que certifica o equipamento para uso."],
  ["PT",            "Permissao de Trabalho. Autorizacao formal para execucao de atividades de risco."],
  ["NR-10",         "Norma sobre seguranca em instalacoes e servicos em eletricidade."],
  ["NR-33",         "Norma sobre seguranca em espacos confinados."],
  ["NR-35",         "Norma sobre trabalho em altura (acima de 2 metros)."],
  ["CNAE",          "Classificacao Nacional de Atividades Economicas. Identifica a atividade principal da empresa."],
  ["Compliance",    "Conformidade com leis, normas e politicas internas. No contexto de terceiros, refere-se ao cumprimento das exigencias de SST."],
];

export function ManualTerceiros() {
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
      doc.text("Terceiros & SST", margin, 76);
      doc.setFontSize(14);
      doc.text("Compliance e Controle de Prestadores de Servico", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(191, 219, 254);
      doc.text("Passo a passo em linguagem simples para", margin, 106);
      doc.text("RH, gestores e responsaveis de SST.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(191, 219, 254);
      doc.text("NR-01  |  NR-06  |  NR-10  |  NR-33  |  NR-35  |  CLT Art. 455", pageW / 2, 133, { align: "center" });

      const etapasCapa = ["Cadastro","Trabalhadores","Documentos","Treinamentos","PT","Vencimentos","Dashboard"];
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
      doc.text("seguramente.app", pageW - margin, pageH - 20, { align: "right" });

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
        ["Passo 01","Cadastre a Empresa Terceirizada","3"],
        ["Passo 02","Cadastre os Trabalhadores","4"],
        ["Passo 03","Gerencie Documentos","5"],
        ["Passo 04","Registre Treinamentos","6"],
        ["Passo 05","Emita Permissoes de Trabalho","7"],
        ["Passo 06","Monitore Vencimentos","8"],
        ["Passo 07","Dashboard de Compliance","9"],
        ["Passo 08","Documentos e Recursos","10"],
        ["---","Fluxo Resumido","11"],
        ["---","Glossario de Termos","12"],
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
        "Este material foi escrito para gestores de RH, tecnicos de SST e responsaveis pelo controle de terceiros. Cada passo explica o que fazer para manter a conformidade documental dos prestadores de servico, desde o cadastro ate a emissao de permissoes de trabalho.",
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
      doc.text("FLUXO RESUMIDO — Terceiros & SST", margin, 18);

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
            `Seguramente - Manual do Usuario | Terceiros & SST | Pagina ${pg}/${totalPages}`,
            pageW / 2, pageH - 8, { align: "center" }
          );
        }
      }

      doc.save("manual-terceiros-sst.pdf");
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
