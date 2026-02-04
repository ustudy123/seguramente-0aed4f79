import { useState } from "react";
import { LayoutGrid, Plus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useColaboradores } from "@/hooks/useColaboradores";
import { QUADRANTES_9BOX, type Avaliacao9Box } from "@/types/avaliacao";
import { cn } from "@/lib/utils";

export function Matriz9Box() {
  const { nineBoxData, isLoadingNineBox, ciclos } = useAvaliacoes();
  const { colaboradores, isLoading: isLoadingColaboradores } = useColaboradores();
  const [selectedQuadrante, setSelectedQuadrante] = useState<string | null>(null);

  // Agrupar por quadrante
  const colaboradoresPorQuadrante = nineBoxData.reduce((acc, item) => {
    const key = `${item.desempenho}-${item.potencial}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, Avaliacao9Box[]>);

  const quadrantesGrid = [
    // Linha 1 (Potencial Alto - index 3)
    ["1-3", "2-3", "3-3"],
    // Linha 2 (Potencial Médio - index 2)
    ["1-2", "2-2", "3-2"],
    // Linha 3 (Potencial Baixo - index 1)
    ["1-1", "2-1", "3-1"],
  ];

  const isLoading = isLoadingNineBox || isLoadingColaboradores;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Matriz 9-Box</h2>
          <p className="text-sm text-muted-foreground">
            Visualize o posicionamento de colaboradores por Desempenho × Potencial
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Posicionar Colaborador
        </Button>
      </div>

      {nineBoxData.length === 0 ? (
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
              <Button className="gap-2">
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
              {/* Labels Y (Potencial) */}
              <div className="flex flex-col justify-around pr-3 text-sm font-medium text-muted-foreground">
                <span className="h-32 flex items-center">Alto</span>
                <span className="h-32 flex items-center">Médio</span>
                <span className="h-32 flex items-center">Baixo</span>
              </div>

              {/* Grid */}
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
                                      <div
                                        key={c.id}
                                        className="w-8 h-8 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-xs font-bold text-gray-700"
                                        style={{ zIndex: 3 - i }}
                                      >
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
                          <div className="space-y-1">
                            <p className="font-semibold">{config.nome}</p>
                            <p className="text-sm text-muted-foreground">{config.descricao}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Labels X (Desempenho) */}
                <div className="flex justify-around mt-2 text-sm font-medium text-muted-foreground">
                  <span>Baixo</span>
                  <span>Médio</span>
                  <span>Alto</span>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-1">Desempenho →</p>
              </div>

              {/* Label Y rotacionado */}
              <div className="flex items-center pl-2">
                <span 
                  className="text-xs font-medium text-muted-foreground transform -rotate-90 whitespace-nowrap"
                  style={{ writingMode: "vertical-rl" }}
                >
                  ← Potencial
                </span>
              </div>
            </div>

            {/* Detalhes do quadrante selecionado */}
            {selectedQuadrante && colaboradoresPorQuadrante[selectedQuadrante]?.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">
                      {QUADRANTES_9BOX[selectedQuadrante].nome}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {QUADRANTES_9BOX[selectedQuadrante].descricao}
                    </p>
                  </div>
                  <Badge className={QUADRANTES_9BOX[selectedQuadrante].cor}>
                    {colaboradoresPorQuadrante[selectedQuadrante].length} colaborador(es)
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {colaboradoresPorQuadrante[selectedQuadrante].map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-background rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.colaborador_nome}</p>
                        {item.justificativa && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.justificativa}
                          </p>
                        )}
                      </div>
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
                <div className={cn("w-4 h-4 rounded", config.cor)} />
                <span className="truncate">{config.descricao}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
