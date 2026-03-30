import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, Link2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

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
  const [periodoRef, setPeriodoRef] = useState("");

  const resetForm = () => {
    setTipo("documento");
    setTitulo("");
    setDescricao("");
    setLinkExterno("");
    setPeriodoRef("");
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast.error("Informe o título da evidência");
      return;
    }
    await onSave({
      meta_id: metaId,
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      link_externo: linkExterno.trim() || undefined,
      periodo_referencia: periodoRef || undefined,
    });
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
            <Input type="month" value={periodoRef} onChange={e => setPeriodoRef(e.target.value)} />
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
        {(tipo === "link" || tipo === "documento") && (
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Link2 className="h-3 w-3" /> {tipo === "link" ? "URL" : "URL do Arquivo"}
            </Label>
            <Input value={linkExterno} onChange={e => setLinkExterno(e.target.value)} placeholder="https://..." />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving} className="gap-1">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
