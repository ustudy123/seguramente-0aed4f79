import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Printer, FileText, Send, CheckCircle2, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import type { Pdi, PdiCheckin, PdiFeedback } from "@/types/pdi";

interface PdiDocumentoModalProps {
  open: boolean;
  onClose: () => void;
  pdi: Pdi;
  checkins: PdiCheckin[];
  feedbacks: PdiFeedback[];
}

interface Signatario {
  nome: string;
  papel: string;
  papelLabel: string;
}

export function PdiDocumentoModal({ open, onClose, pdi, checkins, feedbacks }: PdiDocumentoModalProps) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [showSignaturePanel, setShowSignaturePanel] = useState(false);
  const [creatingLinks, setCreatingLinks] = useState(false);
  const [signatureLinks, setSignatureLinks] = useState<{ nome: string; papel: string; link: string }[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const handleGenerate = async () => {
    setLoading(true);
    setHtml("");
    setSaved(false);
    setStoragePath(null);
    setSignatureLinks([]);
    setShowSignaturePanel(false);
    try {
      const payload = {
        pdi: { ...pdi, checkins, feedbacks },
      };

      const { data, error } = await supabase.functions.invoke("ai-pdi-documento", { body: payload });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generatedHtml = data.html || "";
      setHtml(generatedHtml);

      if (generatedHtml) {
        await saveToDocumentos(generatedHtml);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar documento");
    } finally {
      setLoading(false);
    }
  };

  const saveToDocumentos = async (htmlContent: string) => {
    if (!tenantId || !user) {
      // Even without tenant, create a local storage path reference so signature button works
      return;
    }

    setSaving(true);
    try {
      const timestamp = Date.now();
      const safeColabName = pdi.colaborador_nome.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `pdi-${safeColabName}-${timestamp}.html`;
      const path = pdi.colaborador_id
        ? `${tenantId}/colaboradores/${pdi.colaborador_id}/${fileName}`
        : `${tenantId}/${fileName}`;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const file = new File([blob], fileName, { type: "text/html" });

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // Set storage path immediately after successful upload
      // so the signature button is enabled even if the documentos insert fails
      setStoragePath(path);

      // Try to save to documentos table (non-blocking for signature flow)
      try {
        let pastaId: string | null = null;
        if (pdi.colaborador_id) {
          // Try to find existing collaborator folder
          const { data: pastas } = await supabase
            .from("documento_pastas")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("colaborador_id", pdi.colaborador_id)
            .eq("tipo", "colaborador")
            .limit(1);

          if (pastas && pastas.length > 0) {
            pastaId = pastas[0].id;

            // Try to find year subfolder for better organization
            const ano = new Date().getFullYear();
            const { data: anoPastas } = await supabase
              .from("documento_pastas")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("pasta_pai_id", pastaId)
              .eq("tipo", "ano")
              .eq("ano", ano)
              .limit(1);

            if (anoPastas && anoPastas.length > 0) {
              pastaId = anoPastas[0].id;
            }
          }
        }

        const { error: docError } = await fromTable("documentos")
          .insert({
            tenant_id: tenantId,
            colaborador_id: pdi.colaborador_id || null,
            colaborador_nome: pdi.colaborador_nome,
            colaborador_cpf: null,
            nome_arquivo: path,
            nome_original: `PDI - ${pdi.titulo} - ${pdi.colaborador_nome}.html`,
            tipo: "PDI",
            tamanho: blob.size,
            mime_type: "text/html",
            storage_path: path,
            pasta_id: pastaId,
            status: "valido",
            observacoes: `Documento PDI gerado automaticamente. Período: ${pdi.data_inicio} a ${pdi.data_fim}`,
            criado_por: user.id,
            criado_por_nome: profile?.nome_completo,
          } as any);

        if (docError) {
          console.error("Erro ao registrar documento:", docError);
        } else {
          queryClient.invalidateQueries({ queryKey: ["documentos"] });
          queryClient.invalidateQueries({ queryKey: ["documentos-com-pasta"] });
        }
      } catch (docErr: any) {
        console.error("Erro ao registrar documento:", docErr);
      }

      setSaved(true);
      toast.success("Documento salvo na pasta do colaborador!");
    } catch (err: any) {
      console.error("Erro ao salvar documento:", err);
      toast.error("Erro ao salvar na pasta: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.print();
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pdi-${pdi.colaborador_nome.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSignatarios = (): Signatario[] => {
    const list: Signatario[] = [
      { nome: pdi.colaborador_nome, papel: "colaborador", papelLabel: "Colaborador(a)" },
    ];
    if (pdi.responsavel_nome) {
      list.push({ nome: pdi.responsavel_nome, papel: "lider", papelLabel: "Líder/Responsável" });
    }
    return list;
  };

  const handleCreateSignatureLinks = async () => {
    if (!tenantId || !user) return;

    setCreatingLinks(true);
    try {
      const signatarios = getSignatarios();
      const links: { nome: string; papel: string; link: string }[] = [];

      for (const sig of signatarios) {
        const { data, error } = await supabase
          .from("pdi_assinatura_links")
          .insert({
            tenant_id: tenantId,
            pdi_id: pdi.id,
            signatario_nome: sig.nome,
            signatario_papel: sig.papelLabel,
            documento_storage_path: storagePath,
            criado_por: user.id,
            criado_por_nome: profile?.nome_completo,
          } as any)
          .select("token")
          .single();

        if (error) throw error;

        const baseUrl = window.location.origin;
        links.push({
          nome: sig.nome,
          papel: sig.papelLabel,
          link: `${baseUrl}/pdi-assinatura/${(data as any).token}`,
        });
      }

      setSignatureLinks(links);
      toast.success("Links de assinatura criados!");
    } catch (err: any) {
      toast.error("Erro ao criar links: " + err.message);
    } finally {
      setCreatingLinks(false);
    }
  };

  const handleShareWhatsApp = (sigLink: { nome: string; papel: string; link: string }) => {
    const message = encodeURIComponent(
      `📝 *Assinatura PDI - ${pdi.titulo}*\n\n` +
      `Olá ${sigLink.nome}!\n\n` +
      `Você recebeu um Plano de Desenvolvimento Individual (PDI) para assinar digitalmente.\n\n` +
      `👤 Colaborador: ${pdi.colaborador_nome}\n` +
      `📅 Período: ${pdi.data_inicio} a ${pdi.data_fim}\n\n` +
      `Clique no link abaixo para visualizar e assinar:\n${sigLink.link}\n\n` +
      `⚠️ Este link é válido por 30 dias.`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  // Auto-generate on open
  useEffect(() => {
    if (open && !html && !loading) {
      handleGenerate();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="relative px-6 py-4 border-b flex-shrink-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
          <div className="relative flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white drop-shadow">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30">
                <FileText className="w-5 h-5" />
              </div>
              Documento PDI — {pdi.colaborador_nome}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {!loading && html && (
                <>
                  {saved && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Salvo
                    </span>
                  )}
                  {saving && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={handleGenerate}>
                    🔄 Regenerar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-1" /> Imprimir / PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-1" /> Baixar HTML
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (signatureLinks.length > 0) {
                        setShowSignaturePanel(!showSignaturePanel);
                      } else {
                        handleCreateSignatureLinks();
                        setShowSignaturePanel(true);
                      }
                    }}
                    disabled={creatingLinks || !storagePath}
                    className="gap-1.5"
                  >
                    {creatingLinks ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Enviar para Assinatura
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Main content */}
          <div className={`flex-1 overflow-hidden ${showSignaturePanel ? "border-r" : ""}`}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Gerando documento do PDI...</p>
                  <p className="text-sm text-muted-foreground mt-1">A IA está elaborando um documento completo e profissional. Isso pode levar até 1 minuto.</p>
                </div>
              </div>
            ) : html ? (
              <iframe
                ref={iframeRef}
                srcDoc={html}
                className="w-full h-full border-0"
                title="Documento PDI"
                sandbox="allow-same-origin allow-popups allow-scripts"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum conteúdo gerado.
              </div>
            )}
          </div>

          {/* Signature panel */}
          {showSignaturePanel && (
            <div className="w-80 flex-shrink-0 overflow-y-auto p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Enviar para Assinatura</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSignaturePanel(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Envie o link por WhatsApp para cada signatário. Eles poderão visualizar o documento e assinar digitalmente.
              </p>

              {creatingLinks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : signatureLinks.length > 0 ? (
                <div className="space-y-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 mb-2"
                    onClick={() => {
                      setSignatureLinks([]);
                      handleCreateSignatureLinks();
                    }}
                  >
                    🔄 Gerar novos links
                  </Button>
                  {signatureLinks.map((sl, idx) => (
                    <div key={idx} className="bg-background rounded-lg p-3 border space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{sl.nome}</p>
                        <p className="text-xs text-muted-foreground">{sl.papel}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => handleShareWhatsApp(sl)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar via WhatsApp
                      </Button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(sl.link);
                          toast.success("Link copiado!");
                        }}
                        className="text-xs text-primary hover:underline w-full text-center"
                      >
                        Copiar link
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Gerando links...
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center mt-4">
                ⏳ Links válidos por 30 dias
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
