import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  Plus, FileText, Link2, Loader2, Upload, CalendarIcon, X, Image as ImageIcon, File
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MetaEvidenciaFormProps {
  metaId: string;
  onSave: (data: {
    meta_id: string;
    tipo: string;
    titulo?: string;
    descricao?: string;
    arquivo_url?: string;
    arquivo_nome?: string;
    link_externo?: string;
    periodo_referencia?: string;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function MetaEvidenciaForm({ metaId, onSave, isSaving }: MetaEvidenciaFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("documento");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [linkExterno, setLinkExterno] = useState("");
  const [periodoRef, setPeriodoRef] = useState<Date | undefined>(new Date());
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTipo("documento");
    setTitulo("");
    setDescricao("");
    setLinkExterno("");
    setPeriodoRef(new Date());
    setFile(null);
    setShowForm(false);
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!titulo) {
        setTitulo(e.target.files[0].name.split(".")[0]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título da evidência");
      return;
    }

    let arquivoUrl = undefined;
    let arquivoNome = undefined;

    if (file) {
      setIsUploading(true);
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `metas/evidencias/${metaId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        arquivoUrl = filePath;
        arquivoNome = file.name;
      } catch (error: any) {
        toast.error("Erro ao fazer upload do arquivo: " + error.message);
        setIsUploading(false);
        return;
      }
    }

    await onSave({
      meta_id: metaId,
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      link_externo: linkExterno.trim() || undefined,
      arquivo_url: arquivoUrl,
      arquivo_nome: arquivoNome,
      periodo_referencia: periodoRef ? format(periodoRef, "yyyy-MM") : undefined,
    });
    
    setIsUploading(false);
    resetForm();
  };

  if (!showForm) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
        <Plus className="h-4 w-4" /> Adicionar Evidência
      </Button>
    );
  }

  return (
    <Card className="border-dashed border-primary/30">
      <CardContent className="p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> Nova Evidência
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="relatorio">Relatório</SelectItem>
                <SelectItem value="planilha">Planilha</SelectItem>
                <SelectItem value="imagem">Imagem</SelectItem>
                <SelectItem value="link">Link Externo</SelectItem>
                <SelectItem value="texto">Texto/Comentário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Período de Referência</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !periodoRef && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {periodoRef ? format(periodoRef, "MMMM 'de' yyyy", { locale: ptBR }) : <span>Selecione o mês</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={periodoRef}
                  onSelect={setPeriodoRef}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Título *</Label>
          <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Relatório mensal de acidentes" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Detalhes sobre a evidência..." />
        </div>

        {tipo === "link" ? (
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Link2 className="h-3 w-3" /> URL do Link Externo
            </Label>
            <Input value={linkExterno} onChange={e => setLinkExterno(e.target.value)} placeholder="https://..." />
          </div>
        ) : tipo !== "texto" ? (
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              {tipo === "imagem" ? <ImageIcon className="h-3 w-3" /> : <File className="h-3 w-3" />}
              Arquivo da Evidência
            </Label>
            
            <div className="flex flex-col gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept={tipo === "imagem" ? "image/*" : undefined}
              />
              
              {!file ? (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-dashed h-20 flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique para selecionar ou arraste o arquivo</span>
                </Button>
              ) : (
                <div className="flex items-center justify-between p-2 bg-accent/50 rounded-md border">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {tipo === "imagem" ? <ImageIcon className="h-4 w-4 shrink-0" /> : <File className="h-4 w-4 shrink-0" />}
                    <span className="text-xs truncate font-medium">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <Separator className="flex-1" />
                <span className="text-[10px] text-muted-foreground uppercase">ou informe uma URL</span>
                <Separator className="flex-1" />
              </div>

              <div className="space-y-1">
                <Input 
                  value={linkExterno} 
                  onChange={e => setLinkExterno(e.target.value)} 
                  placeholder="Se preferir, cole o link direto do arquivo aqui" 
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving || isUploading} className="gap-1">
            {isSaving || isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? "Enviando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
