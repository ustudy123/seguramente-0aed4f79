import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
import { useSSTDocumentos } from "@/hooks/useSSTDocumentos";

const TIPOS_DOCUMENTO = [
  { value: "PGR", label: "PGR — Programa de Gerenciamento de Riscos" },
  { value: "PCMSO", label: "PCMSO — Programa de Controle Médico" },
  { value: "LTCAT", label: "LTCAT — Laudo Técnico Condições Ambientais" },
  { value: "AEP", label: "AEP — Análise Ergonômica Preliminar" },
  { value: "AET", label: "AET — Análise Ergonômica do Trabalho" },
  { value: "PPRA", label: "PPRA — Programa Prevenção Riscos (Legado)" },
  { value: "OUTROS", label: "Outros" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SSTUploadModal({ open, onOpenChange }: Props) {
  const { uploadDocumento } = useSSTDocumentos();
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataVigencia, setDataVigencia] = useState("");
  const [profissional, setProfissional] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = async () => {
    if (!file || !tipo) return;

    await uploadDocumento.mutateAsync({
      file,
      tipo,
      data_emissao: dataEmissao || undefined,
      data_vigencia: dataVigencia || undefined,
      profissional_responsavel: profissional || undefined,
      empresa_emissora: empresa || undefined,
      observacoes: observacoes || undefined,
    });

    // Reset
    setFile(null);
    setTipo("");
    setDataEmissao("");
    setDataVigencia("");
    setProfissional("");
    setEmpresa("");
    setObservacoes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload de Documento SST</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo de Documento *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Arquivo *</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground mt-1">PDF, Word ou imagem (max 20MB)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
            </div>
            <div>
              <Label>Data de Vigência</Label>
              <Input type="date" value={dataVigencia} onChange={e => setDataVigencia(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Profissional Responsável</Label>
            <Input placeholder="Ex: Eng. Carlos Silva" value={profissional} onChange={e => setProfissional(e.target.value)} />
          </div>

          <div>
            <Label>Empresa Emissora</Label>
            <Input placeholder="Ex: Safety Corp" value={empresa} onChange={e => setEmpresa(e.target.value)} />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea placeholder="Observações opcionais..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!file || !tipo || uploadDocumento.isPending}>
              {uploadDocumento.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Enviar Documento</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
