import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X } from "lucide-react";
import { ATIVIDADES_RISCO } from "@/types/terceiros";
import type { TerceiroTrabalhador } from "@/types/terceiros";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  terceiroId: string;
  trabalhadores: TerceiroTrabalhador[];
  onSubmit: (data: {
    terceiro_id: string;
    data_inicio: string;
    data_fim: string;
    local: string;
    atividade: string;
    descricao?: string;
    atividades_risco?: string[];
    observacoes?: string;
    trabalhador_ids: string[];
  }) => Promise<void>;
  isPending?: boolean;
}

export function PermissaoTrabalhoForm({ open, onOpenChange, terceiroId, trabalhadores, onSubmit, isPending }: Props) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [local, setLocal] = useState("");
  const [atividade, setAtividade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [riscos, setRiscos] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [selectedTrabs, setSelectedTrabs] = useState<string[]>([]);

  const toggleRisco = (r: string) =>
    setRiscos((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const toggleTrab = (id: string) =>
    setSelectedTrabs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!dataInicio || !dataFim || !local || !atividade || selectedTrabs.length === 0) return;
    await onSubmit({
      terceiro_id: terceiroId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      local,
      atividade,
      descricao: descricao || undefined,
      atividades_risco: riscos.length > 0 ? riscos : undefined,
      observacoes: observacoes || undefined,
      trabalhador_ids: selectedTrabs,
    });
    // Reset
    setDataInicio(""); setDataFim(""); setLocal(""); setAtividade("");
    setDescricao(""); setRiscos([]); setObservacoes(""); setSelectedTrabs([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Permissão de Trabalho</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início *</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim *</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Local *</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Área de produção, Galpão 3" />
          </div>

          <div>
            <Label>Atividade *</Label>
            <Input value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Ex: Manutenção elétrica preventiva" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>

          <div>
            <Label>Atividades de Risco</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ATIVIDADES_RISCO.map((r) => (
                <Badge
                  key={r}
                  variant={riscos.includes(r) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleRisco(r)}
                >
                  {r}
                  {riscos.includes(r) && <X className="w-3 h-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </div>

          {/* Trabalhadores selection */}
          <div>
            <Label>Trabalhadores Envolvidos *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Selecione os trabalhadores. O sistema validará automaticamente docs, treinamentos e ASO.
            </p>
            {trabalhadores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum trabalhador cadastrado neste terceiro.
              </p>
            ) : (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {trabalhadores.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTrabs.includes(t.id)}
                      onCheckedChange={() => toggleTrab(t.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.nome}</p>
                      <p className="text-xs text-muted-foreground">{t.funcao || "Sem função"}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        t.status === "liberado"
                          ? "text-green-700 border-green-300"
                          : t.status === "restrito"
                          ? "text-yellow-700 border-yellow-300"
                          : "text-red-700 border-red-300"
                      }
                    >
                      {t.status}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
            {selectedTrabs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{selectedTrabs.length} selecionado(s)</p>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!dataInicio || !dataFim || !local || !atividade || selectedTrabs.length === 0 || isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar PT
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
