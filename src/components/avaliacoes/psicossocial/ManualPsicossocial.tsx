/**
 * Manual do Usuário — Módulo de Gestão Psicossocial
 * Gerado em PDF via jsPDF. Reescrito com base no manual GRO/PGR revisado.
 */
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RGB = [number, number, number];

const ROXO: RGB = [88, 28, 135];
const ROXO_LIGHT: RGB = [233, 213, 255];
const CINZA: RGB = [50, 50, 50];
const MUTED: RGB = [120, 120, 120];
const VERDE: RGB = [16, 185, 129];
const AZUL: RGB = [37, 99, 235];
const LARANJA: RGB = [234, 88, 12];
const VERMELHO: RGB = [220, 38, 38];
const AMBER: RGB = [180, 120, 0];
const WHITE: RGB = [255, 255, 255];

function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }

const PASSOS = [
  {
    num: "01",
    titulo: "Crie uma Campanha de Avaliação",
    subtitulo: "O ponto de partida",
    cor: ROXO,
    paragrafos: [
      'Acesse o menu lateral → "Avaliações" → "Psicossocial". Clique no botão "Nova Campanha" no canto superior direito da tela.',
      'O Assistente de Seleção irá aparecer para recomendar o instrumento mais adequado. Para a maioria das empresas, o SIPRO é o instrumento correto — ele é validado cientificamente para o contexto brasileiro e atende à NR-01.',
      'Preencha o nome da campanha e defina o período de coleta (data de início e fim). Você pode criar campanhas regulares (trimestrais, semestrais ou anuais) ou campanhas extraordinárias para situações urgentes.',
    ],
    dica: "Dica: Campanhas trimestrais constroem um histórico robusto e permitem medir o impacto das ações ao longo do tempo.",
  },
  {
    num: "02",
    titulo: "Vincule Setor + Função (Obrigatório — NR-17)",
    subtitulo: "Etapa exigida por lei",
    cor: VERMELHO,
    paragrafos: [
      'Esta é a etapa mais importante do processo. Você precisa informar quais grupos de trabalho serão avaliados. Não são os nomes das pessoas — são as combinações de Setor e Função.',
      'Exemplos: "Produção + Operador de Máquinas", "Comercial + Consultor de Vendas". Cada par representa uma situação de trabalho que será analisada separadamente.',
      'Use os campos com autocomplete — o sistema já sugere os setores e funções cadastrados. Você pode selecionar da lista ou digitar um novo. Adicione quantos pares precisar.',
    ],
    dica: "Atenção: Sem pelo menos um par Setor+Função, a campanha não pode ser criada. Isso garante que os riscos identificados sejam rastreáveis no GRO e no PGR.",
  },
  {
    num: "03",
    titulo: "Distribua para os Colaboradores",
    subtitulo: "Como as pessoas respondem",
    cor: AZUL,
    paragrafos: [
      'Após ativar a campanha, o sistema gera um link único de participação. Acesse a campanha e clique em "Distribuir" para ver o link, QR Code e modelos de mensagem prontos.',
      'Envie o link por WhatsApp, e-mail ou imprima o QR Code para fixar nos murais. O colaborador não precisa ter login no sistema.',
      'Ao acessar o link, o colaborador passa por uma verificação via código WhatsApp (apenas para garantir que cada pessoa responde uma vez). Após a verificação, o código é descartado — a identidade nunca é vinculada às respostas.',
    ],
    dica: "Segurança: Nome, CPF e telefone nunca são armazenados junto às respostas. O sistema usa apenas um código hash anônimo que não permite rastrear a identidade.",
  },
  {
    num: "04",
    titulo: "Regra do Anonimato",
    subtitulo: "Como o sistema protege os colaboradores",
    cor: VERDE,
    paragrafos: [
      'O sistema aplica automaticamente a regra de confidencialidade: resultados só são exibidos quando o grupo tem no mínimo 5 respondentes. Isso impede que qualquer pessoa seja identificada pelas respostas.',
      'Quando um grupo tem menos de 5 respondentes, os dados são agrupados automaticamente: primeiro tenta mostrar por Setor; se ainda não atinge o mínimo, exibe o resultado geral da empresa.',
      'Para empresas com menos de 20 funcionários, recomenda-se não segmentar por Função — use apenas o nível Setor ou empresa inteira para garantir que os resultados apareçam.',
    ],
    dica: "Conformidade: Esta regra segue a ISO 45003 e o COPSOQ III. Se não for possível garantir anonimato, o sistema exibe: 'Dados insuficientes para garantir confidencialidade'.",
  },
  {
    num: "05",
    titulo: "Encerre e Veja os Resultados",
    subtitulo: "O diagnóstico automático",
    cor: ROXO,
    paragrafos: [
      'Ao final do prazo (ou manualmente), encerre a campanha. O sistema calcula automaticamente o IPS (Índice Psicossocial) de 0 a 100 e classifica cada dimensão avaliada.',
      'Você verá gráficos radar com os pontos fortes e áreas de atenção. O sistema também gera uma análise interpretativa em texto simples, explicando o que os números significam na prática.',
      'O IPS é classificado em: 0–49 (Risco), 50–64 (Atenção), 65–79 (Estável), 80–100 (Saudável). Clique em "Ver Resultados" na campanha encerrada para acessar o diagnóstico completo.',
    ],
    dica: "Dica: Clique em 'Exportar Relatório PDF' para gerar um documento formal que pode ser arquivado no PGR da empresa.",
  },
  {
    num: "06",
    titulo: "Riscos Vão para o GRO Automaticamente",
    subtitulo: "Integração com o inventário de riscos (PGR)",
    cor: LARANJA,
    paragrafos: [
      'Ao encerrar a campanha, todos os fatores de risco identificados são exportados automaticamente para o GRO — o Inventário de Riscos Ocupacionais exigido pelo PGR (NR-01).',
      'Cada risco fica vinculado ao Setor + Função correspondente. Por exemplo: "Sobrecarga de Trabalho — Operador de Máquinas (Produção)".',
      'Riscos classificados como Alto (score 51–74) ou Crítico (score 75–100) geram automaticamente um Plano de Ação 5W2H com prazo definido: 30 dias para Crítico, 60 dias para Alto.',
    ],
    dica: "Importante: Não é possível arquivar ou encerrar um risco Alto ou Crítico sem ter um plano de ação vinculado. Isso garante conformidade contínua com a NR-01.",
  },
  {
    num: "07",
    titulo: "Quando o Sistema Recomenda a AET",
    subtitulo: "Análise Ergonômica do Trabalho (NR-17)",
    cor: AMBER,
    paragrafos: [
      'Quando o sistema identifica situações críticas — IPS abaixo de 65, riscos recorrentes ou múltiplos fatores simultâneos — ele recomenda a realização de uma AET (Análise Ergonômica do Trabalho).',
      'A recomendação aparece automaticamente na tela de resultados da campanha. IPS abaixo de 50 ou múltiplos fatores críticos geram uma indicação de AET obrigatória, conforme exige a NR-17.',
      'Os dados psicossociais alimentam a Avaliação Ergonômica Preliminar (AEP) do módulo de Ergonomia. O psicossocial não é isolado — ele integra a ergonomia e contribui para a análise da organização do trabalho.',
    ],
    dica: "Acesse o módulo de Ergonomia para iniciar a AET. Os dados da campanha psicossocial já estarão disponíveis como insumo para a análise.",
  },
  {
    num: "08",
    titulo: "Monitore e Reaprecie os Riscos",
    subtitulo: "O ciclo não termina na primeira campanha",
    cor: VERDE,
    paragrafos: [
      'Após executar as ações do plano, o sistema exige que os riscos sejam reavaliados. Isso garante que as intervenções foram eficazes e que o ciclo GRO está completo.',
      'O Histórico IPS mostra a evolução do índice ao longo das campanhas, permitindo identificar tendências e medir o impacto das ações. Compare resultados antes e depois de intervenções.',
      'O Inventário PGR consolida os dados de todas as campanhas encerradas em um único relatório auditável, com médias ponderadas pelo número de respondentes. Exporte para PDF para auditoria da NR-01.',
    ],
    dica: "Recomendação: Realize campanhas pelo menos a cada 6 meses. A NR-01 exige atualização periódica do PGR sempre que houver mudanças organizacionais significativas.",
  },
];

