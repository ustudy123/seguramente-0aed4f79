import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Anexo {
  nome: string;
  url: string;
  tamanho: number;
  tipo: string;
}

interface AnexoUploadProps {
  anexos: File[];
  onAnexosChange: (anexos: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // em bytes
  disabled?: boolean;
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

export function AnexoUpload({
  anexos,
  onAnexosChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
}: AnexoUploadProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map((f) => {
          if (f.errors[0]?.code === "file-too-large") {
            return `${f.file.name} excede o tamanho máximo de ${formatFileSize(maxSize)}`;
          }
          return f.errors[0]?.message || "Arquivo inválido";
        });
        setError(errors.join(". "));
        return;
      }

      const totalFiles = anexos.length + acceptedFiles.length;
      if (totalFiles > maxFiles) {
        setError(`Máximo de ${maxFiles} arquivos permitidos`);
        return;
      }

      onAnexosChange([...anexos, ...acceptedFiles]);
    },
    [anexos, maxFiles, maxSize, onAnexosChange]
  );

  const removeAnexo = (index: number) => {
    const newAnexos = anexos.filter((_, i) => i !== index);
    onAnexosChange(newAnexos);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    disabled: disabled || anexos.length >= maxFiles,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/plain": [".txt"],
    },
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50",
          (disabled || anexos.length >= maxFiles) && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm text-primary">Solte os arquivos aqui...</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Arraste arquivos ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Máx. {maxFiles} arquivos, {formatFileSize(maxSize)} cada
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {anexos.length > 0 && (
        <div className="space-y-2">
          {anexos.map((file, index) => {
            const FileIcon = getFileIcon(file.type);
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAnexo(index)}
                  disabled={disabled}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
