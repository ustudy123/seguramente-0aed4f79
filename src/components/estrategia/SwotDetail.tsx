import { useState } from "react";
import { ChevronLeft, Plus, Trash2, ArrowRight, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstrategia } from "@/hooks/useEstrategia";
import type { EstrategiaSwot, SwotTipo, SwotClassificacao, SwotImpacto } from "@/types/estrategia";
import { SWOT_TIPO_LABELS, SWOT_CLASSIFICACAO_LABELS, SWOT_IMPACTO_LABELS } from "@/types/estrategia";

interface Props {
  swot: EstrategiaSwot;
  onBack: () => void;
}

const QUADRANT_COLORS: Record<SwotTipo, { bg: string; border: string; text: string }> = {
  forca: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-700" },
  fraqueza: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-700" },
  oportunidade: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700" },
  ameaca: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-700" },
};

const IMPACTO_COLORS: Record<SwotImpacto, string> = {
  baixo: "bg-muted text-muted-foreground",
  medio: "bg-amber-100 text-amber-800",
  alto: "bg-red-100 text-red-800",
};

export function SwotDetail({ swot, onBack }: Props) {
  const { useSwotItens, createSwotItem, deleteSwotItem, deleteSwot } = useEstrategia();
  const { data: itens = [] } = useSwotItens(swot.id);
  const [newItem, setNewItem] = useState({ tipo: "forca" as SwotTipo, descricao: "", classificacao: "estrategico" as SwotClassificacao, impacto: "medio" as SwotImpacto });

  const handleAdd = () => {
    if (!newItem.descricao.trim()) return;
    createSwotItem.mutate({ swot_id: swot.id, ...newItem }, {
      onSuccess: () => setNewItem({ ...newItem, descricao: "" }),
    });
  };

  const tipos: SwotTipo[] = ["forca", "fraqueza", "oportunidade", "ameaca"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <h3 className="text-lg font-semibold">{swot.titulo}</h3>
        </div>
        <Button variant="destructive" size="sm" onClick={() => { deleteSwot.mutate(swot.id); onBack(); }}>
          <Trash2 className="w-4 h-4 mr-1" /> Excluir
        </Button>
      </div>

      {/* Add item form */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={newItem.tipo} onValueChange={(v) => setNewItem({ ...newItem, tipo: v as SwotTipo })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t} value={t}>{SWOT_TIPO_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="flex-1 min-w-48" placeholder="Descreva o item..." value={newItem.descricao} onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
            <Select value={newItem.classificacao} onValueChange={(v) => setNewItem({ ...newItem, classificacao: v as SwotClassificacao })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SWOT_CLASSIFICACAO_LABELS) as SwotClassificacao[]).map((c) => <SelectItem key={c} value={c}>{SWOT_CLASSIFICACAO_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newItem.impacto} onValueChange={(v) => setNewItem({ ...newItem, impacto: v as SwotImpacto })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SWOT_IMPACTO_LABELS) as SwotImpacto[]).map((i) => <SelectItem key={i} value={i}>{SWOT_IMPACTO_LABELS[i]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={createSwotItem.isPending}><Plus className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* SWOT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tipos.map((tipo) => {
          const colors = QUADRANT_COLORS[tipo];
          const tipoItens = itens.filter((i) => i.tipo === tipo);
          return (
            <Card key={tipo} className={`${colors.border} border-2`}>
              <CardHeader className={`pb-2 ${colors.bg} rounded-t-lg`}>
                <CardTitle className={`text-sm font-semibold ${colors.text}`}>
                  {SWOT_TIPO_LABELS[tipo]} ({tipoItens.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {tipoItens.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum item</p>
                ) : (
                  tipoItens.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background border">
                      <div className="flex-1">
                        <p className="text-sm">{item.descricao}</p>
                        <div className="flex gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px]">{SWOT_CLASSIFICACAO_LABELS[item.classificacao]}</Badge>
                          <Badge className={`text-[10px] ${IMPACTO_COLORS[item.impacto]}`}>{SWOT_IMPACTO_LABELS[item.impacto]}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteSwotItem.mutate(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
