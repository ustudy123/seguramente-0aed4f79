/**
 * Cartão Ponto — leiaute clássico de cartão ponto (o mesmo modelo que o RH
 * recebe do contador), reproduzido com a identidade visual do YourEyes.
 *
 * Blocos, na ordem do modelo:
 *   1. Cabeçalho da marca (faixa navy + logo) e faixa "CARTÃO PONTO".
 *   2. Identificação do empregador e do empregado.
 *   3. Corpo dia a dia: Data | Sem | Hor | Marcações | H.D. H.N. H.E. A.N.
 *      H.C. H.A. F.N. F.J.
 *   4. Totalização do resumo diário.
 *   5. Resumo de Horas do Mês e Resumo do Banco de Horas.
 *   6. Legenda das siglas e bloco de ciência/assinaturas.
 *
 * Uma página (ou mais, se o mês transbordar) por colaborador.
 */
import type jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MARCA, desenharRodape } from "./pdfMarca";
import { formatarHoraMinuto } from "./formatoHoras";

export interface CartaoMarcacao {
  hora: string;
  /** O = original do colaborador, I/A = incluída manualmente pelo RH. */
  origem: "O" | "A";
}

export interface CartaoDia {
  dia: string; // yyyy-MM-dd
  trabalhado_min: number;
  jornada_min: number;
  saldo_min: number;
  protegido: boolean;
  equalizacao: boolean;
  excedente_retido_min: number;
  marcacoes: CartaoMarcacao[];
}

export interface CartaoEmpregador {
  razaoSocial: string;
  cnpj?: string | null;
  atividade?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export interface CartaoEmpregado {
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  setor?: string | null;
  admissao?: string | null;
  categoria?: string | null;
  horarios?: string | null;
}

export interface CartaoBanco {
  saldoAnterior: number;
  creditos: number;
  debitos: number;
  compensados: number;
  saldoAtual: number;
}

export interface CartaoPontoInput {
  empregador: CartaoEmpregador;
  empregado: CartaoEmpregado;
  periodo: string;
  emissao: string;
  dias: CartaoDia[];
  banco?: CartaoBanco | null;
  logoDataUrl?: string | null;
}

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

const diaSemana = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS_SEMANA[new Date(a, m - 1, d).getDay()];
};
const dataCurta = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const hm = (min: number) => {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
};

/** Marcações em pares por linha — evita que a última batida seja cortada. */
const marcacoesTexto = (marcacoes: CartaoMarcacao[]) => {
  const tokens = marcacoes.map((m) => `${m.hora}-${m.origem === "A" ? "I" : "O"}`);
  const linhas: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    linhas.push(tokens.slice(i, i + 2).join("  "));
  }
  return linhas.join("\n");
};

/** Colunas H.C./H.A./F.N./F.J. e o rótulo da ocorrência, na lógica do modelo. */
function classificarDia(d: CartaoDia) {
  const domingo = diaSemana(d.dia) === "DOM";
  const semJornada = d.jornada_min === 0;
  const semTrabalho = d.trabalhado_min === 0;

  let ocorrencia = "";
  let hc = 0;
  let ha = 0;
  let fn = 0;
  let fj = 0;
  let he = 0;

  if (d.equalizacao) {
    ocorrencia = "Compensado";
    hc = d.trabalhado_min;
  } else if (d.protegido && semTrabalho) {
    ocorrencia = "Justificado";
    fj = d.jornada_min;
  } else if (semTrabalho && !semJornada) {
    ocorrencia = "Falta";
    fn = d.jornada_min;
  } else if (semTrabalho && domingo) {
    ocorrencia = "DSR";
  } else if (semTrabalho) {
    ocorrencia = semJornada ? "Sem jornada" : "";
  } else if (d.saldo_min > 0) {
    he = d.saldo_min;
    ocorrencia = `Soma Banco Horas ${domingo || semJornada ? "100%" : "50%"}`;
  } else if (d.saldo_min < 0) {
    ha = -d.saldo_min;
    ocorrencia = "Diminui Banco Horas";
  } else {
    ocorrencia = "Trabalhando";
  }

  if (d.excedente_retido_min > 0) ocorrencia = "Excedente retido";
  return { ocorrencia, hc, ha, fn, fj, he };
}

