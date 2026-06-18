import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  FileCheck,
  Clock,
  FileWarning,
  MoreHorizontal,
  Download,
  Eye,
  Trash2,
  GripVertical,
  Loader2,
  Upload,
  FolderOpen,
  FolderPlus,
  History,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentoPastaNode, DocumentoItem } from "@/types/documentoPasta";
import type { Documento } from "@/hooks/useDocumentos";
import { DocumentoVersoesModal } from "./DocumentoVersoesModal";
import { formatDateBR } from "@/lib/dataLocal";

const statusConfig = {
  valido: {
    label: "Válido",
    icon: FileCheck,
    style: "bg-success/10 text-success border-success/20",
  },
  vencendo: {
    label: "Vencendo",
    icon: Clock,
    style: "bg-warning/10 text-warning border-warning/20",
  },
  vencido: {
    label: "Vencido",
    icon: FileWarning,
    style: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

interface PastaDocumentosListProps {
  pasta: DocumentoPastaNode | null;
  onUpload: (pastaId: string) => void;
  onView: (doc: DocumentoItem) => void;
  onDownload: (doc: DocumentoItem) => void;
  onDelete: (doc: DocumentoItem) => void;
  onNovaVersao?: (doc: Documento) => void;
  deleting: boolean;
  onDragStart?: (documentoId: string, documentoNome: string, pastaOrigemId: string, pastaOrigemNome: string) => void;
  documentosCompletos?: Documento[];
}

export function PastaDocumentosList({
  pasta,
  onUpload,
  onView,
  onDownload,
  onDelete,
  onNovaVersao,
  deleting,
  onDragStart,
  documentosCompletos = [],
}: PastaDocumentosListProps) {
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [versoesDoc, setVersoesDoc] = useState<Documento | null>(null);

  if (!pasta) {
    return (
      <div className="flex-1 flex items-center justify-center bg-card rounded-xl border border-border">
        <div className="text-center py-12">
          <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Selecione uma pasta para ver os documentos
          </p>
        </div>
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleDragStart = (e: React.DragEvent, doc: DocumentoItem) => {
    e.dataTransfer.setData("documentoId", doc.id);
    e.dataTransfer.effectAllowed = "move";
    if (onDragStart) {
      onDragStart(doc.id, doc.nome_original, pasta.id, pasta.nome);
    }
  };

  const handleDelete = async (doc: DocumentoItem) => {
    setDeletingDocId(doc.id);
    try {
      await onDelete(doc);
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{pasta.nome}</h3>
            <p className="text-sm text-muted-foreground">
              {pasta.documentos.length} documento(s)
            </p>
          </div>
        </div>


      </div>

      {/* Documents list */}
      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {pasta.documentos.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum documento nesta pasta
              </p>
              <Button variant="outline" onClick={() => onUpload(pasta.id)}>
                <Upload className="w-4 h-4 mr-2" />
                Enviar Documento
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pasta.documentos.map((doc, index) => {
              const config = statusConfig[doc.status];
              const isDeleting = deletingDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, doc)}
                  className={cn(
                    "flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing",
                    isDeleting && "opacity-50 pointer-events-none"
                  )}
                  style={{ 
                    animation: `fadeIn 0.3s ease-out ${index * 0.03}s both`
                  }}
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <div className={cn("p-2 rounded-lg", config.style)}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {doc.nome_original}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{doc.tipo}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.tamanho)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {doc.data_validade && (
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-muted-foreground">Validade</p>
                        <p className="text-sm font-medium">
                          {formatDateBR(doc.data_validade)}
                        </p>
                      </div>
                    )}
                    <Badge className={cn("text-xs hidden sm:flex", config.style)}>
                      {config.label}
                    </Badge>
                    {(() => {
                      const docCompleto = documentosCompletos.find(d => d.id === doc.id);
                      return docCompleto && (docCompleto.total_versoes > 1) ? (
                        <Badge variant="outline" className="text-[10px] hidden sm:flex gap-1">
                          <History className="w-3 h-3" />
                          v{docCompleto.versao_atual}
                        </Badge>
                      ) : null;
                    })()}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(doc)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload(doc)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        {(() => {
                          const docCompleto = documentosCompletos.find(d => d.id === doc.id);
                          return docCompleto ? (
                            <>
                              <DropdownMenuItem onClick={() => setVersoesDoc(docCompleto)}>
                                <History className="w-4 h-4 mr-2" />
                                Versões {docCompleto.total_versoes > 1 ? `(${docCompleto.total_versoes})` : ""}
                              </DropdownMenuItem>
                            </>
                          ) : null;
                        })()}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(doc)}
                          disabled={deleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de versões */}
      <DocumentoVersoesModal
        open={!!versoesDoc}
        onOpenChange={(v) => !v && setVersoesDoc(null)}
        documento={versoesDoc}
        onNovaVersao={(doc) => {
          setVersoesDoc(null);
          onNovaVersao?.(doc);
        }}
      />
    </div>
  );
}
