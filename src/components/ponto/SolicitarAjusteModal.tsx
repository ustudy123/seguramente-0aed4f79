import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabasePublic } from "@/lib/supabasePublic";
import { Loader2, Paperclip, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string;
  colaboradorNome: string;
}

const MAX_FILE_MB = 5;
const MAX_FILES = 3;

export function SolicitarAjusteModal({ open, onOpenChange, token, colaboradorNome }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [motivo, setMotivo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setData(today); setHora(""); setTipo("entrada"); setMotivo(""); setFiles([]); setDone(false);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const validos: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name}: ultrapassa ${MAX_FILE_MB}MB.`);
        continue;
      }
      validos.push(f);
    }
    const final = [...files, ...validos].slice(0, MAX_FILES);
    setFiles(final);
  };

  const handleSubmit = async () => {
    if (motivo.trim().length < 5) { toast.error("Justificativa precisa ter ao menos 5 caracteres."); return; }
    if (!hora) { toast.error("Informe a hora aproximada da marcação."); return; }
    setEnviando(true);
    try {
      // Upload anexos
      const anexos: { path: string; nome: string; tamanho: number }[] = [];
      for (const f of files) {
        const path = `externo/${token}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabasePublic.storage.from("ponto-ajustes-anexos").upload(path, f);
        if (upErr) { toast.error(`Falha no upload de ${f.name}: ${upErr.message}`); setEnviando(false); return; }
        anexos.push({ path, nome: f.name, tamanho: f.size });
      }

      const { data: resp, error } = await supabasePublic.rpc("solicitar_ajuste_ponto_externo", {
        p_token: token,
        p_tipo_marcacao: tipo,
        p_data_referencia: data,
        p_hora_solicitada: `${hora}:00`,
        p_motivo: motivo.trim(),
        p_anexos: anexos as any,
      });
      if (error) { toast.error(error.message); setEnviando(false); return; }
      const r = resp as any;
      if (r?.error) { toast.error(r.error); setEnviando(false); return; }
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar solicitação.");
    }
    setEnviando(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
            <DialogTitle>Solicitação enviada!</DialogTitle>
            <DialogDescription>
              Seu pedido de ajuste foi registrado e ficará pendente para aprovação do gestor.
            </DialogDescription>
            <Button onClick={() => { onOpenChange(false); reset(); }} className="w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Solicitar Ajuste de Ponto</DialogTitle>
              <DialogDescription>
                Use este formulário se não conseguiu registrar o ponto (sem internet, esquecimento, problema no app).
                O gestor analisará sua solicitação.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={data} max={today} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Hora aproximada</Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Tipo de Marcação</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Justificativa *</Label>
                <Textarea
                  rows={3}
                  placeholder="Ex.: Sem sinal de internet no momento da entrada."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{motivo.length}/500</p>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><Paperclip className="w-3 h-3" /> Anexos (opcional, até {MAX_FILES} arquivos de {MAX_FILE_MB}MB)</Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={files.length >= MAX_FILES}
                />
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs bg-muted/50 px-2 py-1 rounded">
                        <span className="truncate max-w-[220px]">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={enviando}>
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Solicitação"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
