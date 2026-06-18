import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentos, TIPOS_DOCUMENTO } from "@/hooks/useDocumentos";
import { useDocumentoPastas } from "@/hooks/useDocumentoPastas";
import { useColaboradores } from "@/hooks/useColaboradores";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const formSchema = z.object({
  colaboradorId: z.string().optional(),
  tipo: z.string().min(1, "Selecione um tipo"),
  dataValidade: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DocumentoUploadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedColaboradorId?: string;
  colaboradorObrigatorio?: boolean;
  documentoExistenteId?: string;
  pastaId?: string;
}

export function DocumentoUploadForm({ open, onOpenChange, preSelectedColaboradorId, colaboradorObrigatorio = false, documentoExistenteId, pastaId }: DocumentoUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { upload, uploading } = useDocumentos();
  const { colaboradores } = useColaboradores();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      colaboradorId: preSelectedColaboradorId || "",
      tipo: "",
      dataValidade: "",
      observacoes: "",
    },
  });

  // Atualizar quando preSelectedColaboradorId mudar
  const { setValue } = form;
  if (preSelectedColaboradorId && form.getValues("colaboradorId") !== preSelectedColaboradorId) {
    setValue("colaboradorId", preSelectedColaboradorId);
  }

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
      form.setError("root", { message: "Arquivo muito grande. Máximo 50MB." });
      return;
    }
    
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      form.setError("root", { message: "Tipo de arquivo não suportado. Use PDF, imagens ou documentos Word." });
      return;
    }
    
    setSelectedFile(file);
    form.clearErrors("root");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedFile) {
      form.setError("root", { message: "Selecione um arquivo para enviar" });
      return;
    }

    const colaborador = data.colaboradorId
      ? colaboradores.find((c) => c.id === data.colaboradorId)
      : undefined;

    // Colaborador é sempre opcional — o usuário pode anexar por pasta
    // (documento da empresa) ou vincular a um colaborador, conforme preferir.


    try {
      await upload({
        file: selectedFile,
        colaboradorNome: colaborador?.nome_completo || "Documento da empresa",
        colaboradorCpf: colaborador?.cpf,
        colaboradorId: colaborador?.id,
        tipo: data.tipo,
        dataValidade: data.dataValidade || undefined,
        observacoes: data.observacoes || undefined,
        documentoExistenteId: documentoExistenteId,
        motivoRevisao: documentoExistenteId ? "Nova versão enviada pelo usuário" : undefined,
        pastaId: pastaId,
      });
      
      // Reset form
      form.reset();
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload de Documento</DialogTitle>
          <DialogDescription>
            Selecione um arquivo e preencha as informações do documento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Drop Zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                selectedFile && "border-success bg-success/5"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              
              {selectedFile ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-success/10 shrink-0">
                    <FileText className="w-6 h-6 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF, imagens ou documentos Word (máx. 50MB)
                  </p>
                </div>
              )}
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <FormField
              control={form.control}
              name="colaboradorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Colaborador {colaboradorObrigatorio ? "(recomendado)" : "(opcional)"}
                  </FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Documento da empresa (sem colaborador)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Documento da empresa (sem colaborador)</SelectItem>
                      {colaboradores.map((colab) => (
                        <SelectItem key={colab.id} value={colab.id}>
                          {colab.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Documento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataValidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Validade</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações opcionais..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!selectedFile || uploading}>
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Documento
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
