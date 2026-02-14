import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
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
          <div>
            <Label>Arquivo *</Label>
            <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
