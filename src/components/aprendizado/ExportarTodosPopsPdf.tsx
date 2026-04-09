import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PopData } from "@/hooks/usePopAtividade";
import { generatePdfFromHtml } from "@/utils/generatePdfFromHtml";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportarTodosPopsPdfProps {
  pops: PopData[];
  funcaoNome?: string;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Publicado",
  desatualizado: "Desatualizado",
};

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateAllPopsHtml(pops: PopData[], funcaoNome?: string): string {
  const now = new Date();
  const dateStr = format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  let sections = "";

  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    const passos = pop.procedimento_passos || [];
    const resp = pop.responsabilidades || {} as any;
    const preReq = pop.pre_requisitos || [];
    const materiais = pop.materiais_ferramentas || [];

    if (i > 0) {
      sections += `<div style="page-break-before: always;"></div>`;
    }

    sections += `
      <div style="margin-bottom: 40px;">
        <h1 style="color:#1a365d; border-bottom:2px solid #2563eb; padding-bottom:8px; font-size:20px; margin-top:0;">
          ${escapeHtml(pop.codigo)} — ${escapeHtml(pop.titulo)}
        </h1>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; background:#f8fafc; padding:12px; border-radius:8px; margin-bottom:16px; font-size:12px;">
          <span><strong style="color:#1e40af;">Versão:</strong> ${pop.versao_atual}</span>
          <span><strong style="color:#1e40af;">Status:</strong> ${STATUS_LABELS[pop.status] || pop.status}</span>
          <span><strong style="color:#1e40af;">Criado por:</strong> ${pop.criado_por_nome || "—"}</span>
          <span><strong style="color:#1e40af;">Criado em:</strong> ${format(new Date(pop.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
          ${pop.gerado_por_ia ? `<span><strong style="color:#1e40af;">🤖 Gerado por IA</strong></span>` : ""}
        </div>

        ${pop.objetivo ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">1. Objetivo</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.objetivo)}</p>` : ""}
        ${pop.escopo ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">2. Escopo</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.escopo)}</p>` : ""}
        
        <h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">3. Responsabilidades</h2>
        <ul style="padding-left:20px;">
          <li><strong>Executante:</strong> ${escapeHtml(resp.executante || "—")}</li>
          <li><strong>Supervisão:</strong> ${escapeHtml(resp.supervisao || "—")}</li>
          <li><strong>Interfaces:</strong> ${escapeHtml(resp.interfaces || "—")}</li>
        </ul>

        ${pop.definicoes ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">4. Definições</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.definicoes)}</p>` : ""}
        ${preReq.length > 0 ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">5. Pré-requisitos</h2><ul style="padding-left:20px;">${preReq.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>` : ""}
        ${materiais.length > 0 ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">6. Materiais, Ferramentas e Sistemas</h2><ul style="padding-left:20px;">${materiais.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>` : ""}
        ${pop.epis_sst ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">7. EPIs / Requisitos de SST</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.epis_sst)}</p>` : ""}
        
        ${passos.length > 0 ? `
          <h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">8. Procedimento Passo a Passo</h2>
          ${passos.map(p => `
            <div style="background:#f0f9ff; padding:10px; border-radius:6px; margin:6px 0; border-left:3px solid #2563eb;">
              <span style="font-weight:bold; color:#1e40af;">Passo ${p.numero}:</span> ${escapeHtml(p.descricao)}
              ${p.tempo_estimado ? ` <em>(${escapeHtml(p.tempo_estimado)})</em>` : ""}
              ${p.ponto_atencao ? `<div style="background:#fef3c7; padding:6px; border-radius:4px; margin-top:4px; font-size:12px;">⚠️ ${escapeHtml(p.ponto_atencao)}</div>` : ""}
            </div>
          `).join("")}
        ` : ""}

        ${pop.criterios_qualidade ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">9. Critérios de Qualidade</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.criterios_qualidade)}</p>` : ""}
        ${pop.registros_evidencias ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">10. Registros e Evidências</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.registros_evidencias)}</p>` : ""}
        ${pop.tratamento_nao_conformidades ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">11. Tratamento de Não Conformidades</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.tratamento_nao_conformidades)}</p>` : ""}
        ${pop.referencias ? `<h2 style="color:#1e40af; font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin-top:20px;">12. Referências</h2><p style="white-space:pre-wrap; text-align:justify;">${escapeHtml(pop.referencias)}</p>` : ""}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>POPs - ${escapeHtml(funcaoNome || "Função")}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      max-width: 760px;
      margin: 0 auto;
      padding: 30px 40px;
      color: #333;
      font-size: 13px;
      line-height: 1.6;
      background: #fff;
    }
    h1 { margin-top: 0; }
    h2 { margin-bottom: 8px; }
    p { margin: 4px 0 12px 0; }
    ul { margin: 4px 0 12px 0; }
    li { margin: 3px 0; }
  </style>
</head>
<body>
  <div style="text-align:center; margin-bottom:30px; padding-bottom:16px; border-bottom:2px solid #2563eb;">
    <h1 style="font-size:22px; color:#1a365d; margin:0 0 4px 0; border:none; padding:0;">
      Procedimentos Operacionais Padrão
    </h1>
    <p style="font-size:16px; color:#1e40af; margin:0 0 8px 0; font-weight:600;">
      ${escapeHtml(funcaoNome || "Função")}
    </p>
    <p style="font-size:11px; color:#6b7280; margin:0;">
      ${pops.length} POP${pops.length !== 1 ? "s" : ""} • Gerado em ${dateStr}
    </p>
  </div>

  <!-- Índice -->
  <div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:30px;">
    <h2 style="font-size:14px; color:#1a365d; margin:0 0 8px 0; border:none; padding:0;">Índice</h2>
    <ol style="padding-left:20px; margin:0;">
      ${pops.map(p => `<li style="margin:4px 0;"><strong>${escapeHtml(p.codigo)}</strong> — ${escapeHtml(p.titulo)}</li>`).join("")}
    </ol>
  </div>

  ${sections}

  <div style="margin-top:30px; padding-top:12px; border-top:1px solid #e5e7eb; text-align:center; font-size:10px; color:#9ca3af;">
    Documento gerado automaticamente em ${dateStr}
  </div>
</body>
</html>`;
}

export function ExportarTodosPopsPdf({ pops, funcaoNome }: ExportarTodosPopsPdfProps) {
  const [loading, setLoading] = useState(false);

  if (pops.length === 0) return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      const html = generateAllPopsHtml(pops, funcaoNome);
      const { pdf, filename } = await generatePdfFromHtml({
        html,
        filenamePrefix: `pops-${funcaoNome || "funcao"}`,
      });
      pdf.save(filename);
      toast.success(`PDF com ${pops.length} POP${pops.length !== 1 ? "s" : ""} exportado!`);
    } catch (err: any) {
      console.error("Erro ao exportar POPs:", err);
      // Fallback: download as HTML
      const html = generateAllPopsHtml(pops, funcaoNome);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pops-${funcaoNome || "funcao"}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.error("Erro no PDF. Exportado como HTML.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? "Gerando PDF..." : `Baixar Todos POPs (${pops.length})`}
    </Button>
  );
}
