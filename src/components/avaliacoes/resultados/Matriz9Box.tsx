import { useState } from "react";
import { LayoutGrid, Plus, Users, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useColaboradores } from "@/hooks/useColaboradores";
import { QUADRANTES_9BOX, type Avaliacao9Box } from "@/types/avaliacao";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function getPosicao(desempenho: number, potencial: number) {
  const d = desempenho <= 2 ? 1 : desempenho <= 4 ? 2 : 3;
  const p = potencial <= 2 ? 1 : potencial <= 4 ? 2 : 3;
  const key = `${d}-${p}`;
  return { key, d, p };
}

export function Matriz9Box() {
  const { nineBoxData, isLoadingNineBox, ciclos, create9Box, update9Box } = useAvaliacoes();
  const { colaboradores } = useColaboradores();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedQuadrante, setSelectedQuadrante] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [cicloId, setCicloId] = useState<string>("");
  const [colaboradorId, setColaboradorId] = useState<string>("");
  const [desempenho, setDesempenho] = useState(3);
  const [potencial, setPotencial] = useState(3);
  const [justificativa, setJustificativa] = useState("");
  const [editando, setEditando] = useState<Avaliacao9Box | null>(null);

  // Filtro por ciclo na visualização
  const [cicloFiltro, setCicloFiltro] = useState<string>("todos");

  const dadosFiltrados = cicloFiltro === "todos"
    ? nineBoxData
    : nineBoxData.filter(d => d.ciclo_id === cicloFiltro);

  const colaboradoresPorQuadrante = dadosFiltrados.reduce((acc, item) => {
    const { key } = getPosicao(item.desempenho, item.potencial);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Avaliacao9Box[]>);

  const quadrantesGrid = [
    ["1-3", "2-3", "3-3"],
    ["1-2", "2-2", "3-2"],
    ["1-1", "2-1", "3-1"],
  ];

  const abrirModal = (item?: Avaliacao9Box) => {
    if (item) {
      setEditando(item);
      setCicloId(item.ciclo_id || "");
      setColaboradorId(item.colaborador_id);
      setDesempenho(item.desempenho);
      setPotencial(item.potencial);
      setJustificativa(item.justificativa || "");
    } else {
      setEditando(null);
      setCicloId(ciclos[0]?.id || "");
      setColaboradorId("");
      setDesempenho(3);
      setPotencial(3);
      setJustificativa("");
    }
    setModalOpen(true);
  };

  const handleSalvar = async () => {
    if (!colaboradorId) {
      toast.error("Selecione um colaborador");
      return;
    }
    const colaborador = colaboradores.find(c => c.user_id === colaboradorId);
    const { key: quadrante } = getPosicao(desempenho, potencial);

    setIsSaving(true);
    try {
      if (editando) {
        await update9Box({
          id: editando.id,
          ciclo_id: cicloId || null,
          desempenho,
          potencial,
          quadrante,
          justificativa,
        });
      } else {
        await create9Box({
          ciclo_id: cicloId || undefined,
          colaborador_id: colaboradorId,
          colaborador_nome: colaborador?.nome_completo || "",
          desempenho,
          potencial,
          quadrante,
          justificativa,
        });
      }
      setModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const previewQuadrante = getPosicao(desempenho, potencial);
  const previewConfig = QUADRANTES_9BOX[previewQuadrante.key];

  const LABEL_ESCALA = ["", "1", "2", "3", "4", "5"];

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Matriz 9-Box</h2>
          <p className="text-sm text-muted-foreground">
            Visualize o posicionamento de colaboradores por Desempenho × Potencial
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filtro por ciclo */}
          <Select value={cicloFiltro} onValueChange={setCicloFiltro}>
            <SelectTrigger className="w-48 text-sm">
              <SelectValue placeholder="Filtrar por ciclo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os ciclos</SelectItem>
              {ciclos.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => abrirModal()}>
            <Plus className="h-4 w-4" />
            Posicionar Colaborador
          </Button>
        </div>
      </div>

      {/* Matriz */}
      {dadosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Matriz 9-Box vazia</h3>
                <p className="text-muted-foreground">
                  Posicione colaboradores na matriz após concluir ciclos de avaliação.
                </p>
              </div>
              <Button className="gap-2" onClick={() => abrirModal()}>
                <Plus className="h-4 w-4" />
                Posicionar Colaborador
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex">
              <div className="flex flex-col justify-around pr-3 text-sm font-medium text-muted-foreground">
                <span className="h-32 flex items-center">Alto</span>
                <span className="h-32 flex items-center">Médio</span>
                <span className="h-32 flex items-center">Baixo</span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-2">
                  {quadrantesGrid.flat().map((quadrante) => {
                    const config = QUADRANTES_9BOX[quadrante];
                    const colaboradoresQ = colaboradoresPorQuadrante[quadrante] || [];
                    const isSelected = selectedQuadrante === quadrante;
                    return (
                      <Tooltip key={quadrante}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSelectedQuadrante(isSelected ? null : quadrante)}
                            className={cn(
                              "h-32 p-2 rounded-lg border-2 transition-all",
                              config.cor,
                              isSelected ? "ring-2 ring-offset-2 ring-primary" : "",
                              colaboradoresQ.length > 0 ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-60"
                            )}
                          >
                            <div className="h-full flex flex-col items-center justify-center gap-2">
                              {colaboradoresQ.length > 0 ? (
                                <>
                                  <div className="flex -space-x-2">
                                    {colaboradoresQ.slice(0, 3).map((c, i) => (
                                      <div key={c.id} className="w-8 h-8 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-xs font-bold text-gray-700" style={{ zIndex: 3 - i }}>
                                        {c.colaborador_nome.charAt(0)}
                                      </div>
                                    ))}
                                  </div>
                                  <span className="text-xs font-semibold text-white drop-shadow">
                                    {colaboradoresQ.length} colaborador{colaboradoresQ.length > 1 ? "es" : ""}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-white/70">Vazio</span>
                              )}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="font-semibold">{config.nome}</p>
                          <p className="text-sm text-muted-foreground">{config.descricao}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="flex justify-around mt-2 text-sm font-medium text-muted-foreground">
                  <span>Baixo</span><span>Médio</span><span>Alto</span>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-1">Desempenho →</p>
              </div>
              <div className="flex items-center pl-2">
                <span className="text-xs font-medium text-muted-foreground transform -rotate-90 whitespace-nowrap" style={{ writingMode: "vertical-rl" }}>
                  ← Potencial
                </span>
              </div>
            </div>

            {/* Detalhes do quadrante selecionado */}
            {selectedQuadrante && colaboradoresPorQuadrante[selectedQuadrante]?.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{QUADRANTES_9BOX[selectedQuadrante].nome}</h4>
                    <p className="text-sm text-muted-foreground">{QUADRANTES_9BOX[selectedQuadrante].descricao}</p>
                  </div>
                  <Badge className={QUADRANTES_9BOX[selectedQuadrante].cor}>
                    {colaboradoresPorQuadrante[selectedQuadrante].length} colaborador(es)
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {colaboradoresPorQuadrante[selectedQuadrante].map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.colaborador_nome}</p>
                        {item.justificativa && (
                          <p className="text-xs text-muted-foreground truncate">{item.justificativa}</p>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => abrirModal(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legenda */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Legenda dos Quadrantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(QUADRANTES_9BOX).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div className={cn("w-4 h-4 rounded shrink-0", config.cor)} />
                <span className="truncate">{config.descricao}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Posicionar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Posicionamento" : "Posicionar Colaborador"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Ciclo */}
            <div className="space-y-1.5">
              <Label>Ciclo de Avaliação (opcional)</Label>
              <Select value={cicloId} onValueChange={setCicloId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ciclo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem ciclo específico</SelectItem>
                  {ciclos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Colaborador */}
            <div className="space-y-1.5">
              <Label>Colaborador <span className="text-destructive">*</span></Label>
              <Select value={colaboradorId} onValueChange={setColaboradorId} disabled={!!editando}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desempenho */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Desempenho</Label>
                <span className="text-sm font-semibold text-primary">{desempenho}/5</span>
              </div>
              <Slider min={1} max={5} step={1} value={[desempenho]} onValueChange={([v]) => setDesempenho(v)} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Baixo</span><span>Médio</span><span>Alto</span>
              </div>
            </div>

            {/* Potencial */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Potencial</Label>
                <span className="text-sm font-semibold text-primary">{potencial}/5</span>
              </div>
              <Slider min={1} max={5} step={1} value={[potencial]} onValueChange={([v]) => setPotencial(v)} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Baixo</span><span>Médio</span><span>Alto</span>
              </div>
            </div>

            {/* Preview do quadrante */}
            {previewConfig && (
              <div className={cn("flex items-center gap-3 p-3 rounded-lg border", previewConfig.cor)}>
                <LayoutGrid className="h-5 w-5 text-white shrink-0" />
                <div>
                  <p className="font-semibold text-white text-sm">{previewConfig.nome}</p>
                  <p className="text-xs text-white/80">{previewConfig.descricao}</p>
                </div>
              </div>
            )}

            {/* Justificativa */}
            <div className="space-y-1.5">
              <Label>Justificativa</Label>
              <Textarea
                placeholder="Descreva o motivo do posicionamento..."
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={isSaving || !colaboradorId}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editando ? "Salvar alterações" : "Posicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
