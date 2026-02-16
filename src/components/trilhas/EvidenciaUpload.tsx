import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EvidenciaUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  "image/*": [".jpg", ".jpeg", ".png", ".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(file: File) {
  if (file.type.startsWith("image/")) return Image;
  if (file.type === "application/pdf") return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenciaUpload({ file, onFileChange, disabled }: EvidenciaUploadProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFileChange(accepted[0]);
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      if (err?.code === "file-too-large") {
        alert("Arquivo muito grande. Máximo: 10MB");
      } else {
        alert("Tipo de arquivo não suportado. Use: JPG, PNG, PDF ou DOC.");
      }
    },
  });

  if (file) {
    const Icon = getFileIcon(file);
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onFileChange(null)}
          disabled={disabled}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-accent/30",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">
        {isDragActive ? "Solte o arquivo aqui..." : "Arraste um arquivo ou clique para selecionar"}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        JPG, PNG, PDF ou DOC — máx. 10MB
      </p>
    </div>
  );
}
