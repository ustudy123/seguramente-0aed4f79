import { useState, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, FileText, X, Check, ChevronsUpDown } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDocumentos, TIPOS_DOCUMENTO } from "@/hooks/useDocumentos";
import { useDocumentoPastas } from "@/hooks/useDocumentoPastas";
import { useColaboradores } from "@/hooks/useColaboradores";
import { cn } from "@/lib/utils";

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
  pastaId: z.string().min(1, "Selecione uma pasta ou subpasta"),
  tipo: z.string().min(1, "Informe um tipo"),
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

export function DocumentoUploadForm({ open, onOpenChange, preSelectedColaboradorId, documentoExistenteId, pastaId }: DocumentoUploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pastaOpen, setPastaOpen] = useState(false);
  const [tipoOpen, setTipoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading } = useDocumentos();
  const { colaboradores } = useColaboradores();
  const { pastas } = useDocumentoPastas();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pastaId: pastaId || "",
      tipo: "",
      dataValidade: "",
      observacoes: "",
    },
  });

  // Lista achatada de pastas com indentação por nível
  const pastasFlat = useMemo(() => {
    const byParent = new Map<string | null, typeof pastas>();
    pastas.forEach((p) => {
      const key = p.pasta_pai_id;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(p);
    });
    byParent.forEach((arr) =>
      arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome))
    );
    const out: Array<{ id: string; label: string; depth: number; path: string }> = [];
    const walk = (parentId: string | null, depth: number, parentPath: string) => {
      (byParent.get(parentId) || []).forEach((p) => {
        const path = parentPath ? `${parentPath} / ${p.nome}` : p.nome;
        out.push({ id: p.id, label: p.nome, depth, path });
        walk(p.id, depth + 1, path);
      });
    };
    walk(null, 0, "");
    return out;
  }, [pastas]);

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

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    form.clearErrors("root");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

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
    const colaborador = preSelectedColaboradorId
      ? colaboradores.find((c) => c.id === preSelectedColaboradorId)
      : undefined;

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
        pastaId: data.pastaId || pastaId || undefined,
      });
      form.reset();
      setSelectedFile(null);
      onOpenChange(false);
    } catch {
      // handled by mutation
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedFile(null);
    onOpenChange(false);
  };

  const selectedPasta = pastasFlat.find((p) => p.id === form.watch("pastaId"));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Upload de Documento</DialogTitle>
          <DialogDescription>
            Selecione um arquivo e preencha as informações do documento.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0">

            {/* Drop Zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 transition-colors",
                !selectedFile && "cursor-pointer",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                selectedFile && "border-success bg-success/5"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => { if (!selectedFile) fileInputRef.current?.click(); }}
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
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={handleRemoveFile}
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

            {/* Pasta combobox com busca */}
            <FormField
              control={form.control}
              name="pastaId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Pasta / Subpasta *</FormLabel>
                  <Popover open={pastaOpen} onOpenChange={setPastaOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={cn("justify-between font-normal", !field.value && "text-muted-foreground")}
                        >
                          <span className="truncate">
                            {selectedPasta ? selectedPasta.path : "Selecione uma pasta"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar pasta..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma pasta encontrada.</CommandEmpty>
                          <CommandGroup>
                            {pastasFlat.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.path}
                                onSelect={() => { field.onChange(p.id); setPastaOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", field.value === p.id ? "opacity-100" : "opacity-0")} />
                                <span style={{ paddingLeft: `${p.depth * 12}px` }}>
                                  {p.depth > 0 ? "└ " : ""}{p.label}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Tipo: combobox com digitação livre */}
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tipo de Documento *</FormLabel>
                    <Popover open={tipoOpen} onOpenChange={setTipoOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className={cn("justify-between font-normal", !field.value && "text-muted-foreground")}
                          >
                            <span className="truncate">{field.value || "Selecione ou digite"}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Buscar ou digitar tipo..."
                            value={field.value}
                            onValueChange={(v) => field.onChange(v)}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {field.value ? (
                                <button
                                  type="button"
                                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                                  onClick={() => setTipoOpen(false)}
                                >
                                  Usar "{field.value}"
                                </button>
                              ) : (
                                "Digite um tipo..."
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              {TIPOS_DOCUMENTO.map((tipo) => (
                                <CommandItem
                                  key={tipo}
                                  value={tipo}
                                  onSelect={() => { field.onChange(tipo); setTipoOpen(false); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", field.value === tipo ? "opacity-100" : "opacity-0")} />
                                  {tipo}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                    <Textarea placeholder="Observações opcionais..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
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
