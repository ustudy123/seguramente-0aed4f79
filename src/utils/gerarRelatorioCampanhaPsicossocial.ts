import jsPDF from "jspdf";
import QRCode from "qrcode";

// Remove acentos para compatibilidade com fontes padrão do jsPDF (WinAnsi)
const s = (t: string): string =>
  (t || "")
    .normalize("NFC");

interface GerarRelatorioParams {
  empresaNome: string;
  empresaCnpj: string;
  campanhaNome: string;
  linkPublico: string;
  instrumento?: string;
  baseAtendimento?: string;
}

export async function gerarRelatorioCampanhaPsicossocial(
  params: GerarRelatorioParams
): Promise<void> {
  const {
    empresaNome,
    empresaCnpj,
    campanhaNome,
    linkPublico,
    instrumento = "SIPRO",
    baseAtendimento,
  } = params;

  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginTop = 32;
  const marginBottom = 22;
  const contentW = pageW - marginX * 2;
  let y = marginTop;

  // QR Code (PNG base64)
  const qrDataUrl = await QRCode.toDataURL(linkPublico, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  // ----- helpers -----
  const drawHeader = () => {
    doc.setFillColor(88, 28, 135);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("YourEyes - Gestao Psicossocial NR-01", marginX, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "Monitoramento continuo de riscos psicossociais, campanhas e indicadores organizacionais",
      marginX,
      16
    );
    doc.setFontSize(7);
    doc.text("NR-01 | NR-17 | ISO 45001 | ISO 45003", pageW - marginX, 16, {
      align: "right",
    });
    doc.setTextColor(30, 30, 30);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("YourEyes - Seguranca e Saude no Trabalho", marginX, pageH - 8);
    doc.text(`Pag. ${pageNum} / ${totalPages}`, pageW - marginX, pageH - 8, {
      align: "right",
    });
    doc.setTextColor(30, 30, 30);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - marginBottom) {
      doc.addPage();
      drawHeader();
      y = marginTop;
    }
  };

  const writeJustified = (text: string, fontSize = 10, lineHeight = 5.2) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(35, 35, 35);
    const lines = doc.splitTextToSize(s(text), contentW) as string[];
    lines.forEach((line, idx) => {
      ensureSpace(lineHeight);
      const isLast = idx === lines.length - 1;
      const words = line.split(/\s+/).filter(Boolean);
      // Última linha ou linhas curtas/com poucas palavras não são justificadas
      if (isLast || words.length < 2) {
        doc.text(line, marginX, y);
      } else {
        const wordsWidth = words.reduce(
          (acc, w) => acc + doc.getTextWidth(w),
          0
        );
        const totalGap = contentW - wordsWidth;
        const gap = totalGap / (words.length - 1);
        // Se o gap ficaria absurdamente grande (linha pequena), alinha à esquerda
        if (gap > 6) {
          doc.text(line, marginX, y);
        } else {
          let cx = marginX;
          words.forEach((w, i) => {
            doc.text(w, cx, y);
            cx += doc.getTextWidth(w) + gap;
          });
        }
      }
      y += lineHeight;
    });
  };

  const writeTitle = (text: string, size = 12) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(88, 28, 135);
    doc.text(s(text), marginX, y);
    y += 2;
    doc.setDrawColor(88, 28, 135);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, marginX + contentW, y);
    y += 5;
    doc.setTextColor(35, 35, 35);
  };

  const writeBullets = (items: string[], fontSize = 9.5, lineHeight = 5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(35, 35, 35);
    items.forEach((it) => {
      const bulletIndent = 5;
      const lines = doc.splitTextToSize(s(it), contentW - bulletIndent) as string[];
      ensureSpace(lineHeight * lines.length);
      doc.text("•", marginX, y);
      lines.forEach((ln, i) => {
        if (i > 0) ensureSpace(lineHeight);
        doc.text(ln, marginX + bulletIndent, y);
        y += lineHeight;
      });
    });
  };

  // ===== PÁGINA 1 =====
  drawHeader();

  // Título principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  const titulo = s("Campanha de Avaliacao dos Fatores de Risco Psicossocial Relacionados ao Trabalho");
  const tituloLines = doc.splitTextToSize(titulo, contentW) as string[];
  tituloLines.forEach((ln) => {
    doc.text(ln, pageW / 2, y, { align: "center" });
    y += 7;
  });
  y += 4;

  // Card de identificação
  const cardH = 38;
  ensureSpace(cardH);
  doc.setFillColor(245, 240, 255);
  doc.setDrawColor(88, 28, 135);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, cardH, 2, 2, "FD");
  let cy = y + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(88, 28, 135);
  doc.text("IDENTIFICACAO", marginX + 5, cy);
  cy += 6;
  doc.setTextColor(35, 35, 35);
  const linhas: [string, string][] = [
    ["Assunto:", "Campanha de Avaliacao dos Fatores de Risco Psicossocial"],
    ["Empresa:", empresaNome],
    ["CNPJ:", empresaCnpj || "Nao informado"],
    ["Questionario:", `${instrumento.toUpperCase()} - Indice de Risco Psicossocial`],
  ];
  if (baseAtendimento) linhas.splice(3, 0, ["Base:", baseAtendimento]);
  linhas.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(s(k), marginX + 5, cy);
    doc.setFont("helvetica", "normal");
    doc.text(s(v), marginX + 35, cy);
    cy += 5;
  });
  y += cardH + 6;

  // Saudação
  writeJustified("Prezado(a) Cliente,");
  y += 1;
  writeJustified(
    "A Campanha de Avaliacao dos Fatores de Risco Psicossocial Relacionados ao Trabalho ajuda sua empresa a identificar, avaliar e tratar riscos relacionados ao trabalho - como estresse excessivo, falta de autonomia e esgotamento - de forma automatica e em conformidade com a NR-01."
  );
  y += 2;

  writeTitle("Passo a passo para a avaliacao", 11);
  writeBullets([
    "Envie o link por WhatsApp, e-mail ou imprima o QR Code abaixo.",
    "O colaborador acessa pelo celular ou computador - sem login.",
    "Verificacao via numero do CPF garante 1 resposta por pessoa.",
    "A identidade nunca e salva junto as respostas - apenas um hash anonimo.",
    "Tratamento conforme a LGPD (Lei n. 13.709/2018), com finalidade especifica e minima.",
  ]);
  y += 3;

  // ===== BLOCO LINK + QR CODE =====
  writeTitle("Acesso ao questionario", 11);

  const blocoH = 62;
  ensureSpace(blocoH);
  doc.setFillColor(252, 250, 255);
  doc.setDrawColor(88, 28, 135);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, blocoH, 2, 2, "FD");

  // Lado esquerdo: empresa + link
  const leftX = marginX + 5;
  let ly = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(88, 28, 135);
  doc.text(s(empresaNome).slice(0, 45), leftX, ly);
  ly += 5;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(s(empresaCnpj || ""), leftX, ly);
  ly += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text("Link da campanha:", leftX, ly);
  ly += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 64, 175);
  const linkLines = doc.splitTextToSize(linkPublico, contentW / 2 - 10) as string[];
  linkLines.slice(0, 4).forEach((ln) => {
    doc.textWithLink(ln, leftX, ly, { url: linkPublico });
    ly += 4.2;
  });
  ly += 2;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text("Toque no link ou aponte o QR Code", leftX, ly);

  // Lado direito: QR
  const qrSize = 48;
  const qrX = pageW - marginX - qrSize - 5;
  const qrY = y + (blocoH - qrSize) / 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, "F");
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  y += blocoH + 5;

  // Badge anonimato
  ensureSpace(14);
  doc.setFillColor(220, 240, 230);
  doc.roundedRect(marginX, y, contentW, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(16, 110, 70);
  doc.text(s("Questionario 100% anonimo - protegido pela LGPD"), pageW / 2, y + 6.5, {
    align: "center",
  });
  doc.setTextColor(35, 35, 35);
  y += 14;

  // ===== PÁGINA 2 - Fundamentação =====
  doc.addPage();
  drawHeader();
  y = marginTop;

  writeTitle("1. O que sao os Fatores de Risco Psicossociais?");
  writeJustified(
    "Os fatores de risco psicossociais sao condicoes do ambiente e da organizacao do trabalho que podem afetar negativamente a saude mental, emocional e ate fisica dos trabalhadores. Diferente dos riscos tradicionais (quimicos, fisicos, biologicos), eles decorrem da forma como o trabalho e estruturado, gerenciado e vivenciado no dia a dia."
  );
  y += 1;
  writeJustified(
    "A NR-01 atualizada exige que as empresas identifiquem, avaliem e adotem medidas para esses riscos, incluindo-os no PGR - Programa de Gerenciamento de Riscos."
  );
  y += 3;

  writeTitle("Exemplos reconhecidos pela norma", 10);
  writeBullets([
    "Excesso de pressao por produtividade e metas inatingiveis.",
    "Jornadas prolongadas ou horas extras excessivas.",
    "Ausencia de clareza sobre funcoes e responsabilidades.",
    "Conflitos interpessoais, assedio moral ou discriminacao.",
    "Inseguranca no emprego e falta de perspectiva de crescimento.",
    "Ausencia de suporte da lideranca e de canais de comunicacao.",
    "Trabalho em isolamento ou com baixa autonomia.",
    "Falta de intervalos e pausas adequadas durante a jornada.",
  ]);
  y += 3;

  writeTitle("2. Organizacao do Trabalho e Hierarquia de Controle");
  writeJustified(
    "A maioria dos fatores de risco psicossociais tem origem direta na forma como o trabalho e organizado. Empresas com gestao estruturada, politicas claras e cultura saudavel ja caminham naturalmente na direcao da conformidade. Organizar bem o trabalho e prevenir os riscos psicossociais."
  );
  y += 2;
  writeBullets([
    "1o - ELIMINAR o risco (remover a causa raiz sempre que possivel).",
    "2o - MINIMIZAR o risco (reduzir exposicao e impactos).",
    "3o - CONTROLAR com medidas administrativas e de gestao.",
    "4o - MONITORAR continuamente e revisar as medidas adotadas.",
  ]);
  y += 2;
  writeJustified(
    "A eliminacao do risco e sempre a melhor solucao. Quando nao for viavel, o foco deve ser minimizar ao maximo a exposicao dos trabalhadores."
  );

  // ===== PÁGINA 3 - Evidências =====
  doc.addPage();
  drawHeader();
  y = marginTop;

  writeTitle("3. A Importancia de Registrar e Evidenciar a Gestao");
  writeJustified(
    "Um dos pontos centrais da nova exigencia nao e apenas fazer a gestao correta, mas tambem ser capaz de comprova-la. Em caso de fiscalizacao pelo MTE, reclamacoes trabalhistas ou disputas internas, a empresa precisa apresentar evidencias documentais das medidas adotadas. Registrar e evidenciar as praticas de gestao e a prova concreta de que a empresa cuida de seus colaboradores e atua de forma preventiva."
  );
  y += 3;

  writeTitle("Principais registros recomendados", 10);
  const registros: [string, string][] = [
    ["Registro de Ponto", "Controle eletronico ou fisico que evidencia o cumprimento da jornada legal e os intervalos concedidos."],
    ["Intervalos e Pausas", "Registros que comprovem a concessao de intervalos intrajornada (almoco, descanso)."],
    ["Politica de Metas", "Documentos que formalizem metas acessiveis, metodologia de acompanhamento e ausencia de pressao abusiva."],
    ["Gestao de Ferias", "Controle de ferias em dia, com gozo regular garantido e registro das datas programadas e usufruidas."],
    ["Gestao de Atestados", "Protocolo claro de recebimento, registro e acompanhamento de afastamentos, incluindo CID de saude mental."],
    ["Canal de Ouvidoria", "Mecanismo formal (canal digital, e-mail) para denuncias e relatos de situacoes de risco."],
    ["Descritivo de Atividades", "Descricoes de cargo e funcao claras, evitando ambiguidade de papeis e conflito de expectativas."],
    ["Processo de Integracao", "Integracao estruturada para novos colaboradores, com apresentacao da cultura, normas e suportes."],
    ["Treinamentos e Capacitacao", "Programas de desenvolvimento que reduzam a inseguranca no desempenho das funcoes."],
    ["Comunicacao Interna", "Praticas documentadas de feedback, reunioes periodicas e canais abertos entre lideranca e equipes."],
  ];
  registros.forEach(([titulo, desc]) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(88, 28, 135);
    doc.text("• " + s(titulo), marginX, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lns = doc.splitTextToSize(s(desc), contentW - 5) as string[];
    lns.forEach((ln) => {
      ensureSpace(4.5);
      doc.text(ln, marginX + 5, y);
      y += 4.5;
    });
    y += 1;
  });

  // ===== PÁGINA 4 - Cultura + Passos =====
  doc.addPage();
  drawHeader();
  y = marginTop;

  writeTitle("4. Gestao do Trabalho como Cultura Empresarial");
  writeJustified(
    "O cumprimento da NR-01 atualizada vai muito alem de uma obrigacao legal: e a consolidacao de uma cultura organizacional saudavel. Empresas que ja praticam uma gestao humana, transparente e bem estruturada tendem a ter menor rotatividade, menos afastamentos, equipes mais motivadas e menos passivos trabalhistas."
  );
  y += 1;
  writeJustified(
    "Quando a empresa trata bem seus colaboradores - com jornadas justas, metas realistas, comunicacao clara, integracao eficiente e canais abertos de dialogo -, ela elimina ou minimiza naturalmente os fatores de risco psicossociais. A norma simplesmente coloca isso em lei."
  );
  y += 3;

  writeTitle("5. Passo a Passo para Adequacao");
  const passos: [string, string][] = [
    ["1. Diagnostico Inicial", "Levantamento dos fatores presentes via entrevistas, questionarios validados e observacao. Identificacao dos setores e funcoes com maior exposicao."],
    ["2. Atualizacao do PGR", "Inclusao formal dos riscos psicossociais no PGR, com inventario, avaliacao de severidade/probabilidade e medidas previstas."],
    ["3. Plano de Acao", "Medidas preventivas e corretivas priorizadas pela hierarquia de controle. Definicao de responsaveis e prazos."],
    ["4. Organizacao de Evidencias", "Levantamento dos registros existentes: ponto, ferias, atestados, descritivos, atas, ouvidoria, etc."],
    ["5. Capacitacao de Liderancas", "Treinamento para gestores e CIPA sobre saude mental, sinais de risco e gestao humanizada."],
    ["6. Envolvimento dos Colaboradores", "Apresentacao das medidas adotadas e abertura de canais de escuta e melhoria continua."],
  ];
  passos.forEach(([t, d]) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(88, 28, 135);
    doc.text(s(t), marginX, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lns = doc.splitTextToSize(s(d), contentW - 5) as string[];
    lns.forEach((ln) => {
      ensureSpace(4.5);
      doc.text(ln, marginX + 5, y);
      y += 4.5;
    });
    y += 1.5;
  });

  // Fechamento
  y += 4;
  ensureSpace(12);
  writeJustified(
    "Permanecemos a disposicao para esclarecer quaisquer duvidas. Contamos com voce para construirmos juntos ambientes de trabalho cada vez mais saudaveis e em conformidade com a legislacao vigente."
  );

  // Footer com paginação em todas as páginas
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  const safeName = (empresaNome || "empresa")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 30);
  const safeCamp = campanhaNome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  doc.save(`Campanha_Psicossocial_${safeName}_${safeCamp}.pdf`);
}
