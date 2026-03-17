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

// ── Paleta ───────────────────────────────────────────────────────────────────
const ROXO: [number, number, number] = [88, 28, 135];
const ROXO_LIGHT: [number, number, number] = [233, 213, 255];
const CINZA: [number, number, number] = [50, 50, 50];
const MUTED: [number, number, number] = [100, 100, 100];
const VERDE: [number, number, number] = [16, 185, 129];
const AZUL: [number, number, number] = [37, 99, 235];
const LARANJA: [number, number, number] = [234, 88, 12];
const VERMELHO: [number, number, number] = [220, 38, 38];

// ── Conteúdo do manual ────────────────────────────────────────────────────────
const PASSOS = [
  {
    num: "01",
    titulo: "Acesse o Módulo Psicossocial",
    subtitulo: "Por onde começar",
    cor: AZUL,
    paragrafos: [
      "No menu lateral do sistema, clique em "Avaliações" e depois em "Psicossocial". Você verá o painel principal com o histórico de campanhas e o Índice Psicossocial Organizacional (IPS) da sua empresa.",
      "Se é a primeira vez que acessa, a tela estará vazia — isso é normal. Todo o processo começa com a criação de uma campanha.",
    ],
    dica: "💡 Dica: O IPS só aparece após a primeira campanha ter pelo menos 5 respostas.",
  },
  {
    num: "02",
    titulo: "Crie uma Nova Campanha",
    subtitulo: "Configurando a avaliação",
    cor: ROXO,
    paragrafos: [
      "Clique no botão "Nova Campanha" no canto superior direito. Um assistente irá aparecer para te ajudar a escolher o instrumento (tipo de questionário) mais adequado para o porte e perfil da sua empresa.",
      "Após escolher o instrumento, preencha as informações básicas: nome da campanha, período de coleta (data de início e fim) e a periodicidade (trimestral, semestral, anual).",
    ],
    dica: "💡 Dica: O instrumento SIPRO é recomendado para a maioria das empresas brasileiras — é validado cientificamente e atende à NR-01.",
  },
  {
    num: "03",
    titulo: "Vincule Setor + Função (Obrigatório — NR-17)",
    subtitulo: "A etapa mais importante",
    cor: VERMELHO,
    paragrafos: [
      "Esta é a etapa exigida pela NR-17. Você precisa informar quais grupos de trabalho serão avaliados. Não são os nomes das pessoas — são as combinações de Setor e Função.",
      "Exemplo: "Produção + Operador de Máquinas" e "Comercial + Consultor de Vendas". Cada par representa uma situação de trabalho que será analisada separadamente.",
      "Use os campos com autocomplete: ao clicar em "Setor", o sistema já sugere os departamentos cadastrados. O mesmo acontece com "Função". Você pode escolher da lista ou digitar um novo.",
    ],
    dica: "⚠️ Atenção: Sem pelo menos um par Setor+Função, a campanha não pode ser criada. Isso garante que os riscos identificados sejam rastreáveis no GRO.",
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
    dica: "🔒 Segurança: O nome, CPF e telefone do colaborador nunca são vinculados às respostas. O sistema usa apenas um código hash anônimo.",
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
    dica: "💡 Dica: Uma taxa de participação acima de 60% garante resultados mais representativos e confiáveis estatisticamente.",
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
    dica: "💡 Dica: Clique em "Exportar Relatório PDF" para gerar um documento formal que pode ser arquivado no PGR da empresa.",
  },
  {
    num: "07",
    titulo: "Os Riscos São Exportados para o GRO Automaticamente",
    subtitulo: "Integração com o inventário de riscos",
    cor: LARANJA,
    paragrafos: [
      "Dimensões com score de risco identificado (acima de 35 pontos de risco) são exportadas automaticamente para o GRO — Gerenciamento de Riscos Ocupacionais.",
      "Cada risco no GRO fica associado ao Setor+Função que você vinculou na campanha. Por exemplo: "Demanda Cognitiva Alta — Operador de Máquinas (Produção)".",
      "Riscos de nível Alto ou Crítico geram automaticamente um Plano de Ação 5W2H com prazo definido, conforme exigido pela NR-01.",
    ],
    dica: "⚠️ Importante: Riscos Críticos ou Altos no GRO não podem ser arquivados sem ter um plano de ação vinculado. Isso garante a conformidade legal.",
  },
  {
    num: "08",
    titulo: "Regra do Anonimato — Empresas Pequenas",
    subtitulo: "Como o sistema protege colaboradores",
    cor: VERDE,
    paragrafos: [
      "Se um grupo de trabalho tiver menos de 5 respondentes, o sistema não exibe resultados individuais para esse grupo. Isso evita que alguém seja identificado pelas suas respostas.",
      "Nesses casos, o sistema agrupa os dados automaticamente: primeiro tenta mostrar por Setor; se ainda não chega a 5, mostra o resultado geral da empresa.",
      "Para empresas com menos de 20 funcionários, recomenda-se não segmentar por Função — use apenas o nível Setor ou empresa para garantir que os resultados apareçam.",
    ],
    dica: "🔒 Conformidade: Esta regra segue a ISO 45003 e o COPSOQ III, padrões internacionais para avaliação psicossocial com privacidade garantida.",
  },
];