function faixaTitulo(doc: jsPDF, input: CartaoPontoInput, pagina: number) {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...MARCA.navy);
  doc.rect(0, 0, pageW, 24, "F");
  const fio = 1.4;
  doc.setFillColor(...MARCA.azul);
  doc.rect(0, 24, pageW * 0.55, fio, "F");
  doc.setFillColor(...MARCA.verde);
  doc.rect(pageW * 0.55, 24, pageW * 0.3, fio, "F");
  doc.setFillColor(...MARCA.laranja);
  doc.rect(pageW * 0.85, 24, pageW * 0.15, fio, "F");

  let x = 12;
  if (input.logoDataUrl) {
    try {
      doc.setFillColor(...MARCA.branco);
      doc.roundedRect(11, 4.5, 15, 15, 2, 2, "F");
      doc.addImage(input.logoDataUrl, "PNG", 12.5, 6, 12, 12);
      x = 30;
    } catch {
      /* sem logo */
    }
  }

  doc.setTextColor(...MARCA.branco);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CARTÃO PONTO", x, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 214, 232);
  doc.text("YourEyes · Gestão de Jornada · Portaria 671/2021 MTP", x, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...MARCA.branco);
  doc.text(`Período: ${input.periodo}`, pageW - 12, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 214, 232);
  doc.text(`Emissão: ${input.emissao}   ·   Pág. ${pagina}`, pageW - 12, 17.5, { align: "right" });
}

/** Bloco de identificação (empregador + empregado). Devolve o Y final. */
function blocoIdentificacao(doc: jsPDF, input: CartaoPontoInput) {
  const pageW = doc.internal.pageSize.getWidth();
  const x = 12;
  const largura = pageW - 24;
  const topo = 30;
  const altura = 39;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, topo, largura, altura, 1.5, 1.5, "FD");

  const { empregador: er, empregado: eo } = input;

  // Colunas com largura própria para permitir quebra de linha nos textos longos
  // (atividade CNAE e endereço costumam estourar a coluna).
  const colX = [0, largura * 0.42, largura * 0.68];
  const colW = [
    largura * 0.42 - 6,
    largura * 0.26 - 6,
    largura * 0.32 - 6,
  ];

  const linha = (
    y: number,
    campos: Array<[string, string | null | undefined]>,
    maxLinhas = 2,
  ) => {
    campos.forEach(([rotulo, valor], i) => {
      if (!valor) return;
      const cx = x + 3 + colX[i];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...MARCA.cinza);
      doc.text(rotulo.toUpperCase(), cx, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.6);
      doc.setTextColor(...MARCA.navy);
      const linhas = doc.splitTextToSize(String(valor), colW[i]).slice(0, maxLinhas);
      doc.text(linhas, cx, y + 3.8, { lineHeightFactor: 1.15 });
    });
  };

  linha(topo + 5, [
    ["Empregador", er.razaoSocial],
    ["CNPJ", er.cnpj],
    ["Atividade", er.atividade],
  ]);
  linha(topo + 16, [
    ["Endereço", er.endereco],
    ["Cidade / UF", [er.cidade, er.uf].filter(Boolean).join(" - ") || null],
    ["Categoria", eo.categoria || "Mensalista"],
  ]);

  doc.setDrawColor(226, 232, 240);
  doc.line(x + 2, topo + 27, x + largura - 2, topo + 27);

  linha(topo + 31, [
    ["Empregado", eo.nome],
    ["CPF", eo.cpf],
    ["Admissão", eo.admissao],
  ], 1);


  const y2 = topo + altura + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...MARCA.cinza);
  const rodapeIdent = [
    eo.cargo ? `Cargo: ${eo.cargo}` : null,
    eo.setor ? `Setor: ${eo.setor}` : null,
    eo.matricula ? `Matrícula: ${eo.matricula}` : null,
    eo.horarios ? `Horários: ${eo.horarios}` : null,
  ].filter(Boolean).join("   ·   ");
  if (rodapeIdent) doc.text(rodapeIdent, x, y2 - 1);

  return y2 + 2;
}

