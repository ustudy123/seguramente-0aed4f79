import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Image, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface UploadedDoc {
  file: File;
  categoria: string;
  preview?: string;
}

interface DocCategory {
  id: string;
  label: string;
  descricao: string;
  obrigatorio: boolean;
  accept: string[];
  destaque?: boolean;
}

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "documento_pessoal",
    label: "Documento Pessoal (RG ou CNH)",
    descricao: "Documento com foto para confirmação de identidade",
    obrigatorio: true,
    accept: ["image/*", "application/pdf"],
  },
  {
    id: "cpf_comprovante",
    label: "CPF ou Cartão CNPJ",
    descricao: "Comprovante de CPF ou cartão CNPJ",
    obrigatorio: true,
    accept: ["image/*", "application/pdf"],
  },
  {
    id: "registro_conselho",
    label: "Carteira / Certidão do Conselho Profissional",
    descricao: "Documento emitido pelo conselho com nº de registro e validade (opcional)",
    obrigatorio: false,
    accept: ["image/*", "application/pdf"],
  },
  {
    id: "formacao",
    label: "Diploma ou Certificado de Formação",
    descricao: "Diploma de graduação, pós-graduação ou certificado de conclusão",
    obrigatorio: true,
    accept: ["image/*", "application/pdf"],
  },
  {
    id: "certificacao",
    label: "Certificações Complementares",
    descricao: "Certificados de cursos, especializações ou auditorias (opcional)",
    obrigatorio: false,
    accept: ["image/*", "application/pdf"],
  },
  {
    id: "comprovante_endereco",
    label: "Comprovante de Endereço",
    descricao: "Conta de luz, água ou correspondência recente",
    obrigatorio: false,
    accept: ["image/*", "application/pdf"],
  },
  {
    id: "atestado_capacidade_tecnica",
    label: "Atestado de Capacidade Técnica",
    descricao: "Comprova experiência no serviço. Profissionais com atestado são priorizados no ranking",
    obrigatorio: false,
    accept: ["image/*", "application/pdf"],
    destaque: true,
  },
];

interface DocumentUploadSectionProps {
  documents: UploadedDoc[];
  onChange: (docs: UploadedDoc[]) => void;
}

export function DocumentUploadSection({ documents, onChange }: DocumentUploadSectionProps) {
  const addFiles = useCallback(
    (files: File[], categoria: string) => {
      const newDocs = files.map((file) => ({
        file,
        categoria,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));
      onChange([...documents, ...newDocs]);
    },
    [documents, onChange]
  );

  const removeDoc = useCallback(
    (index: number) => {
      const updated = [...documents];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
      updated.splice(index, 1);
      onChange(updated);
    },
    [documents, onChange]
  );

  const getDocsForCategory = (catId: string) =>
    documents
      .map((d, i) => ({ ...d, originalIndex: i }))
      .filter((d) => d.categoria === catId);

  const missingRequired = DOC_CATEGORIES.filter(
    (c) => c.obrigatorio && getDocsForCategory(c.id).length === 0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-foreground">Documentos Comprobatórios</h4>
        {missingRequired.length > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {missingRequired.length} obrigatório(s) pendente(s)
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {DOC_CATEGORIES.map((cat) => {
          const catDocs = getDocsForCategory(cat.id);
          return (
            <CategoryUpload
              key={cat.id}
              category={cat}
              docs={catDocs}
              onAdd={(files) => addFiles(files, cat.id)}
              onRemove={(originalIndex) => removeDoc(originalIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}

function CategoryUpload({
  category,
  docs,
  onAdd,
  onRemove,
}: {
  category: DocCategory;
  docs: (UploadedDoc & { originalIndex: number })[];
  onAdd: (files: File[]) => void;
  onRemove: (originalIndex: number) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: category.accept.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: 10 * 1024 * 1024,
    onDrop: onAdd,
  });

  const hasFiles = docs.length > 0;

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${category.destaque ? "border-amber-300 bg-amber-50/50" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">
          {category.label}
        </span>
        {category.destaque && !hasFiles && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700">
            ⭐ Melhora ranking
          </Badge>
        )}
        {category.obrigatorio && (
          <Badge variant={hasFiles ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
            {hasFiles ? "✓" : "Obrigatório"}
          </Badge>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{category.descricao}</p>

      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map((doc) => (
            <div
              key={doc.originalIndex}
              className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs"
            >
              {doc.preview ? (
                <Image className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="max-w-[140px] truncate">{doc.file.name}</span>
              <button
                type="button"
                onClick={() => onRemove(doc.originalIndex)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border border-dashed rounded-md p-3 text-center cursor-pointer transition-colors text-xs ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
        <span className="text-muted-foreground">
          Arraste ou clique para enviar (máx. 10MB)
        </span>
      </div>
    </div>
  );
}

export { DOC_CATEGORIES };