const GLOSSARIO = [
  ["IPS", "Índice Psicossocial Organizacional. Score de 0 a 100 que indica a saúde psicossocial geral da empresa. Quanto maior, melhor."],
  ["GRO", "Gerenciamento de Riscos Ocupacionais. Inventário de todos os riscos identificados, exigido pela NR-01."],
  ["NR-01", "Norma Regulamentadora 1 — obriga as empresas a identificar, avaliar e controlar riscos ocupacionais."],
  ["NR-17", "Norma Regulamentadora 17 — foca em ergonomia e condições de trabalho, exigindo avaliação das situações de trabalho."],
  ["ISO 45003", "Norma internacional sobre gestão de saúde psicológica no trabalho."],
  ["5W2H", "Modelo de plano de ação: O quê, Por quê, Onde, Quando, Quem, Como, Quanto custa."],
  ["Situação de Trabalho", "Combinação de Setor + Função que representa um grupo de colaboradores a ser avaliado."],
  ["Campanha Regular", "Avaliação periódica programada (trimestral, semestral ou anual)."],
  ["Campanha Extraordinária", "Avaliação urgente disparada por um evento crítico como acidente ou reestruturação."],
  ["SIPRO", "Instrumento de avaliação psicossocial validado para o contexto brasileiro. Recomendado pela plataforma."],
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
        // linha topo
        doc.setDrawColor(...ROXO);
        doc.setLineWidth(0.3);
        doc.line(margin, 10, pageW - margin, 10);
      };

      const checkY = (needed = 20) => {
        if (y + needed > pageH - 16) addPage();
      };

      const rodape = (pageNum: number, total: number) => {
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(
          `Seguramente — Manual do Usuário · Módulo Psicossocial · Página ${pageNum}/${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
      };

      // ── CAPA ──────────────────────────────────────────────────────────────
      // Fundo roxo capa
      doc.setFillColor(...ROXO);
      doc.rect(0, 0, pageW, pageH, "F");

      // Ornamento circular
      doc.setFillColor(255, 255, 255, 0.05);
      doc.circle(pageW - 30, 40, 60, "F");
      doc.circle(20, pageH - 30, 45, "F");

      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text("MANUAL DO USUÁRIO", margin, 70);
      doc.setFontSize(22);
      doc.text("Módulo de Gestão", margin, 84);
      doc.text("Psicossocial", margin, 96);

      // Subtítulo
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(233, 213, 255);
      doc.text("Passo a passo em linguagem simples para", margin, 112);
      doc.text("RH, gestores e responsáveis de SST.", margin, 120);

      // Linha separadora
      doc.setDrawColor(255, 255, 255, 0.4);
      doc.setLineWidth(0.5);
      doc.line(margin, 130, pageW - margin, 130);

      // Normas de referência
      doc.setFontSize(9);
      doc.setTextColor(216, 180, 254);
      const normas = ["NR-01  ·  NR-17  ·  ISO 45001  ·  ISO 45003  ·  COPSOQ III  ·  LGPD"];
      doc.text(normas[0], pageW / 2, 140, { align: "center" });

      // Data
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

      doc.setFillColor(...ROXO);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SUMÁRIO", margin, 18);
      doc.setTextColor(...CINZA);

      y = 40;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const itens = [
        ["Passo 01", "Acesse o Módulo Psicossocial", "3"],
        ["Passo 02", "Crie uma Nova Campanha", "3"],
        ["Passo 03", "Vincule Setor + Função (Obrigatório — NR-17)", "4"],
        ["Passo 04", "Envie os Questionários", "5"],
        ["Passo 05", "Acompanhe as Respostas em Tempo Real", "5"],
        ["Passo 06", "Encerre a Campanha e Veja os Resultados", "6"],
        ["Passo 07", "Os Riscos São Exportados para o GRO Automaticamente", "7"],
        ["Passo 08", "Regra do Anonimato — Empresas Pequenas", "8"],
        ["—", "Glossário de Termos", "9"],
      ];

      itens.forEach(([num, titulo, pag], i) => {
        const bgY = y - 4;
        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, bgY, pageW - 2 * margin, 8, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...ROXO);
        doc.text(num, margin + 2, y + 1);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...CINZA);
        doc.text(titulo, margin + 28, y + 1);
        doc.setTextColor(...MUTED);
        doc.text(`pág. ${pag}`, pageW - margin - 2, y + 1, { align: "right" });
        y += 10;
      });

      y += 6;

      // Intro
      doc.setFillColor(...ROXO_LIGHT);
      doc.roundedRect(margin, y, pageW - 2 * margin, 30, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...ROXO);
      doc.text("Para quem é este manual?", margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...CINZA);
      const introText = doc.splitTextToSize(
        "Este material foi escrito para gestores de RH, responsáveis de SST e líderes de equipe que precisam usar o módulo psicossocial do sistema Seguramente sem conhecimento técnico prévio. Cada passo explica exatamente o que fazer e o que acontece nos bastidores.",
        pageW - 2 * margin - 8
      );
      doc.setFontSize(8.5);
      introText.forEach((line: string, i: number) => {
        doc.text(line, margin + 4, y + 15 + i * 5);
      });

      // ── PASSOS ────────────────────────────────────────────────────────────
      PASSOS.forEach((passo) => {
        addPage();
        y = margin + 4;

        // Cabeçalho do passo
        doc.setFillColor(...passo.cor);
        doc.roundedRect(margin, y, pageW - 2 * margin, 22, 2, 2, "F");

        // Número grande
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(255, 255, 255, 0.3);
        doc.text(passo.num, pageW - margin - 4, y + 16, { align: "right" });

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text(passo.titulo, margin + 4, y + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255, 0.85);
        doc.text(passo.subtitulo, margin + 4, y + 17);

        y += 30;

        // Parágrafos
        passo.paragrafos.forEach((para, pi) => {
          checkY(18);
          // Bullet colorido
          doc.setFillColor(...passo.cor);
          doc.circle(margin + 2, y + 1.5, 1.5, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(...CINZA);
          const linhas = doc.splitTextToSize(para, pageW - 2 * margin - 10);
          linhas.forEach((l: string, li: number) => {
            checkY(6);
            doc.text(l, margin + 7, y + li * 5.5);
          });
          y += linhas.length * 5.5 + 6;
        });

        y += 4;
        checkY(20);

        // Caixa de dica
        const dicaLinhas = doc.splitTextToSize(passo.dica, pageW - 2 * margin - 12);
        const dicaH = dicaLinhas.length * 5 + 10;
        doc.setFillColor(248, 245, 255);
        doc.setDrawColor(...passo.cor);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, pageW - 2 * margin, dicaH, 2, 2, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...CINZA);
        dicaLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 6, y + 7 + li * 5);
        });
        y += dicaH + 6;
      });

      // ── FLUXO RESUMIDO ────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      doc.setFillColor(...ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("FLUXO RESUMIDO — O QUE ACONTECE EM CADA ETAPA", margin, margin + 10);
      y = margin + 24;
      doc.setTextColor(...CINZA);

      const fluxo = [
        { etapa: "Criar campanha", sistema: "Gera link único de participação e configura questionário", cor: AZUL },
        { etapa: "Vincular Setor+Função", sistema: "Registra as situações de trabalho obrigatórias (NR-17)", cor: ROXO },
        { etapa: "Colaborador responde", sistema: "Verifica unicidade via WhatsApp · Armazena hash anônimo · Descarta identidade", cor: VERDE },
        { etapa: "< 5 respostas no grupo", sistema: "Agrupa dados: Função → Setor → Empresa (proteção de anonimato)", cor: LARANJA },
        { etapa: "Encerrar campanha", sistema: "Calcula IPS · Gera radar dimensional · IA interpreta resultados", cor: ROXO },
        { etapa: "Risco identificado", sistema: "Exporta automaticamente para GRO com Setor+Função vinculados", cor: VERMELHO },
        { etapa: "Risco Crítico ou Alto", sistema: "Gera Plano de Ação 5W2H com prazo · Bloqueia arquivamento sem ação", cor: VERMELHO },
      ];

      fluxo.forEach((f, i) => {
        checkY(14);
        if (i % 2 === 0) {
          doc.setFillColor(248, 248, 255);
          doc.rect(margin, y - 3, pageW - 2 * margin, 13, "F");
        }
        doc.setFillColor(...f.cor);
        doc.roundedRect(margin, y - 1, 3, 8, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...f.cor);
        doc.text(f.etapa, margin + 6, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text("→", margin + 55, y + 4);
        doc.setTextColor(...CINZA);
        const sysLinhas = doc.splitTextToSize(f.sistema, pageW - 2 * margin - 65);
        sysLinhas.forEach((l: string, li: number) => doc.text(l, margin + 62, y + 4 + li * 4.5));
        y += 14;
      });

      // ── GLOSSÁRIO ─────────────────────────────────────────────────────────
      addPage();
      y = margin + 4;

      doc.setFillColor(...ROXO);
      doc.rect(0, margin - 4, pageW, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("GLOSSÁRIO DE TERMOS", margin, margin + 10);
      y = margin + 24;

      GLOSSARIO.forEach(([termo, def], i) => {
        const defLinhas = doc.splitTextToSize(def, pageW - 2 * margin - 36);
        const linhaH = defLinhas.length * 4.8 + 8;
        checkY(linhaH);

        if (i % 2 === 0) {
          doc.setFillColor(248, 245, 255);
          doc.rect(margin, y, pageW - 2 * margin, linhaH, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...ROXO);
        doc.text(termo, margin + 3, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...CINZA);
        defLinhas.forEach((l: string, li: number) => {
          doc.text(l, margin + 36, y + 6 + li * 4.8);
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
