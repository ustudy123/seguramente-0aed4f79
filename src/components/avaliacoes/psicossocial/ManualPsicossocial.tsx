/**
 * Manual do Usuário — Módulo de Gestão Psicossocial
 * Gerado em PDF via jsPDF com passo a passo em linguagem acessível.
 */
import { useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type RGB = [number, number, number];

// ── Paleta ───────────────────────────────────────────────────────────────────
const ROXO: RGB = [88, 28, 135];
const ROXO_LIGHT: RGB = [233, 213, 255];
const CINZA: RGB = [50, 50, 50];
const MUTED: RGB = [120, 120, 120];
const VERDE: RGB = [16, 185, 129];
const AZUL: RGB = [37, 99, 235];
const LARANJA: RGB = [234, 88, 12];
const VERMELHO: RGB = [220, 38, 38];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function text(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
const WHITE: RGB = [255, 255, 255];

// ── Conteúdo do manual ────────────────────────────────────────────────────────
const PASSOS = [
  {
    num: "01",
    titulo: "Acesse o Módulo Psicossocial",
    subtitulo: "Por onde começar",
    cor: AZUL,
    paragrafos: [
      'No menu lateral do sistema, clique em "Avaliações" e depois em "Psicossocial". Você verá o painel principal com o histórico de campanhas e o Índice Psicossocial Organizacional (IPS) da sua empresa.',
      "Se é a primeira vez que acessa, a tela estará vazia — isso é normal. Todo o processo começa com a criação de uma campanha.",
    ],
    dica: "Dica: O IPS só aparece após a primeira campanha ter pelo menos 5 respostas.",
  },
  {
    num: "02",
    titulo: "Crie uma Nova Campanha",
    subtitulo: "Configurando a avaliação",
    cor: ROXO,
    paragrafos: [
      'Clique no botão "Nova Campanha" no canto superior direito. Um assistente irá aparecer para te ajudar a escolher o instrumento (tipo de questionário) mais adequado para o porte e perfil da sua empresa.',
      "Após escolher o instrumento, preencha as informações básicas: nome da campanha, período de coleta (data de início e fim) e a periodicidade (trimestral, semestral, anual).",
    ],
    dica: "Dica: O instrumento SIPRO é recomendado para a maioria das empresas brasileiras — é validado cientificamente e atende à NR-01.",
  },
  {
    num: "03",
    titulo: "Vincule Setor + Função (Obrigatório — NR-17)",
    subtitulo: "A etapa mais importante",
    cor: VERMELHO,
    paragrafos: [
      "Esta é a etapa exigida pela NR-17. Você precisa informar quais grupos de trabalho serão avaliados. Não são os nomes das pessoas — são as combinações de Setor e Função.",
      'Exemplo: "Producao + Operador de Maquinas" e "Comercial + Consultor de Vendas". Cada par representa uma situacao de trabalho que sera analisada separadamente.',
      "Use os campos com autocomplete: ao clicar em Setor, o sistema ja sugere os departamentos cadastrados. O mesmo acontece com Funcao. Voce pode escolher da lista ou digitar um novo.",
    ],
    dica: "Atencao: Sem pelo menos um par Setor+Funcao, a campanha nao pode ser criada. Isso garante que os riscos identificados sejam rastreaveis no GRO.",
  },
  {
    num: "04",
    titulo: "Envie os Questionários",
    subtitulo: "Como os colaboradores respondem",
    cor: VERDE,
    paragrafos: [
      "Após criar a campanha, o sistema gera um link de acesso. Você pode enviar esse link por WhatsApp, e-mail ou qualquer outro canal da empresa.",
      "Cada colaborador acessa o link, confirma sua identidade via código WhatsApp (apenas para garantir que cada pessoa responde uma vez) e preenche o questionário. Nenhum dado de identidade é armazenado junto às respostas.",
      "O colaborador não precisa ter login no sistema. O link funciona em qualquer celular ou computador.",
    ],
    dica: "Seguranca: O nome, CPF e telefone do colaborador nunca sao vinculados as respostas. O sistema usa apenas um codigo hash anonimo.",
  },
  {
    num: "05",
    titulo: "Acompanhe as Respostas em Tempo Real",
    subtitulo: "Monitorando a participação",
    cor: AZUL,
    paragrafos: [
      "Durante o período da campanha, você pode ver quantas pessoas já responderam na tela da campanha ativa. Aparece a taxa de participação e o prazo restante.",
      "Os resultados só ficam disponíveis após o encerramento da campanha E com no mínimo 5 respondentes. Isso protege o anonimato.",
    ],
    dica: "Dica: Uma taxa de participacao acima de 60% garante resultados mais representativos e confiaveis estatisticamente.",
  },
  {
    num: "06",
    titulo: "Encerre a Campanha e Veja os Resultados",
    subtitulo: "Analisando o diagnóstico",
    cor: ROXO,
    paragrafos: [
      "Ao final do prazo, ou manualmente, encerre a campanha. O sistema calcula automaticamente o IPS (Índice Psicossocial) de 0 a 100 e classifica cada dimensão avaliada.",
      "Você verá gráficos radar com os pontos fortes e áreas de atenção, separados por Setor+Função (se houver respostas suficientes em cada grupo).",
      "A IA do sistema também gera uma análise interpretativa em texto, explicando os resultados em linguagem acessível e sugerindo as próximas ações.",
    ],
    dica: 'Dica: Clique em "Exportar Relatorio PDF" para gerar um documento formal que pode ser arquivado no PGR da empresa.',
  },
  {
    num: "07",
    titulo: "Riscos são Exportados para o GRO Automaticamente",
    subtitulo: "Integração com o inventário de riscos",
    cor: LARANJA,
    paragrafos: [
      "Dimensões com score de risco identificado (acima de 35 pontos) são exportadas automaticamente para o GRO — Gerenciamento de Riscos Ocupacionais.",
      'Cada risco no GRO fica associado ao Setor+Função. Por exemplo: "Demanda Cognitiva Alta — Operador de Maquinas (Producao)".',
      "Riscos de nível Alto ou Crítico geram automaticamente um Plano de Ação 5W2H com prazo definido, conforme exigido pela NR-01.",
    ],
    dica: "Importante: Riscos Criticos ou Altos no GRO nao podem ser arquivados sem ter um plano de acao vinculado. Isso garante a conformidade legal.",
  },
  {
    num: "08",
    titulo: "Regra do Anonimato — Empresas Pequenas",
    subtitulo: "Como o sistema protege colaboradores",
    cor: VERDE,
    paragrafos: [
      "Se um grupo de trabalho tiver menos de 5 respondentes, o sistema não exibe resultados individuais para esse grupo. Isso evita que alguém seja identificado pelas suas respostas.",
      "Nesses casos, o sistema agrupa os dados automaticamente: primeiro tenta mostrar por Setor; se ainda não chega a 5, mostra o resultado geral da empresa.",
      "Para empresas com menos de 20 funcionários, recomenda-se não segmentar por Função — use apenas o nível Setor ou empresa inteira para garantir que os resultados apareçam.",
    ],
    dica: "Conformidade: Esta regra segue a ISO 45003 e o COPSOQ III, padroes internacionais para avaliacao psicossocial com privacidade garantida.",
  },
];

const GLOSSARIO: [string, string][] = [
  ["IPS", "Indice Psicossocial Organizacional. Score de 0 a 100 que indica a saude psicossocial geral da empresa. Quanto maior, melhor."],
  ["GRO", "Gerenciamento de Riscos Ocupacionais. Inventario de todos os riscos identificados, exigido pela NR-01."],
  ["NR-01", "Norma Regulamentadora 1 — obriga as empresas a identificar, avaliar e controlar riscos ocupacionais."],
  ["NR-17", "Norma Regulamentadora 17 — foca em ergonomia e condicoes de trabalho, exigindo avaliacao das situacoes de trabalho."],
  ["ISO 45003", "Norma internacional sobre gestao de saude psicologica no trabalho."],
  ["5W2H", "Modelo de plano de acao: O que, Por que, Onde, Quando, Quem, Como, Quanto custa."],
  ["Situacao de Trabalho", "Combinacao de Setor + Funcao que representa um grupo de colaboradores a ser avaliado."],
  ["Campanha Regular", "Avaliacao periodica programada (trimestral, semestral ou anual)."],
  ["Campanha Extraordinaria", "Avaliacao urgente disparada por um evento critico como acidente ou reestruturacao."],
  ["SIPRO", "Instrumento de avaliacao psicossocial validado para o contexto brasileiro. Recomendado pela plataforma."],
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
          `Seguramente — Manual do Usuario | Modulo Psicossocial | Pagina ${pageNum}/${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      // ── CAPA ──────────────────────────────────────────────────────────────
      fill(doc, ROXO);
      doc.rect(0, 0, pageW, pageH, "F");

      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text("MANUAL DO USUARIO", margin, 70);
      doc.setFontSize(22);
      doc.text("Modulo de Gestao", margin, 84);
      doc.text("Psicossocial", margin, 96);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(233, 213, 255);
      doc.text("Passo a passo em linguagem simples para", margin, 112);
      doc.text("RH, gestores e responsaveis de SST.", margin, 120);

      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 130, pageW - margin, 130);

      doc.setFontSize(9);
      doc.setTextColor(216, 180, 254);
      doc.text("NR-01  |  NR-17  |  ISO 45001  |  ISO 45003  |  COPSOQ III  |  LGPD", pageW / 2, 140, { align: "center" });

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
      doc.text("SUMARIO", margin, 18);
      text(doc, CINZA);

      y = 40;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const itens = [
        ["Passo 01", "Acesse o Modulo Psicossocial", "3"],
        ["Passo 02", "Crie uma Nova Campanha", "4"],
        ["Passo 03", "Vincule Setor + Funcao (Obrigatorio - NR-17)", "5"],
        ["Passo 04", "Envie os Questionarios", "6"],
        ["Passo 05", "Acompanhe as Respostas em Tempo Real", "7"],
        ["Passo 06", "Encerre a Campanha e Veja os Resultados", "8"],
        ["Passo 07", "Riscos Exportados para o GRO Automaticamente", "9"],
        ["Passo 08", "Regra do Anonimato - Empresas Pequenas", "10"],
        ["—", "Glossario de Termos", "11"],
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
        doc.text(`pag. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;

      fill(doc, ROXO_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 28, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(doc, ROXO);
      doc.text("Para quem e este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      text(doc, CINZA);
      const introText = doc.splitTextToSize(
        "Este material foi escrito para gestores de RH, responsaveis de SST e lideres de equipe que precisam usar o modulo psicossocial do sistema Seguramente sem conhecimento tecnico previo. Cada passo explica exatamente o que fazer e o que acontece nos bastidores do sistema.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introText.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 14 + i * 5);
      });

      // ── PASSOS ────────────────────────────────────────────────────────────
      PASSOS.forEach((passo) => {
        addPage();
        y = margin + 4;

        fill(doc, passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        text(doc, WHITE);
        doc.text(passo.titulo, margin + 4, y + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(220, 220, 255);
        doc.text(passo.subtitulo, margin + 4, y + 17);

        // Número grande decorativo
        doc.setFontSize(36);
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
        const dicaH = dicaLinhas.length * 5 + 10;
        doc.setFillColor(248, 245, 255);
        stroke(doc, passo.cor);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, pageW - 2 * margin, dicaH, 2, 2, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        text(doc, CINZA);
        dicaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 6, y + 7 + li * 5);
        });
        y += dicaH + 6;
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
        { etapa: "Criar campanha", sistema: "Gera link unico de participacao e configura questionario", cor: AZUL },
        { etapa: "Vincular Setor+Funcao", sistema: "Registra as situacoes de trabalho obrigatorias (NR-17)", cor: ROXO },
        { etapa: "Colaborador responde", sistema: "Verifica unicidade via WhatsApp | Armazena hash anonimo | Descarta identidade", cor: VERDE },
        { etapa: "< 5 respostas no grupo", sistema: "Agrupa dados: Funcao > Setor > Empresa (protecao de anonimato)", cor: LARANJA },
        { etapa: "Encerrar campanha", sistema: "Calcula IPS | Gera radar dimensional | IA interpreta resultados", cor: ROXO },
        { etapa: "Risco identificado", sistema: "Exporta para GRO com Setor+Funcao vinculados automaticamente", cor: VERMELHO },
        { etapa: "Risco Critico ou Alto", sistema: "Gera Plano de Acao 5W2H com prazo | Bloqueia arquivamento sem acao", cor: VERMELHO },
      ];

      fluxo.forEach((f, i) => {
        checkY(14);
        if (i % 2 === 0) {
          doc.setFillColor(248, 248, 255);
          doc.rect(margin, y - 3, pageW - 2 * margin, 13, "F");
        }
        fill(doc, f.cor);
        doc.roundedRect(margin, y - 1, 3, 8, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        text(doc, f.cor);
        doc.text(f.etapa, margin + 6, y + 4);
        doc.setFont("helvetica", "normal");
        text(doc, MUTED);
        doc.text("->", margin + 56, y + 4);
        text(doc, CINZA);
        const sysLinhas = doc.splitTextToSize(f.sistema, pageW - 2 * margin - 66);
        sysLinhas.forEach((l: string, li: number) => doc.text(l, margin + 63, y + 4 + li * 4.5));
        y += 14;
      });

      // ── GLOSSÁRIO ─────────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      fill(doc, ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      text(doc, WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("GLOSSARIO DE TERMOS", margin, margin + 11);
      y = margin + 24;

      GLOSSARIO.forEach(([termo, def], i) => {
        const defLinhas = doc.splitTextToSize(def, pageW - 2 * margin - 38);
        const linhaH = defLinhas.length * 4.8 + 8;
        checkY(linhaH);

        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, y, pageW - 2 * margin, linhaH, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        text(doc, ROXO);
        doc.text(termo, margin + 3, y + 6);
        doc.setFont("helvetica", "normal");
        text(doc, CINZA);
        defLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 38, y + 6 + li * 4.8);
        });
        y += linhaH;
      });

      // ── RODAPÉS ───────────────────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        rodape(i - 1, totalPages - 1);
      }

      doc.save(`Manual_Psicossocial_Seguramente_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("Manual gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o manual.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={gerarPDF} disabled={gerando}>
      {gerando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando Manual...</>
      ) : (
        <><BookOpen className="h-4 w-4" /> Manual do Usuário (PDF)</>
      )}
    </Button>
  );
}
