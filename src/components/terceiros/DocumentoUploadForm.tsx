import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, FileUp, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { TIPOS_DOCUMENTO_EMPRESA, TIPOS_DOCUMENTO_TRABALHADOR } from "@/types/terceiros";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (params: {
    file: File;
    terceiro_id: string;
    trabalhador_id?: string;
    tipo: string;
    nome: string;
    data_emissao?: string;
    data_validade?: string;
    observacoes?: string;
  }) => Promise<void>;
  terceiroId: string;
  trabalhadorId?: string;
  isPending?: boolean;
}

export function DocumentoUploadForm({ open, onOpenChange, onSubmit, terceiroId, trabalhadorId, isPending }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState("");
  const [nome, setNome] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const tipos = trabalhadorId ? TIPOS_DOCUMENTO_TRABALHADOR : TIPOS_DOCUMENTO_EMPRESA;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleSubmit = async () => {
    if (!file || !tipo) return;
    await onSubmit({
      file,
      terceiro_id: terceiroId,
      trabalhador_id: trabalhadorId,
      tipo,
      nome: nome || tipo,
      data_emissao: dataEmissao || undefined,
      data_validade: dataValidade || undefined,
      observacoes: observacoes || undefined,
    });
    setFile(null);
    setTipo("");
    setNome("");
    setDataEmissao("");
    setDataValidade("");
    setObservacoes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload de Documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome do Documento</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipo || "Ex: PGR 2025"} />
          </div>

          {/* Drag-and-drop area */}
          <div>
            <Label>Arquivo *</Label>
            {file ? (
              <div className="flex items-center gap-2 p-3 mt-1 rounded-lg border bg-muted/50">
                <FileUp className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {isDragActive
                    ? "Solte o arquivo aqui..."
                    : "Arraste e solte ou clique para selecionar"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, JPG, PNG</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>
            <div>
              <Label>Data de Validade</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!file || !tipo || isPending}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
