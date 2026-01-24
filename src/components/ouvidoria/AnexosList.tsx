import { FileText, Image, File, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { AnexoManifestacao } from "@/types/ouvidoria";

interface AnexosListProps {
  anexos: AnexoManifestacao[];
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileIcon = (tipo: string) => {
  if (tipo.startsWith("image/")) return Image;
  if (tipo.includes("pdf") || tipo.includes("document")) return FileText;
  return File;
};

export function AnexosList({ anexos }: AnexosListProps) {
  if (!anexos || anexos.length === 0) return null;

  const handleDownload = async (anexo: AnexoManifestacao) => {
    try {
      const { data, error } = await supabase.storage
        .from("ouvidoria-anexos")
        .createSignedUrl(anexo.url, 60); // URL válida por 60 segundos

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Erro ao baixar anexo:", error);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Anexos ({anexos.length})</p>
      <div className="grid gap-2">
        {anexos.map((anexo, index) => {
          const FileIcon = getFileIcon(anexo.tipo);
          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{anexo.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(anexo.tamanho)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(anexo)}
                className="shrink-0"
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
