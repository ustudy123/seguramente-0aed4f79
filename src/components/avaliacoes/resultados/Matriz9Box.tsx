import { useState } from "react";
import { LayoutGrid, Plus, Users, Pencil, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ColaboradorAvatar } from "./ColaboradorAvatar";

type Nivel = 1 | 2 | 3;

function toNivel(v: number): Nivel {
  if (v <= 1) return 1;
  if (v === 2) return 2;
  return 3;
}

export function Matriz9Box() {
  const { nineBoxData, isLoadingNineBox, ciclos, create9Box, update9Box } = useAvaliacoes();
  const { colaboradores } = useColaboradores();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedQuadrante, setSelectedQuadrante] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cicloFiltro, setCicloFiltro] = useState<string>("todos");

  // Form state
  const [cicloId, setCicloId] = useState<string>("");
  const [colaboradorId, setColaboradorId] = useState<string>("");
  const [desempenho, setDesempenho] = useState<Nivel>(2);
  const [potencial, setPotencial] = useState<Nivel>(2);
  const [justificativa, setJustificativa] = useState("");
  const [editando, setEditando] = useState<Avaliacao9Box | null>(null);

  const dadosFiltrados = cicloFiltro === "todos"
    ? nineBoxData
    : nineBoxData.filter(d => d.ciclo_id === cicloFiltro);

  const colaboradoresPorQuadrante = dadosFiltrados.reduce((acc, item) => {
    const key = `${item.desempenho}-${item.potencial}`;
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
      setDesempenho(2);
      setPotencial(2);
      setJustificativa("");
    }
    setModalOpen(true);
  };

  const handleSalvar = async () => {
    if (!colaboradorId) {
      toast.error("Selecione um colaborador");
      return;
    }
    const colaborador = colaboradores.find(c => c.id === colaboradorId);
    const quadrante = `${desempenho}-${potencial}`;

    setIsSaving(true);
    try {
      if (editando) {
        await update9Box({
          id: editando.id,
          ciclo_id: cicloId || undefined,
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

  const previewConfig = QUADRANTES_9BOX[`${desempenho}-${potencial}`];
  const NIVEIS: Nivel[] = [1, 2, 3];
  const NIVEL_LABEL: Record<Nivel, string> = { 1: "Baixo", 2: "Médio", 3: "Alto" };

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
                                    {colaboradoresQ.slice(0, 4).map((c, i) => {
                                      const colab = colaboradores.find(x => x.id === c.colaborador_id);
                                      return (
                                        <ColaboradorAvatar
                                          key={c.id}
                                          nome={c.colaborador_nome}
                                          fotoUrl={colab?.foto_url}
                                          className="w-10 h-10 border-2 border-white shadow-lg"
                                        />
                                      );
                                    })}
                                    {colaboradoresQ.length > 4 && (
                                      <div className="w-10 h-10 rounded-full bg-background/90 border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-foreground">
                                        +{colaboradoresQ.length - 4}
                                      </div>
                                    )}
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
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                  Potencial ↑
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
                  {colaboradoresPorQuadrante[selectedQuadrante].map((item) => {
                    const colab = colaboradores.find(x => x.id === item.colaborador_id);
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {colab?.foto_url ? (
                            <img src={colab.foto_url} alt={item.colaborador_nome} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="h-5 w-5 text-primary" />
                          )}
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
                    );
                  })}
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
              <Label>Ciclo de Avaliação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select value={cicloId || "nenhum"} onValueChange={v => setCicloId(v === "nenhum" ? "" : v)}>
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
                    <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desempenho */}
            <div className="space-y-2">
              <Label>Desempenho</Label>
              <div className="flex gap-2">
                {NIVEIS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDesempenho(n)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                      desempenho === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {NIVEL_LABEL[n]}
                  </button>
                ))}
              </div>
            </div>

            {/* Potencial */}
            <div className="space-y-2">
              <Label>Potencial</Label>
              <div className="flex gap-2">
                {NIVEIS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPotencial(n)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                      potencial === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {NIVEL_LABEL[n]}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview do quadrante */}
            {previewConfig && (
              <div className={cn("flex items-center gap-3 p-3 rounded-lg", previewConfig.cor)}>
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