/**
 * Desenha o cartão ponto de um colaborador no documento informado.
 * O chamador é responsável por criar/paginar o `doc`.
 */
export function desenharCartaoPonto(doc: jsPDF, input: CartaoPontoInput) {
  const pageW = doc.internal.pageSize.getWidth();
  let pagina = 1;

  faixaTitulo(doc, input, pagina);
  const inicio = blocoIdentificacao(doc, input);

  const totais = { hd: 0, hn: 0, he: 0, hc: 0, ha: 0, fn: 0, fj: 0 };
  const corpo = input.dias.map((d) => {
    const k = classificarDia(d);
    totais.hd += d.trabalhado_min;
    totais.hn += d.jornada_min;
    totais.he += k.he;
    totais.hc += k.hc;
    totais.ha += k.ha;
    totais.fn += k.fn;
    totais.fj += k.fj;
    return [
      dataCurta(d.dia),
      diaSemana(d.dia),
      marcacoesTexto(d.marcacoes),
      k.ocorrencia,
      hm(d.trabalhado_min),
      hm(d.jornada_min),
      hm(k.he),
      "",
      hm(k.hc),
      hm(k.ha),
      hm(k.fn),
      hm(k.fj),
    ];
  });

  autoTable(doc, {
    startY: inicio,
    theme: "grid",
    head: [["Data", "Sem", "Marcações", "Ocorrência", "H.D.", "H.N.", "H.E.", "A.N.", "H.C.", "H.A.", "F.N.", "F.J."]],
    body: corpo.length > 0 ? corpo : [["", "", "Sem dias apurados", "", "", "", "", "", "", "", "", ""]],
    foot: [[
      "Totalização", "", "", "Resumo diário",
      hm(totais.hd), hm(totais.hn), hm(totais.he), "",
      hm(totais.hc), hm(totais.ha), hm(totais.fn), hm(totais.fj),
    ]],
    styles: {
      font: "helvetica",
      fontSize: 6.8,
      cellPadding: 1.3,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: MARCA.azul,
      textColor: MARCA.branco,
      fontStyle: "bold",
      fontSize: 6.8,
      halign: "center",
    },
    footStyles: {
      fillColor: MARCA.cinzaClaro,
      textColor: MARCA.navy,
      fontStyle: "bold",
      fontSize: 6.8,
      halign: "right",
    },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 9, halign: "center" },
      2: { cellWidth: 40, halign: "center" },
      3: { cellWidth: 31 },
      4: { cellWidth: 10, halign: "right" },
      5: { cellWidth: 10, halign: "right" },
      6: { cellWidth: 10, halign: "right" },
      7: { cellWidth: 10, halign: "right" },
      8: { cellWidth: 10, halign: "right" },
      9: { cellWidth: 10, halign: "right" },
      10: { cellWidth: 10, halign: "right" },
      11: { cellWidth: 10, halign: "right" },
    },
    didParseCell: (dados) => {
      if (dados.section !== "body") return;
      const texto = String(dados.row.raw?.[3] ?? "");
      if (texto === "DSR" || texto === "Feriado") dados.cell.styles.fillColor = [237, 242, 249];
      if (texto === "Falta") dados.cell.styles.textColor = MARCA.vermelho;
      if (texto.startsWith("Soma")) dados.cell.styles.textColor = [22, 101, 52];
    },
    margin: { left: 12, right: 12, top: 30 },
    didDrawPage: () => {
      if (pagina > 1) faixaTitulo(doc, input, pagina);
      pagina += 1;
    },
  });

  // Resumos
  const b = input.banco;
  let y = (doc as any).lastAutoTable.finalY + 5;
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 70) {
    doc.addPage();
    faixaTitulo(doc, input, pagina);
    y = 32;
  }

  const painel = (
    titulo: string,
    itens: Array<[string, string]>,
    x: number,
    largura: number,
    topo: number,
  ) => {
    const altura = 10 + Math.ceil(itens.length / 2) * 8;
    doc.setFillColor(...MARCA.navy);
    doc.roundedRect(x, topo, largura, 7, 1.2, 1.2, "F");
    doc.setFillColor(252, 253, 254);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, topo + 7, largura, altura - 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MARCA.branco);
    doc.text(titulo.toUpperCase(), x + 3, topo + 4.8);

    itens.forEach(([rotulo, valor], i) => {
      const col = i % 2;
      const linhaIdx = Math.floor(i / 2);
      const cx = x + 3 + col * (largura / 2);
      const cy = topo + 14 + linhaIdx * 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(...MARCA.cinza);
      doc.text(rotulo, cx, cy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MARCA.navy);
      doc.text(valor, cx + largura / 2 - 6, cy, { align: "right" });
    });
    return topo + altura;
  };

  const largura = (pageW - 24 - 4) / 2;
  const fim1 = painel("Resumo de horas do mês", [
    ["Horas normais", hm(totais.hn) || "00:00"],
    ["Horas trabalhadas", hm(totais.hd) || "00:00"],
    ["Horas extras", hm(totais.he) || "00:00"],
    ["Horas compensadas", hm(totais.hc) || "00:00"],
    ["Horas de ausência", hm(totais.ha) || "00:00"],
    ["Adicional noturno", "n/a"],
    ["Faltas não justificadas", hm(totais.fn) || "00:00"],
    ["Faltas justificadas", hm(totais.fj) || "00:00"],
  ], 12, largura, y);

  const fim2 = painel("Resumo do banco de horas", [
    ["Saldo anterior", formatarHoraMinuto(b?.saldoAnterior ?? 0)],
    ["Crédito no período", formatarHoraMinuto(b?.creditos ?? totais.he)],
    ["Débito no período", formatarHoraMinuto(b?.debitos ?? totais.ha)],
    ["Compensado", formatarHoraMinuto(b?.compensados ?? totais.hc)],
    ["Saldo atual", formatarHoraMinuto(b?.saldoAtual ?? totais.he - totais.ha)],
    ["", ""],
  ], 12 + largura + 4, largura, y);

  y = Math.max(fim1, fim2) + 6;

  // Legenda
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MARCA.navy);
  doc.text("Legenda", 12, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...MARCA.cinza);
  [
    "H.D. = Total de horas do dia   H.N. = Hora normal (prevista)   H.E. = Hora extra   A.N. = Adicional noturno",
    "H.C. = Hora compensada   H.A. = Hora de ausência   F.N. = Falta não justificada   F.J. = Falta justificada",
    "O = Marcação original   I = Marcação incluída manualmente pelo RH (Portaria MTP 671/2021)",
  ].forEach((linha, i) => doc.text(linha, 12, y + 4 + i * 3.6));

  y += 18;
  if (y > pageH - 30) {
    doc.addPage();
    faixaTitulo(doc, input, pagina);
    y = 34;
  }

  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text(
    "Estou de pleno acordo com o que demonstram as marcações acima, sendo que representam o ocorrido neste período.",
    12, y,
  );
  y += 16;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(16, y, 90, y);
  doc.line(pageW - 90, y, pageW - 16, y);
  doc.setFontSize(6.8);
  doc.setTextColor(...MARCA.cinza);
  doc.text(input.empregado.nome, 53, y + 4, { align: "center" });
  doc.text("Assinatura da chefia", pageW - 53, y + 4, { align: "center" });

  const total = doc.getNumberOfPages();
  desenharRodape(doc, doc.getCurrentPageInfo().pageNumber, total);
}
