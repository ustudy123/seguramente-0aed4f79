import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Route } from "lucide-react";
import { TIPOS_TREINAMENTO } from "@/types/terceiros";
import { useTrilhas } from "@/hooks/useTrilhas";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (params: {
    file?: File;
    terceiro_id: string;
    trabalhador_id: string;
    tipo: string;
    descricao?: string;
    data_realizacao?: string;
    carga_horaria?: number;
    data_validade?: string;
    trilha_id?: string;
  }) => Promise<void>;
  terceiroId: string;
  trabalhadorId: string;
  isPending?: boolean;
}

export function TreinamentoForm({ open, onOpenChange, onSubmit, terceiroId, trabalhadorId, isPending }: Props) {
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataRealizacao, setDataRealizacao] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!tipo) return;
    await onSubmit({
      file: file || undefined,
      terceiro_id: terceiroId,
      trabalhador_id: trabalhadorId,
      tipo,
      descricao: descricao || undefined,
      data_realizacao: dataRealizacao || undefined,
      carga_horaria: cargaHoraria ? parseInt(cargaHoraria) : undefined,
      data_validade: dataValidade || undefined,
    });
    setTipo("");
    setDescricao("");
    setDataRealizacao("");
    setCargaHoraria("");
    setDataValidade("");
    setFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Treinamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de Treinamento *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_TREINAMENTO.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Data Realização</Label>
              <Input type="date" value={dataRealizacao} onChange={(e) => setDataRealizacao(e.target.value)} />
            </div>
            <div>
              <Label>Carga Horária (h)</Label>
              <Input type="number" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} />
            </div>
            <div>
              <Label>Validade</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Certificado (anexo)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!tipo || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