const GLOSSARIO: [string, string][] = [
  ["IPS", "Índice Psicossocial Organizacional. Score de 0 a 100 que indica a saúde psicossocial geral da empresa. Quanto maior, melhor."],
  ["GRO", "Gerenciamento de Riscos Ocupacionais. Inventário de todos os riscos identificados, exigido pela NR-01."],
  ["PGR", "Programa de Gerenciamento de Riscos. Documento obrigatório que inclui o inventário de riscos e o plano de ação."],
  ["NR-01", "Norma Regulamentadora 1 — obriga as empresas a identificar, avaliar e controlar riscos ocupacionais, incluindo psicossociais."],
  ["NR-17", "Norma Regulamentadora 17 — foca em ergonomia e condições de trabalho, exigindo avaliação das situações de trabalho."],
  ["ISO 45003", "Norma internacional sobre gestão de saúde psicológica no trabalho."],
  ["AET", "Análise Ergonômica do Trabalho. Estudo aprofundado de situações de trabalho críticas, exigido pela NR-17."],
  ["5W2H", "Modelo de plano de ação: O que, Por que, Onde, Quando, Quem, Como, Quanto custa."],
  ["Situação de Trabalho", "Combinação de Setor + Função que representa um grupo de colaboradores a ser avaliado."],
  ["SIPRO", "Instrumento de avaliação psicossocial validado para o contexto brasileiro. Recomendado pelo sistema."],
  ["Campanha Regular", "Avaliação periódica programada (trimestral, semestral ou anual)."],
  ["Campanha Extraordinária", "Avaliação urgente disparada por um evento crítico como acidente ou reestruturação."],
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

      const addPage = () => {
        doc.addPage();
        y = margin;
        stroke(doc, ROXO);
        doc.setLineWidth(0.3);
        doc.line(margin, 10, pageW - margin, 10);
      };

      const checkY = (needed = 20) => {
        if (y + needed > pageH - 16) addPage();
      };

      const rodape = (pageNum: number, total: number) => {
        doc.setFontSize(7);
        text(doc, MUTED);
        doc.text(
          `Seguramente — Manual do Usuário | Gestão Psicossocial | Página ${pageNum}/${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      // ── CAPA ──────────────────────────────────────────────────────────────
      fill(doc, ROXO);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.text("MANUAL DO USUÁRIO", margin, 62);
      doc.setFontSize(20);
      doc.text("Gestão de Riscos Psicossociais", margin, 76);
      doc.setFontSize(14);
      doc.text("GRO / PGR — NR-01", margin, 88);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(233, 213, 255);
      doc.text("Passo a passo em linguagem simples para", margin, 106);
      doc.text("RH, gestores e responsáveis de SST.", margin, 114);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 124, pageW - margin, 124);

      doc.setFontSize(8.5);
      doc.setTextColor(216, 180, 254);
      doc.text("NR-01  |  NR-17  |  ISO 45001  |  ISO 45003  |  LGPD", pageW / 2, 133, { align: "center" });

      // Fluxo resumido na capa
      const etapas = ["Coleta", "Vínculo", "Identificação", "Avaliação", "Inventário", "Ação", "Monitoramento"];
      const boxW = (pageW - 2 * margin) / etapas.length;
      const boxY = 148;
      etapas.forEach((etapa, i) => {
        const bx = margin + i * boxW;
        doc.setFillColor(120, 40, 180);
        doc.roundedRect(bx + 1, boxY, boxW - 2, 14, 1, 1, "F");
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text(etapa, bx + boxW / 2, boxY + 9, { align: "center" });
        if (i < etapas.length - 1) {
          doc.setTextColor(200, 180, 255);
          doc.setFontSize(8);
          doc.text("→", bx + boxW - 1.5, boxY + 9, { align: "center" });
        }
      });

      doc.setFontSize(8);
      doc.setTextColor(196, 181, 253);
      doc.text(
        `Emitido em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
        margin, pageH - 20
      );
      doc.text("seguramente.app", pageW - margin, pageH - 20, { align: "right" });

      // ── SUMÁRIO ───────────────────────────────────────────────────────────
      doc.addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, 0, pageW, 28, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMÁRIO", margin, 18);
      text(doc, CINZA);

      y = 40;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const itens = [
        ["Passo 01", "Crie uma Campanha de Avaliação", "3"],
        ["Passo 02", "Vincule Setor + Função (Obrigatório — NR-17)", "4"],
        ["Passo 03", "Distribua para os Colaboradores", "5"],
        ["Passo 04", "Regra do Anonimato", "6"],
        ["Passo 05", "Encerre e Veja os Resultados", "7"],
        ["Passo 06", "Riscos Vão para o GRO Automaticamente", "8"],
        ["Passo 07", "Quando o Sistema Recomenda a AET", "9"],
        ["Passo 08", "Monitore e Reaprecie os Riscos", "10"],
        ["—", "Fluxo Resumido", "11"],
        ["—", "Glossário de Termos", "12"],
      ];

      itens.forEach(([num, titulo, pag], i) => {
        const bgY = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, bgY, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        text(doc, ROXO);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        doc.text(titulo, margin + 28, y + 1);
        text(doc, MUTED);
        doc.text(`pág. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;

      fill(doc, ROXO_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 32, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, ROXO);
      doc.text("Para quem é este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introText = doc.splitTextToSize(
        "Este material foi escrito para gestores de RH, responsáveis de SST e líderes de equipe. Você não precisa ter conhecimento técnico — cada passo explica exatamente o que fazer e o que acontece automaticamente nos bastidores. O sistema cuida das análises; você cuida das decisões.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introText.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 14 + i * 5);
      });

      // ── PASSOS ────────────────────────────────────────────────────────────
      PASSOS.forEach((passo, passoIdx) => {
        addPage();
        y = margin + 4;

        fill(doc, passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        text(doc, WHITE);
        doc.text(passo.titulo, margin + 4, y + 9);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(220, 220, 255);
        doc.text(passo.subtitulo, margin + 4, y + 17);

        doc.setFontSize(34);
        doc.setTextColor(255, 255, 255);
        doc.text(passo.num, pageW - margin - 4, y + 18, { align: "right" });

        y += 30;
        text(doc, CINZA);

        passo.paragrafos.forEach((para) => {
          checkY(18);
          fill(doc, passo.cor);
          doc.circle(margin + 2, y + 1.5, 1.5, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          text(doc, CINZA);
          const linhas = doc.splitTextToSize(para, pageW - 2 * margin - 10);
          linhas.forEach((l: string, li: number) => {
            checkY(6);
            doc.text(l, margin + 7, y + li * 5.5);
          });
          y += linhas.length * 5.5 + 6;
        });

        y += 4;
        checkY(20);

        const dicaLinhas = doc.splitTextToSize(passo.dica, pageW - 2 * margin - 12);
        const dicaH = dicaLinhas.length * 5 + 12;
        doc.setFillColor(255, 251, 235);
        stroke(doc, AMBER);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, pageW - 2 * margin, dicaH, 2, 2, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(180, 120, 0);
        doc.text("💡 ", margin + 3, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        text(doc, CINZA);
        dicaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 8, y + 8 + li * 5);
        });
        y += dicaH + 6;

        rodape(passoIdx + 3, PASSOS.length + 4);
      });

      // ── FLUXO RESUMIDO ────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("FLUXO RESUMIDO — O QUE ACONTECE EM CADA ETAPA", margin, margin + 11);
      y = margin + 24;
      text(doc, CINZA);

      const fluxo = [
        { etapa: "Criar campanha", sistema: "Gera link único de participação e configura o questionário selecionado", cor: AZUL },
        { etapa: "Vincular Setor+Função", sistema: "Registra as situações de trabalho obrigatórias (NR-17) para rastreabilidade", cor: ROXO },
        { etapa: "Colaborador responde", sistema: "Verificação via WhatsApp (unicidade) → armazena hash anônimo → descarta identidade", cor: VERDE },
        { etapa: "< 5 respostas no grupo", sistema: "Agrupa dados automaticamente: Função → Setor → Empresa (proteção de anonimato ISO 45003)", cor: LARANJA },
        { etapa: "Encerrar campanha", sistema: "Calcula IPS | Gera radar dimensional | Identifica fatores de risco | Interpretação automática", cor: ROXO },
        { etapa: "Risco identificado", sistema: "Exporta para GRO com Setor+Função vinculados | Registra no inventário do PGR", cor: VERMELHO },
        { etapa: "Risco Alto ou Crítico", sistema: "Gera Plano de Ação 5W2H automático | Prazo: 30d (Crítico) ou 60d (Alto) | Bloqueia arquivamento sem ação", cor: VERMELHO },
        { etapa: "IPS < 65 ou múltiplos críticos", sistema: "Sistema recomenda ou exige AET (NR-17) | Dados alimentam a AEP do módulo de Ergonomia", cor: AMBER },
        { etapa: "Após execução das ações", sistema: "Sistema exige reavaliação dos riscos | Atualiza histórico IPS | Mantém PGR atualizado", cor: VERDE },
      ];

      fluxo.forEach((f, i) => {
        checkY(14);
        if (i % 2 === 0) {
          doc.setFillColor(248, 248, 255);
          doc.rect(margin, y - 3, pageW - 2 * margin, 14, "F");
        }
        fill(doc, f.cor);
        doc.roundedRect(margin, y - 1, 3, 8, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        text(doc, f.cor);
        doc.text(f.etapa, margin + 6, y + 4);
        doc.setFont("helvetica", "normal");
        text(doc, MUTED);
        doc.text("→", margin + 57, y + 4);
        text(doc, CINZA);
        const sysLinhas = doc.splitTextToSize(f.sistema, pageW - 2 * margin - 67);
        sysLinhas.forEach((l: string, li: number) => doc.text(l, margin + 63, y + 4 + li * 4.5));
        y += 14 + (sysLinhas.length > 1 ? (sysLinhas.length - 1) * 4.5 : 0);
      });

      rodape(PASSOS.length + 3, PASSOS.length + 4);

      // ── GLOSSÁRIO ─────────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("GLOSSÁRIO DE TERMOS", margin, margin + 11);
      y = margin + 24;

      GLOSSARIO.forEach(([termo, def], i) => {
        const defLinhas = doc.splitTextToSize(def, pageW - 2 * margin - 32);
        const itemH = defLinhas.length * 4.8 + 8;
        checkY(itemH);

        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, y - 2, pageW - 2 * margin, itemH, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        text(doc, ROXO);
        doc.text(termo, margin + 3, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        text(doc, CINZA);
        defLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 32, y + 4 + li * 4.8);
        });
        y += itemH;
      });

      rodape(PASSOS.length + 4, PASSOS.length + 4);

      doc.save(`Manual_Psicossocial_Seguramente_${format(new Date(), "yyyy-MM-dd")}.pdf`);
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
