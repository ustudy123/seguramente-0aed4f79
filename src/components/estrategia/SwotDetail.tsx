import { useState } from "react";
import { ChevronLeft, Plus, Trash2, ArrowRight, Zap, Info, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEstrategia } from "@/hooks/useEstrategia";
import { toast } from "sonner";
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

const CLASSIFICACAO_DESCRICOES: Record<SwotClassificacao, string> = {
  estrategico: "Impacta a direção de longo prazo, posicionamento e visão da empresa.",
  operacional: "Relacionado a processos, rotinas e eficiência do dia a dia.",
  cultural: "Envolve valores, comportamentos e clima organizacional.",
  pessoas: "Diz respeito a talentos, competências e capital humano.",
  mercado: "Fatores externos como concorrência, regulação e tendências.",
};

const IMPACTO_DESCRICOES: Record<SwotImpacto, string> = {
  baixo: "Pouca influência no resultado geral; fácil de gerenciar ou contornar.",
  medio: "Influência moderada; exige atenção e planejamento para lidar com os efeitos.",
  alto: "Influência crítica; pode determinar o sucesso ou fracasso da estratégia.",
};

const QUADRANTE_DICAS: Record<SwotTipo, { descricao: string; exemplos: string[] }> = {
  forca: {
    descricao: "Vantagens internas que diferenciam a organização.",
    exemplos: ["Equipe técnica qualificada", "Marca reconhecida no mercado", "Processos certificados ISO"],
  },
  fraqueza: {
    descricao: "Limitações internas que precisam ser superadas.",
    exemplos: ["Alta rotatividade de pessoal", "Sistemas legados desatualizados", "Falta de planejamento sucessório"],
  },
  oportunidade: {
    descricao: "Fatores externos favoráveis que podem ser aproveitados.",
    exemplos: ["Nova legislação que favorece o setor", "Mercado em expansão", "Parcerias estratégicas disponíveis"],
  },
  ameaca: {
    descricao: "Fatores externos que representam riscos ao negócio.",
    exemplos: ["Entrada de novos concorrentes", "Mudanças regulatórias restritivas", "Instabilidade econômica"],
  },
};

export function SwotDetail({ swot, onBack }: Props) {
  const { useSwotItens, createSwotItem, deleteSwotItem, deleteSwot } = useEstrategia();
  const { data: itens = [] } = useSwotItens(swot.id);
  const [newItem, setNewItem] = useState({ tipo: "forca" as SwotTipo, descricao: "", classificacao: "estrategico" as SwotClassificacao, impacto: "medio" as SwotImpacto });

  const handleAdd = () => {
    if (!newItem.descricao.trim()) {
      toast.error("Preencha a descrição do item");
      return;
    }
    createSwotItem.mutate({ swot_id: swot.id, ...newItem }, {
      onSuccess: () => setNewItem({ ...newItem, descricao: "" }),
    });
  };

  const tipos: SwotTipo[] = ["forca", "fraqueza", "oportunidade", "ameaca"];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button id="btn-voltar-swot" variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            <h3 className="text-lg font-semibold">{swot.titulo}</h3>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button id="btn-excluir-swot" variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir análise SWOT?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível. A análise "{swot.titulo}" e todos os seus itens serão permanentemente removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => { deleteSwot.mutate(swot.id); onBack(); }}
                >
                  Excluir permanentemente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Legenda das classificações e impactos */}
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Classificações</p>
                </div>
                <div className="space-y-2">
                  {(Object.entries(CLASSIFICACAO_DESCRICOES) as [SwotClassificacao, string][]).map(([key, desc]) => (
                    <div key={key} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 w-20 justify-center">{SWOT_CLASSIFICACAO_LABELS[key]}</Badge>
                      <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Grau de Impacto</p>
                </div>
                <div className="space-y-2">
                  {(Object.entries(IMPACTO_DESCRICOES) as [SwotImpacto, string][]).map(([key, desc]) => (
                    <div key={key} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
                      <Badge className={cn("text-[10px] shrink-0 mt-0.5 w-20 justify-center", IMPACTO_COLORS[key])}>{SWOT_IMPACTO_LABELS[key]}</Badge>
                      <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  {(Object.keys(SWOT_CLASSIFICACAO_LABELS) as SwotClassificacao[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      <span>{SWOT_CLASSIFICACAO_LABELS[c]}</span>
                    </SelectItem>
                  ))}
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
            const dica = QUADRANTE_DICAS[tipo];
            return (
              <Card key={tipo} className={`${colors.border} border-2`}>
                <CardHeader className={`pb-2 ${colors.bg} rounded-t-lg`}>
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm font-semibold ${colors.text}`}>
                      {SWOT_TIPO_LABELS[tipo]} ({tipoItens.length})
                    </CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className={`w-3.5 h-3.5 ${colors.text} opacity-60 cursor-help`} />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-medium text-xs mb-1">{dica.descricao}</p>
                        <p className="text-[10px] text-muted-foreground">Exemplos:</p>
                        <ul className="text-[10px] text-muted-foreground list-disc pl-3 mt-0.5">
                          {dica.exemplos.map((ex) => <li key={ex}>{ex}</li>)}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {tipoItens.length === 0 ? (
                    <div className="text-center py-4 space-y-1">
                      <p className="text-xs text-muted-foreground">Nenhum item</p>
                      <p className="text-[10px] text-muted-foreground/60 italic">
                        Ex: {dica.exemplos[0]}
                      </p>
                    </div>
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button data-testid="btn-excluir-item" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O item "{item.descricao}" será removido permanentemente do quadrante {SWOT_TIPO_LABELS[item.tipo]}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteSwotItem.mutate(item.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
