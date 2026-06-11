import jsPDF from "jspdf";
import type { EventoSST } from "@/types/eventoSST";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/dataLocal";

const lesaoLabels: Record<string, string> = {
  sem_lesao: "Sem lesão aparente",
  leve: "Lesão leve",
  moderada: "Lesão moderada",
  grave: "Lesão grave",
};
const afastLabels: Record<string, string> = {
  sem_afastamento: "Sem afastamento",
  ate_15_dias: "Até 15 dias",
  mais_15_dias: "Mais de 15 dias",
};
const atendLabels: Record<string, string> = {
  nao_necessario: "Não necessário",
  ambulatorial: "Ambulatorial",
  hospitalar: "Hospitalar",
};

export const gerarRelatorioCATpdf = (evento: EventoSST) => {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  const addLine = (label: string, value: string, bold = false) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value || "-", margin + 55, y);
    y += 6;
  };

  const addSection = (title: string) => {
    if (y > 260) { doc.addPage(); y = margin; }
    y += 4;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 53, 85);
    doc.text(title, margin, y);
    doc.setTextColor(0);
    y += 2;
    doc.setDrawColor(33, 53, 85);
    doc.line(margin, y, 190, y);
    y += 6;
  };

  const addParagraph = (text: string) => {
    if (!text) return;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, 170 - margin);
    lines.forEach((line: string) => {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 5;
    });
    y += 2;
  };

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(33, 53, 85);
  doc.text("RELATÓRIO DE ACIDENTE DE TRABALHO", margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Base para preenchimento da CAT – Documento interno", margin, y);
  y += 4;
  doc.text(`Código: ${evento.codigo || "N/A"} | Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, margin, y);
  doc.setTextColor(0);
  y += 8;

  // Section 1: Event data
  addSection("1. DADOS DO EVENTO");
  addLine("Tipo:", evento.tipo === "acidente" ? "Acidente de Trabalho" : "Incidente");
  addLine("Data:", formatDateBR(evento.data_evento, "dd/MM/yyyy"));
  addLine("Hora:", evento.hora_evento || "Não informada");
  addLine("Unidade:", evento.unidade || "-");
  addLine("Setor / Área:", evento.setor || "-");
  addLine("Local Específico:", evento.local_especifico || "-");
  addLine("Turno:", evento.turno || "-");

  // Section 2: Involved
  addSection("2. COLABORADOR ENVOLVIDO");
  addLine("Nome:", evento.colaborador_nome || "-");
  addLine("Função:", evento.colaborador_funcao || "-");
  addLine("Tempo de Empresa:", evento.colaborador_tempo_empresa || "-");
  if (evento.outros_envolvidos) {
    addLine("Outros Envolvidos:", "");
    addParagraph(evento.outros_envolvidos);
  }

  // Section 3: Nature
  addSection("3. NATUREZA DO EVENTO");
  addLine("Categoria:", evento.categoria_principal || "-");
  addLine("Origem Predominante:", evento.origem_predominante || "-");

  // Section 4: Severity (accident only)
  if (evento.tipo === "acidente") {
    addSection("4. GRAVIDADE DO ACIDENTE");
    addLine("Lesão:", evento.gravidade_lesao ? lesaoLabels[evento.gravidade_lesao] : "-");
    addLine("Afastamento:", evento.afastamento ? afastLabels[evento.afastamento] : "-");
    addLine("Óbito:", evento.obito ? "Sim" : "Não");
    addLine("Atendimento:", evento.atendimento ? atendLabels[evento.atendimento] : "-");
  }

  // Section 5: Description
  addSection(evento.tipo === "acidente" ? "5. DESCRIÇÃO DO ACIDENTE" : "4. DESCRIÇÃO DO EVENTO");
  addParagraph(evento.descricao || "Sem descrição");
  if (evento.percepcao_causa) {
    y += 2;
    addLine("Percepção da Causa:", "");
    addParagraph(evento.percepcao_causa);
  }

  // Section 6: Ergonomic factors
  if (evento.fatores_ergonomicos && evento.fatores_ergonomicos.length > 0) {
    addSection(evento.tipo === "acidente" ? "6. FATORES CONTRIBUINTES" : "5. FATORES CONTRIBUINTES");
    evento.fatores_ergonomicos.forEach((f) => {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.setFontSize(9);
      doc.text(`• ${f}`, margin + 4, y);
      y += 5;
    });
  }

  // Section 7: CAT info
  if (evento.tipo === "acidente" && evento.cat_emitida) {
    addSection("7. DADOS DA CAT");
    addLine("Número:", evento.cat_numero || "-");
    addLine("Data de Emissão:", evento.cat_data_emissao || "-");
    addLine("Tipo:", evento.cat_tipo || "-");
    if (evento.cat_observacoes) {
      addLine("Observações:", "");
      addParagraph(evento.cat_observacoes);
    }
  }

  // Footer
  y += 10;
  if (y > 260) { doc.addPage(); y = margin; }
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("Este documento é de uso interno e serve como apoio para preenchimento da CAT nos sistemas oficiais.", margin, y);
  y += 4;
  doc.text("O YourEyes é repositório e sistema de gestão documental, não substitui responsabilidades técnicas legais dos profissionais.", margin, y);

  doc.save(`Relatorio_${evento.tipo === "acidente" ? "Acidente" : "Incidente"}_${evento.codigo || "evento"}.pdf`);
};
