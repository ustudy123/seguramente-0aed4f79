import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, Printer, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContratoExperiencia } from "@/hooks/useContratosExperiencia";
import { getDuracaoTotal } from "@/hooks/useContratosExperiencia";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

type TipoDocumento = "contrato" | "prorrogacao" | "efetivacao" | "rescisao";

const TIPO_LABELS: Record<TipoDocumento, string> = {
  contrato: "Contrato de Experiência",
  prorrogacao: "Termo de Prorrogação",
  efetivacao: "Termo de Efetivação",
  rescisao: "Termo de Rescisão",
};

interface ExperienciaDocGeneratorProps {
  contrato: ContratoExperiencia;
  open: boolean;
  onClose: () => void;
}

export function ExperienciaDocGenerator({ contrato, open, onClose }: ExperienciaDocGeneratorProps) {
  const [gerando, setGerando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDocumento | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);
  const [tituloDoc, setTituloDoc] = useState("");
  const { empresaAtivaId } = useEmpresaAtiva();

  const tiposDisponiveis: { tipo: TipoDocumento; disponivel: boolean; motivo?: string }[] = [
    { tipo: "contrato", disponivel: true },
    {
      tipo: "prorrogacao",
      disponivel: contrato.prorrogado,
      motivo: "Contrato não foi prorrogado",
    },
    {
      tipo: "efetivacao",
      disponivel: contrato.status === "efetivado",
      motivo: "Contrato não foi efetivado",
    },
    {
      tipo: "rescisao",
      disponivel: contrato.status === "encerrado",
      motivo: "Contrato não foi encerrado",
    },
  ];

  const gerarDocumento = async (tipo: TipoDocumento) => {
    setGerando(true);
    setTipoSelecionado(tipo);
    setHtmlDoc(null);

    try {
      // Buscar dados da empresa
      let empresaDados: any = {};
      if (contrato.empresa_id || empresaAtivaId) {
        const { data: emp } = await supabase
          .from("empresa_cadastro")
          .select("razao_social, cnpj, endereco, cidade, estado, cep")
          .eq("id", contrato.empresa_id || empresaAtivaId!)
          .single();
        if (emp) {
          empresaDados = {
            empresa_razao_social: emp.razao_social,
            empresa_cnpj: emp.cnpj,
            empresa_endereco: [emp.endereco, emp.cidade, emp.estado, emp.cep].filter(Boolean).join(", "),
          };
        }
      }

      const dados = {
        ...contrato,
        ...empresaDados,
        duracao_total: getDuracaoTotal(contrato),
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "diayjpsrcerycycyaxst";
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/ai-experiencia-doc`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ tipo, dados }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${response.status}`);
      }

      const result = await response.json();
      setHtmlDoc(result.html);
      setTituloDoc(result.titulo || TIPO_LABELS[tipo]);
      toast.success(`${TIPO_LABELS[tipo]} gerado com sucesso!`);
    } catch (error: any) {
      if (error.name === "AbortError") {
        toast.error("Tempo limite excedido. Tente novamente.");
      } else {
        toast.error(error.message || "Erro ao gerar documento");
      }
    } finally {
      setGerando(false);
    }
  };

  const imprimirDocumento = () => {
    if (!htmlDoc) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlDoc);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const baixarHtml = () => {
    if (!htmlDoc) return;
    const blob = new Blob([htmlDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tituloDoc.replace(/\s+/g, "_")}_${contrato.colaborador_nome.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setHtmlDoc(null);
    setTipoSelecionado(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={htmlDoc ? "max-w-4xl max-h-[90vh]" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {htmlDoc ? tituloDoc : "Gerar Documento"}
          </DialogTitle>
          {!htmlDoc && (
            <DialogDescription>
              Selecione o tipo de documento para <strong>{contrato.colaborador_nome}</strong>
            </DialogDescription>
          )}
        </DialogHeader>

        {!htmlDoc ? (
          <div className="space-y-3">
            {tiposDisponiveis.map(({ tipo, disponivel, motivo }) => (
              <Button
                key={tipo}
                variant="outline"
                className="w-full justify-between h-auto py-3"
                disabled={!disponivel || gerando}
                onClick={() => gerarDocumento(tipo)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">{TIPO_LABELS[tipo]}</p>
                    {!disponivel && motivo && (
                      <p className="text-xs text-muted-foreground">{motivo}</p>
                    )}
                  </div>
                </div>
                {gerando && tipoSelecionado === tipo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : disponivel ? (
                  <Badge variant="secondary" className="text-xs">Gerar</Badge>
                ) : null}
              </Button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={imprimirDocumento} className="gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={baixarHtml} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Baixar HTML
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setHtmlDoc(null); setTipoSelecionado(null); }} className="gap-1.5 ml-auto">
                ← Voltar
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden bg-background" style={{ height: "60vh" }}>
              <iframe
                srcDoc={htmlDoc}
                className="w-full h-full"
                title={tituloDoc}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {!htmlDoc && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
