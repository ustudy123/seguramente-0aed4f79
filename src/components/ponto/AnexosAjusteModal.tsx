import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Image as ImageIcon, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PontoAjuste } from "@/hooks/usePonto";

interface Props {
  ajuste: PontoAjuste | null;
  onOpenChange: (open: boolean) => void;
}

interface AnexoComUrl {
  nome: string;
  url: string; // path no storage
  signedUrl?: string;
  tamanho: number;
  tipo: string;
  isImage: boolean;
}

export function AnexosAjusteModal({ ajuste, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [anexos, setAnexos] = useState<AnexoComUrl[]>([]);

  useEffect(() => {
    if (!ajuste) {
      setAnexos([]);
      return;
    }
    const lista = ajuste.anexos ?? [];
    if (lista.length === 0) {
      setAnexos([]);
      return;
    }

    setLoading(true);
    (async () => {
      const resolved: AnexoComUrl[] = [];
      for (const a of lista) {
        // Compat: envio externo grava `path`; interno grava `url` — aceita os dois.
        const storagePath = (a as any).url ?? (a as any).path ?? "";
        const tipo = a.tipo || "";
        const isImage = tipo.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|bmp)$/i.test(a.nome);
        let signedUrl: string | undefined;
        if (storagePath) {
          try {
            const { data, error } = await supabase.storage
              .from("ponto-ajustes-anexos")
              .createSignedUrl(storagePath, 60 * 60); // 1 hora
            if (error) console.error("Falha signed URL", storagePath, error);
            signedUrl = data?.signedUrl;
          } catch (e) {
            console.error("Erro ao gerar signed URL", storagePath, e);
          }
        }
        resolved.push({
          nome: a.nome,
          url: storagePath,
          tamanho: a.tamanho,
          tipo,
          isImage,
          signedUrl,
        });
      }
      setAnexos(resolved);
    })().finally(() => setLoading(false));
  }, [ajuste]);

  const formatBytes = (b: number) => {
    if (!b) return "0 B";
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const baixar = async (a: AnexoComUrl) => {
    if (!a.signedUrl) {
      toast.error("Não foi possível gerar o link do arquivo.");
      return;
    }
    try {
      const resp = await fetch(a.signedUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Erro ao baixar arquivo.");
    }
  };

  return (
    <Dialog open={!!ajuste} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anexos da Solicitação de Ajuste</DialogTitle>
          <DialogDescription>
            {ajuste && (
              <>
                Enviados por <strong>{ajuste.colaborador_nome}</strong> em{" "}
                {new Date(ajuste.created_at).toLocaleDateString("pt-BR")}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando anexos...
          </div>
        ) : anexos.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhum anexo enviado.
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {anexos.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border rounded-lg p-3 bg-muted/30"
              >
                <div className="shrink-0">
                  {a.isImage && a.signedUrl ? (
                    <a href={a.signedUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={a.signedUrl}
                        alt={a.nome}
                        className="w-20 h-20 object-cover rounded-md border"
                      />
                    </a>
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center bg-background rounded-md border">
                      {a.isImage ? (
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      ) : (
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium break-words">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(a.tamanho)} · {a.tipo || "arquivo"}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {a.signedUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(a.signedUrl, "_blank")}
                        className="h-8"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Visualizar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => baixar(a)}
                      className="h-8"
                      disabled={!a.signedUrl}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Baixar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Os anexos são armazenados de forma segura em bucket privado e os links expiram em 1 hora.
        </p>
      </DialogContent>
    </Dialog>
  );
}
