import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  History,
  Download,
  RotateCcw,
  Loader2,
  FileText,
  Clock,
  User,
  Upload,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Documento, DocumentoVersao } from "@/hooks/useDocumentos";
import { useDocumentos } from "@/hooks/useDocumentos";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documento: Documento | null;
  onNovaVersao: (doc: Documento) => void;
}

export function DocumentoVersoesModal({ open, onOpenChange, documento, onNovaVersao }: Props) {
  const [versoes, setVersoes] = useState<DocumentoVersao[]>([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);

  const { getVersoes, restaurarVersao, restaurando, getSignedUrl } = useDocumentos();

  useEffect(() => {
    if (open && documento) {
      setLoadingVersoes(true);
      getVersoes(documento.id)
        .then(setVersoes)
        .finally(() => setLoadingVersoes(false));
    }
  }, [open, documento]);

  const handleDownloadVersao = async (storagePath: string, nome: string) => {
    const url = await getSignedUrl(storagePath);
    if (!url) return;
    const resp = await fetch(url);
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleRestaurar = async (versao: DocumentoVersao) => {
    if (!documento) return;
    setRestaurandoId(versao.id);
    try {
      await restaurarVersao({ documentoId: documento.id, versao });
      const novas = await getVersoes(documento.id);
      setVersoes(novas);
    } finally {
      setRestaurandoId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (!documento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Versões
          </DialogTitle>
        </DialogHeader>

        {/* Versão atual */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground text-xs">
                v{documento.versao_atual} — Atual
              </Badge>
              <span className="text-sm font-medium truncate max-w-[260px]">{documento.nome_original}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNovaVersao(documento)}
              className="text-xs h-7 gap-1"
            >
              <Upload className="w-3 h-3" />
              Nova Versão
            </Button>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{formatSize(documento.tamanho)}</span>
            {documento.criado_por_nome && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{documento.criado_por_nome}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(documento.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Versões Anteriores ({versoes.length})
          </p>

          {loadingVersoes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : versoes.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma versão anterior registrada.
              <br />
              <span className="text-xs">Ao fazer upload de um novo arquivo, a versão atual será preservada aqui.</span>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2 pr-1">
                {versoes.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border bg-muted/20 p-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] shrink-0">v{v.versao}</Badge>
                        <span className="text-xs font-medium truncate">{v.nome_original}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span>{formatSize(v.tamanho)}</span>
                        {v.criado_por_nome && <span>{v.criado_por_nome}</span>}
                        <span>{formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                      {v.motivo_revisao && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">{v.motivo_revisao}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Download"
                        onClick={() => handleDownloadVersao(v.storage_path, v.nome_original)}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7", restaurandoId === v.id && "opacity-50")}
                        title="Restaurar esta versão"
                        disabled={restaurando}
                        onClick={() => handleRestaurar(v)}
                      >
                        {restaurandoId === v.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
