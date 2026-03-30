import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, GitBranch, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { MetaCompleta, MetaNivel } from "@/types/metas-module";
import { NIVEL_LABELS } from "@/types/metas-module";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DesdobramentoDialogProps {
  meta: MetaCompleta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDesdobrar: (metaId: string, nivelDestino: MetaNivel) => Promise<any>;
  onCriarMetas: (metas: Partial<MetaCompleta>[]) => void;
  isDesdobrando?: boolean;
}

const NIVEL_DESTINO: Record<MetaNivel, MetaNivel[]> = {
  estrategica: ["unidade", "setor"],
  unidade: ["setor", "individual"],
  setor: ["individual"],
  individual: [],
};

export function DesdobramentoDialog({
  meta, open, onOpenChange, onDesdobrar, onCriarMetas, isDesdobrando,
}: DesdobramentoDialogProps) {
  const [nivelDestino, setNivelDestino] = useState<MetaNivel>("setor");
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());

  if (!meta) return null;

  const niveisDisponiveis = NIVEL_DESTINO[meta.nivel] || [];

  const handleDesdobrar = async () => {
    try {
      const data = await onDesdobrar(meta.id, nivelDestino);
      if (data?.desdobramentos) {
        setSugestoes(data.desdobramentos);
        setSelecionadas(new Set(data.desdobramentos.map((_: any, i: number) => i)));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleSelecionada = (i: number) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleConfirmar = () => {
    const metasCriar = sugestoes
      .filter((_, i) => selecionadas.has(i))
      .map(s => ({
        titulo: s.titulo,
        descricao: s.descricao,
        nivel: nivelDestino,
        meta_pai_id: meta.id,
        indicador_nome: s.indicador_nome,
        indicador_unidade: s.indicador_unidade,
        valor_alvo: s.valor_alvo,
        peso: s.peso || 1,
        responsavel_nome: s.responsavel_sugerido,
        objetivo_estrategico: meta.objetivo_estrategico,
        periodo: meta.periodo,
        ano: meta.ano,
        tipo: nivelDestino,
        workflow_status: "rascunho" as const,
        status: "nao_iniciada" as const,
        progresso: 0,
      }));

    onCriarMetas(metasCriar);
    onOpenChange(false);
    setSugestoes([]);
    toast.success(`${metasCriar.length} meta(s) criada(s) como rascunho!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Desdobramento Inteligente
          </DialogTitle>
          <DialogDescription>
            Desdobre "{meta.titulo}" em submetas com apoio de IA
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {sugestoes.length === 0 ? (
            <>
              <div className="space-y-2">
                <p className="text-sm">Selecione o nível de destino:</p>
                <Select value={nivelDestino} onValueChange={v => setNivelDestino(v as MetaNivel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {niveisDisponiveis.map(n => (
                      <SelectItem key={n} value={n}>{NIVEL_LABELS[n]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleDesdobrar} disabled={isDesdobrando} className="gap-1.5 w-full">
                {isDesdobrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar Sugestões com IA
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione as metas que deseja criar ({selecionadas.size} selecionadas):
              </p>
              {sugestoes.map((s, i) => (
                <Card
                  key={i}
                  className={`cursor-pointer transition-all ${selecionadas.has(i) ? "ring-2 ring-primary" : "opacity-60"}`}
                  onClick={() => toggleSelecionada(i)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selecionadas.has(i) ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                        {selecionadas.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium text-sm">{s.titulo}</p>
                        <p className="text-xs text-muted-foreground">{s.descricao}</p>
                        <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                          {s.indicador_nome && <span>📊 {s.indicador_nome}</span>}
                          {s.valor_alvo && <span>🎯 Alvo: {s.valor_alvo}</span>}
                          {s.responsavel_sugerido && <span>👤 {s.responsavel_sugerido}</span>}
                        </div>
                        {s.justificativa && (
                          <p className="text-xs italic text-muted-foreground">💡 {s.justificativa}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSugestoes([])}>Refazer</Button>
                <Button onClick={handleConfirmar} disabled={selecionadas.size === 0} className="gap-1">
                  <Check className="h-4 w-4" /> Criar {selecionadas.size} Meta(s)
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Sugestões geradas por IA — revise antes de confirmar
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
