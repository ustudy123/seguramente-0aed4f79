import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2, Printer, Send, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
import type { ContratoExperiencia } from "@/hooks/useContratosExperiencia";
import { getDuracaoTotal } from "@/hooks/useContratosExperiencia";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";

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
  const { user, profile, tenantId } = useAuth();

  // Assinatura state
  const [showAssinaturaForm, setShowAssinaturaForm] = useState(false);
  const [signatarioNome, setSignatarioNome] = useState("");
  const [signatarioPapel, setSignatarioPapel] = useState("colaborador");
  const [signatarioEmail, setSignatarioEmail] = useState("");
  const [enviandoLink, setEnviandoLink] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const tiposDisponiveis: { tipo: TipoDocumento; disponivel: boolean; motivo?: string }[] = [
    { tipo: "contrato", disponivel: true },
    { tipo: "prorrogacao", disponivel: contrato.prorrogado, motivo: "Contrato não foi prorrogado" },
    { tipo: "efetivacao", disponivel: contrato.status === "efetivado", motivo: "Contrato não foi efetivado" },
    { tipo: "rescisao", disponivel: contrato.status === "encerrado", motivo: "Contrato não foi encerrado" },
  ];

  const gerarDocumento = async (tipo: TipoDocumento) => {
    setGerando(true);
    setTipoSelecionado(tipo);
    setHtmlDoc(null);

    try {
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

      const dados = { ...contrato, ...empresaDados, duracao_total: getDuracaoTotal(contrato) };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        getSupabaseFunctionUrl("ai-experiencia-doc"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
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

  const enviarParaAssinatura = async () => {
    if (!signatarioNome.trim()) {
      toast.error("Informe o nome do signatário.");
      return;
    }
    if (!tenantId) {
      toast.error("Tenant não encontrado.");
      return;
    }

    setEnviandoLink(true);
    try {
      const { data, error } = await fromTable("experiencia_assinatura_links")
        .insert({
          tenant_id: tenantId,
          contrato_id: contrato.id,
          signatario_nome: signatarioNome.trim(),
          signatario_papel: signatarioPapel,
          signatario_email: signatarioEmail.trim() || null,
          tipo_documento: tipoSelecionado || "contrato",
          documento_html: htmlDoc,
          status: "pendente",
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
        } as any)
        .select("token")
        .single();

      if (error) throw error;

      const token = (data as any)?.token;
      if (token) {
        const url = `${window.location.origin}/experiencia-assinatura/${token}`;
        setLinkGerado(url);
        toast.success("Link de assinatura gerado com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar link de assinatura.");
    } finally {
      setEnviandoLink(false);
    }
  };

  const copiarLink = () => {
    if (!linkGerado) return;
    navigator.clipboard.writeText(linkGerado);
    setCopiado(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleClose = () => {
    setHtmlDoc(null);
    setTipoSelecionado(null);
    setShowAssinaturaForm(false);
    setLinkGerado(null);
    setSignatarioNome("");
    setSignatarioEmail("");
    setSignatarioPapel("colaborador");
    setCopiado(false);
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
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={imprimirDocumento} className="gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={baixarHtml} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Baixar HTML
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setShowAssinaturaForm(true);
                  setSignatarioNome(contrato.colaborador_nome);
                }}
                className="gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Enviar p/ Assinatura
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setHtmlDoc(null); setTipoSelecionado(null); setShowAssinaturaForm(false); setLinkGerado(null); }} className="gap-1.5 ml-auto">
                ← Voltar
              </Button>
            </div>

            {/* Formulário de assinatura */}
            {showAssinaturaForm && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                {!linkGerado ? (
                  <>
                    <p className="text-sm font-medium">Enviar para assinatura digital</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome do signatário</Label>
                        <Input
                          value={signatarioNome}
                          onChange={(e) => setSignatarioNome(e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Papel</Label>
                        <select
                          value={signatarioPapel}
                          onChange={(e) => setSignatarioPapel(e.target.value)}
                          className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                        >
                          <option value="colaborador">Colaborador</option>
                          <option value="empregador">Empregador</option>
                          <option value="testemunha_1">Testemunha 1</option>
                          <option value="testemunha_2">Testemunha 2</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">E-mail (opcional)</Label>
                      <Input
                        type="email"
                        value={signatarioEmail}
                        onChange={(e) => setSignatarioEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={enviarParaAssinatura} disabled={enviandoLink} className="gap-1.5">
                        {enviandoLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Gerar Link de Assinatura
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAssinaturaForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-600" />
                      <p className="text-sm font-medium">Link gerado para <strong>{signatarioNome}</strong> ({signatarioPapel})</p>
                    </div>
                    <div className="flex gap-2">
                      <Input readOnly value={linkGerado} className="text-xs font-mono" />
                      <Button size="sm" variant="outline" onClick={copiarLink} className="gap-1 shrink-0">
                        {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiado ? "Copiado" : "Copiar"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Envie este link para o signatário. O link expira em 7 dias.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLinkGerado(null);
                        setSignatarioNome(contrato.colaborador_nome);
                        setSignatarioPapel("colaborador");
                        setSignatarioEmail("");
                      }}
                      className="text-xs"
                    >
                      + Gerar outro link (outra parte)
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="border rounded-lg overflow-hidden bg-background" style={{ height: showAssinaturaForm ? "40vh" : "60vh" }}>
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
