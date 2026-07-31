import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  GRO_PROBABILIDADE_LABELS,
  GRO_SEVERIDADE_LABELS,
  type GRORisco,
} from "@/types/gro";

// Normaliza para WinAnsi (fontes padrão do jsPDF suportam Latin-1 acentuado)
const s = (t: string | null | undefined): string => (t || "").normalize("NFC");

export interface EmpresaDocumento {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cnae_principal?: string | null;
  cnae_descricao?: string | null;
  grau_risco?: string | number | null;
}

export interface ResponsavelTecnicoDocumento {
  nome: string;
  ocupacao?: string | null;
  registro_profissional?: string | null;
}

export interface CampanhaDocumento {
  nome: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  instrumento?: string | null;
  total_respostas?: number | null;
}

export interface AcaoDocumento {
  titulo: string;
  descricao?: string | null;
  porque?: string | null;
  onde?: string | null;
  como?: string | null;
  prazo?: string | null;
  responsavel_nome?: string | null;
  custo_estimado?: number | null;
  status?: string | null;
  prioridade?: string | null;
}

interface GerarDocumentoParams {
  empresa: EmpresaDocumento;
  responsavel: ResponsavelTecnicoDocumento;
  campanha: CampanhaDocumento;
  riscos: GRORisco[];
  acoes: AcaoDocumento[];
}

const NIVEL_LABELS: Record<string, string> = {
  baixo: "BAIXO",
  medio: "MÉDIO",
  alto: "ALTO",
  critico: "CRÍTICO",
};

const NIVEL_CORES: Record<string, [number, number, number]> = {
  baixo: [16, 150, 84],
  medio: [217, 158, 12],
  alto: [222, 107, 25],
  critico: [190, 30, 40],
};

const STATUS_ACAO_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const ROXO: [number, number, number] = [88, 28, 135];

export async function gerarDocumentoFatoresRiscoPsicossocial({
  empresa,
  responsavel,
  campanha,
  riscos,
  acoes,
}: GerarDocumentoParams): Promise<void> {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginTop = 30;
  const marginBottom = 22;
  const contentW = pageW - marginX * 2;
  let y = marginTop;

  const drawHeader = () => {
    doc.setFillColor(...ROXO);
    doc.rect(0, 0, pageW, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("YourEyes — Gestão Psicossocial NR-01", marginX, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(s("Fatores de Risco Psicossociais Relacionados ao Trabalho — PGR / GRO"), marginX, 15);
    doc.text("NR-01 | NR-17 | ISO 45001 | ISO 45003", pageW - marginX, 15, { align: "right" });
    doc.setTextColor(30, 30, 30);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - marginBottom) {
      doc.addPage();
      drawHeader();
      y = marginTop;
    }
  };

  const writeTitle = (text: string, size = 12) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...ROXO);
    const lines = doc.splitTextToSize(s(text), contentW) as string[];
    lines.forEach((ln) => {
      ensureSpace(6);
      doc.text(ln, marginX, y);
      y += 6;
    });
    doc.setDrawColor(...ROXO);
    doc.setLineWidth(0.4);
    doc.line(marginX, y - 3.5, marginX + contentW, y - 3.5);
    y += 2.5;
    doc.setTextColor(35, 35, 35);
  };

  const writeSubTitle = (text: string) => {
    ensureSpace(9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(60, 40, 110);
    const lines = doc.splitTextToSize(s(text), contentW) as string[];
    lines.forEach((ln) => {
      ensureSpace(5.5);
      doc.text(ln, marginX, y);
      y += 5.5;
    });
    y += 0.5;
    doc.setTextColor(35, 35, 35);
  };

  const writeParagraph = (text: string, fontSize = 9.5, lineHeight = 4.8) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(45, 45, 45);
    const lines = doc.splitTextToSize(s(text), contentW) as string[];
    lines.forEach((ln) => {
      ensureSpace(lineHeight);
      doc.text(ln, marginX, y, { align: "justify", maxWidth: contentW } as any);
      y += lineHeight;
    });
    y += 1.6;
  };

  const writeBullets = (items: string[], fontSize = 9, lineHeight = 4.6) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(45, 45, 45);
    items.forEach((it) => {
      const indent = 5;
      const lines = doc.splitTextToSize(s(it), contentW - indent) as string[];
      ensureSpace(lineHeight);
      doc.text("•", marginX, y);
      lines.forEach((ln) => {
        ensureSpace(lineHeight);
        doc.text(ln, marginX + indent, y);
        y += lineHeight;
      });
      y += 0.6;
    });
    y += 1;
  };

  const campoLinha = (rotulo: string, valor: string | null | undefined) => {
    ensureSpace(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(35, 35, 35);
    doc.text(s(rotulo), marginX + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text(s(valor || "—"), marginX + 55, y);
    y += 6;
  };

  const empresaNome = empresa.razao_social || empresa.nome_fantasia || "Empresa";
  const enderecoCompleto = [empresa.endereco, empresa.numero, empresa.bairro]
    .filter(Boolean)
    .join(", ");
  const periodo =
    campanha.data_inicio || campanha.data_fim
      ? `${campanha.data_inicio ? format(new Date(campanha.data_inicio + "T12:00:00"), "dd/MM/yyyy") : "—"} a ${campanha.data_fim ? format(new Date(campanha.data_fim + "T12:00:00"), "dd/MM/yyyy") : "em andamento"}`
      : null;

  // ═══════════════ CAPA ═══════════════
  drawHeader();
  y = 90;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...ROXO);
  const tituloCapa = doc.splitTextToSize(
    s("FATORES DE RISCO PSICOSSOCIAIS RELACIONADOS AO TRABALHO"),
    contentW
  ) as string[];
  tituloCapa.forEach((ln) => {
    doc.text(ln, pageW / 2, y, { align: "center" });
    y += 10;
  });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(70, 70, 70);
  doc.text(s(empresaNome), pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(11);
  doc.text(s(`Campanha: ${campanha.nome}`), pageW / 2, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...ROXO);
  doc.text(format(new Date(), "MM/yyyy"), pageW / 2, y, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    s("Documento integrante do Programa de Gerenciamento de Riscos (PGR / GRO) — NR-01 e NR-17"),
    pageW / 2,
    pageH - 30,
    { align: "center" }
  );

  // ═══════════════ 1. IDENTIFICAÇÃO ═══════════════
  doc.addPage();
  drawHeader();
  y = marginTop;

  writeTitle("1. IDENTIFICAÇÃO");
  doc.setFillColor(248, 244, 255);
  const idCardTop = y;
  y += 5;
  campoLinha("EMPRESA:", empresaNome);
  campoLinha("C.N.P.J.:", empresa.cnpj);
  campoLinha("ENDEREÇO:", enderecoCompleto || null);
  campoLinha("CIDADE:", empresa.cidade);
  campoLinha("ESTADO:", empresa.estado);
  campoLinha("CNAE:", empresa.cnae_principal);
  campoLinha("ATIVIDADE PRINCIPAL:", empresa.cnae_descricao);
  campoLinha("GRAU DE RISCO:", empresa.grau_risco != null ? String(empresa.grau_risco) : null);
  y += 2;

  writeSubTitle("RESPONSÁVEL TÉCNICO");
  campoLinha("NOME:", responsavel.nome);
  campoLinha("OCUPAÇÃO:", responsavel.ocupacao);
  campoLinha("REGISTRO PROFISSIONAL:", responsavel.registro_profissional);
  y += 2;

  writeSubTitle("CAMPANHA DE AVALIAÇÃO");
  campoLinha("CAMPANHA:", campanha.nome);
  if (periodo) campoLinha("PERÍODO:", periodo);
  if (campanha.instrumento) campoLinha("INSTRUMENTO:", campanha.instrumento.toUpperCase());
  if (campanha.total_respostas != null)
    campoLinha("PARTICIPAÇÕES:", String(campanha.total_respostas));
  void idCardTop;
  y += 3;

  // ═══════════════ 2. INTRODUÇÃO ═══════════════
  writeTitle("2. INTRODUÇÃO");
  writeParagraph(
    "O presente documento integra a documentação técnica do Programa de Gerenciamento de Riscos (PGR / GRO), em estrita conformidade com as diretrizes da NR-01 (Gerenciamento de Riscos Ocupacionais) e da NR-17 (Ergonomia — Fatores Organizacionais e Psicossociais)."
  );
  writeParagraph(
    "Com a consolidação das normas regulamentadoras brasileiras, tornou-se mandatória a identificação, a avaliação e o controle contínuo dos fatores de risco psicossociais associados ao ambiente corporativo. Tais fatores envolvem as exigências quantitativas e cognitivas das tarefas, o ritmo de trabalho, a clareza de papéis, as relações interpessoais e a interface entre a organização do trabalho e a saúde mental do trabalhador."
  );
  writeParagraph("O objetivo deste relatório é:");
  writeBullets([
    "Identificar Fatores de Risco Psicossocial: mensurar a percepção dos colaboradores quanto às dimensões organizacionais e de saúde mental no trabalho.",
    "Classificar os Níveis de Risco (Matriz GRO): cruzar a probabilidade de ocorrência com a severidade do dano potencial para a priorização de medidas preventivas.",
    "Fundamentar o Plano de Ação (5W2H): estabelecer medidas de controle, responsabilidades corporativas e prazos operacionais para mitigar os riscos mapeados.",
  ]);

  // ═══════════════ 3. METODOLOGIA ═══════════════
  writeTitle("3. METODOLOGIA E FLUXO DE AVALIAÇÃO");
  writeParagraph(
    "A metodologia adotada para o mapeamento e a estruturação das ações alinha-se aos preceitos da ISO 45003:2021 (Gestão da Saúde Psicossocial no Trabalho) e da ISO 45001:2018 (Sistemas de Gestão de SST), operando por meio de um ciclo contínuo de gestão (PDCA)."
  );
  writeParagraph(
    "Fluxo de Avaliação: [ Mapeamento Setor + Função ] → [ Coleta Multimodal ] → [ Diagnóstico & Matriz GRO ] → [ Plano de Ação (5W2H) ]"
  );

  writeSubTitle("3.1. Estruturação dos Grupos de Avaliação (NR-17 / NR-01)");
  writeParagraph(
    "Conforme exigência legal de rastreabilidade, a avaliação é estratificada por combinações de Setor + Função (Grupos Homogêneos de Exposição — GHE). Essa abordagem garante que cada risco identificado esteja atrelado à rotina e à realidade daquela específica atividade laboral."
  );

  writeSubTitle("3.2. Coleta de Dados e Garantia do Anonimato (LGPD e ISO 45003)");
  writeParagraph(
    "A etapa de diagnóstico psicossocial é operacionalizada por meio de três modalidades metodológicas padronizadas, definidas conforme o perfil da organização, a infraestrutura operacional e as especificidades de cada Grupo Homogêneo de Exposição (GHE):"
  );
  writeBullets([
    "Questionário Digital Estruturado: aplicação de instrumentos digitais padronizados (fundamentados nos modelos reconhecidos COPSOQ III e HSE), preenchidos de forma autônoma pelos colaboradores via dispositivos conectados.",
    "Entrevista Individual Guiada por IA: coleta qualitativa e quantitativa conduzida por um sistema interativo de Inteligência Artificial. A IA atua como agente facilitador de escuta, utilizando roteiros validados para orientar o colaborador de forma neutra, padronizada e sem viés. O sistema processa as interações, realiza a triagem estatística automatizada das respostas e sintetiza os indicadores de risco psicossocial sem expor dados individuais brutos.",
    "Entrevista Coletiva Guiada: aplicação de dinâmicas de escuta e diagnóstico em grupo, mediadas por roteiro direcionado, indicada para o mapeamento participativo das rotinas e processos organizacionais.",
  ]);
  writeParagraph("Governança dos Dados e Desdobramento dos Planos de Ação:");
  writeBullets([
    "Análise e Gestão Humana: os relatórios sintéticos gerados pelo sistema — independentemente da modalidade de coleta utilizada — são disponibilizados aos responsáveis técnicos pela gestão ocupacional (SST/RH). Cabe a esses profissionais a interpretação crítica dos diagnósticos e a elaboração técnica das medidas preventivas e corretivas no Plano de Ação (5W2H).",
    "Anonimização e Proteção de Dados: em estrito cumprimento à Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/18) e às orientações da ISO 45003 (§6.1.2), todas as interações e respostas coletadas são processadas com criptografia e sem qualquer vínculo nominativo ou de identificação individual dos colaboradores.",
    "Regra de Amostragem e Confidencialidade: para que os resultados por Função ou Setor sejam exibidos nos relatórios, exige-se uma amostragem mínima por grupo (mínimo de 5 respondentes). Em grupos com amostragem inferior, os dados são automaticamente consolidados em instâncias superiores (nível de Setor ou Geral da Empresa) para impedir qualquer possibilidade de identificação direta ou indireta.",
  ]);

  writeSubTitle("3.3. Matriz de Graduação de Risco Ocupacional (GRO / NR-01)");
  writeParagraph(
    "A severidade e a probabilidade são mensuradas para determinar a matriz final de risco do inventário, enquadrando os achados nos níveis operacionais: BAIXO, MÉDIO, ALTO e CRÍTICO. Nível de Risco (GRO) = Probabilidade × Severidade."
  );

  writeSubTitle("3.4. Integração com o Plano de Ação (GRO / PGR)");
  writeBullets([
    "Encaminhamento para o GRO/PGR: todos os fatores mapeados alimentam automaticamente o inventário corporativo de riscos do PGR.",
    "Planos de Ação Obrigatórios: riscos classificados como ALTO ou CRÍTICO demandam a estruturação imediata de Planos de Ação 5W2H com prazos de intervenção prioritários (de 30 a 60 dias).",
  ]);

  // ═══════════════ 4. ESTRUTURA DOS ANEXOS ═══════════════
  writeTitle("4. ESTRUTURA DOS ANEXOS");
  writeParagraph(
    "A partir desta introdução e fundamentação metodológica, o presente relatório apresenta a seguinte documentação anexa:"
  );
  writeBullets([
    "ANEXO I: INVENTÁRIO DE RISCOS PSICOSSOCIAIS (GRO / NR-01).",
    "ANEXO II: PLANO DE AÇÃO ESTRATÉGICO PARA CONTROLE DE RISCOS PSICOSSOCIAIS (MODELO 5W2H).",
  ]);

  // ═══════════════ ANEXO I — INVENTÁRIO ═══════════════
  doc.addPage();
  drawHeader();
  y = marginTop;
  writeTitle("ANEXO I — INVENTÁRIO DE RISCOS PSICOSSOCIAIS (GRO / NR-01)");
  writeParagraph(
    `Inventário gerado a partir da campanha "${campanha.nome}", com ${riscos.length} fator(es) de risco identificado(s) e classificado(s) pela Matriz GRO (Probabilidade × Severidade).`
  );

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
    head: [["Fator de Risco / Dimensão", "Setor", "Função", "Probabilidade", "Severidade", "Nível"]],
    body: riscos.map((r) => [
      s(r.dimensao_psicossocial || r.titulo),
      s(r.setor || "—"),
      s(r.cargo || "—"),
      GRO_PROBABILIDADE_LABELS[r.probabilidade] || s(r.probabilidade),
      GRO_SEVERIDADE_LABELS[r.severidade] || s(r.severidade),
      NIVEL_LABELS[r.nivel_risco] || s(r.nivel_risco),
    ]),
    styles: { font: "helvetica", fontSize: 7.8, cellPadding: 1.8, textColor: [45, 45, 45] },
    headStyles: { fillColor: ROXO, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 245, 253] },
    columnStyles: {
      0: { cellWidth: 52 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18, fontStyle: "bold", halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const nivel = riscos[data.row.index]?.nivel_risco;
        if (nivel && NIVEL_CORES[nivel]) data.cell.styles.textColor = NIVEL_CORES[nivel];
      }
    },
    didDrawPage: () => drawHeader(),
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Resumo por nível
  const contagem = {
    critico: riscos.filter((r) => r.nivel_risco === "critico").length,
    alto: riscos.filter((r) => r.nivel_risco === "alto").length,
    medio: riscos.filter((r) => r.nivel_risco === "medio").length,
    baixo: riscos.filter((r) => r.nivel_risco === "baixo").length,
  };
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text(
    s(`Resumo: ${contagem.critico} crítico(s) · ${contagem.alto} alto(s) · ${contagem.medio} médio(s) · ${contagem.baixo} baixo(s)`),
    marginX,
    y
  );
  y += 8;

  // ═══════════════ ANEXO II — PLANO DE AÇÃO 5W2H ═══════════════
  doc.addPage();
  drawHeader();
  y = marginTop;
  writeTitle("ANEXO II — PLANO DE AÇÃO ESTRATÉGICO (MODELO 5W2H)");

  if (acoes.length === 0) {
    writeParagraph(
      "Nenhuma ação registrada no Plano de Ação para esta campanha até a data de emissão deste documento."
    );
  } else {
    writeParagraph(
      `Plano de ação com ${acoes.length} medida(s) de controle vinculada(s) aos riscos psicossociais desta campanha.`
    );
    acoes.forEach((acao, idx) => {
      const linhas: [string, string][] = [
        ["O que (What)", acao.titulo + (acao.descricao ? ` — ${acao.descricao}` : "")],
        ["Por que (Why)", acao.porque || "—"],
        ["Onde (Where)", acao.onde || "—"],
        ["Quem (Who)", acao.responsavel_nome || "A definir"],
        [
          "Quando (When)",
          acao.prazo ? format(new Date(acao.prazo + "T12:00:00"), "dd/MM/yyyy") : "A definir",
        ],
        ["Como (How)", acao.como || "—"],
        [
          "Quanto (How much)",
          acao.custo_estimado != null
            ? acao.custo_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "—",
        ],
        ["Status", STATUS_ACAO_LABELS[acao.status || ""] || acao.status || "Pendente"],
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
        head: [[{ content: s(`AÇÃO ${idx + 1} — ${acao.titulo}`), colSpan: 2 }]],
        body: linhas.map(([k, v]) => [s(k), s(v)]),
        styles: { font: "helvetica", fontSize: 8.2, cellPadding: 1.8, textColor: [45, 45, 45] },
        headStyles: { fillColor: ROXO, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        columnStyles: { 0: { cellWidth: 38, fontStyle: "bold", fillColor: [248, 245, 253] } },
        didDrawPage: () => drawHeader(),
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    });
  }

  // ═══════════════ ENCERRAMENTO E ASSINATURA ═══════════════
  ensureSpace(70);
  y += 8;
  writeParagraph(
    "Este documento foi elaborado com base nos dados coletados e consolidados pela plataforma YourEyes, cabendo ao responsável técnico a validação das informações e o acompanhamento da implementação das medidas previstas no plano de ação."
  );
  y += 6;

  ensureSpace(50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(45, 45, 45);
  const cidadeUf = [empresa.cidade, empresa.estado].filter(Boolean).join(" — ");
  doc.text(
    s(`${cidadeUf || "________________________"}, ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`),
    marginX,
    y
  );
  y += 26;

  const assinaturaW = 110;
  const assinaturaX = (pageW - assinaturaW) / 2;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.line(assinaturaX, y, assinaturaX + assinaturaW, y);
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(s(responsavel.nome), pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (responsavel.ocupacao) {
    doc.text(s(responsavel.ocupacao), pageW / 2, y, { align: "center" });
    y += 4.5;
  }
  if (responsavel.registro_profissional) {
    doc.text(s(`Registro profissional: ${responsavel.registro_profissional}`), pageW / 2, y, {
      align: "center",
    });
    y += 4.5;
  }
  doc.setFontSize(8.5);
  doc.text(s("Responsável Técnico"), pageW / 2, y, { align: "center" });

  // ═══════════════ RODAPÉ EM TODAS AS PÁGINAS ═══════════════
  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(s("YourEyes — Segurança e Saúde no Trabalho"), marginX, pageH - 8);
    doc.text(`Pág. ${i} / ${total}`, pageW - marginX, pageH - 8, { align: "right" });
  }

  const safeEmpresa = (empresaNome || "empresa").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const safeCampanha = (campanha.nome || "campanha").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  doc.save(`Fatores_Risco_Psicossociais_${safeEmpresa}_${safeCampanha}.pdf`);
}
