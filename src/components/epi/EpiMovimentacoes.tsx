import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Trash2, Search, X, CalendarIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EpiMovimentacao, EpiCompleto } from "@/types/epi";

interface EpiMovimentacoesProps {
  movimentacoes: (EpiMovimentacao & { epi: EpiCompleto })[];
  isLoading?: boolean;
}

const TIPO_CONFIG: Record<
  string,
  { label: string; icon: typeof ArrowUpCircle; color: string }
> = {
  entrada: {
    label: "Entrada",
    icon: ArrowUpCircle,
    color: "text-green-500",
  },
  saida: {
    label: "Saída",
    icon: ArrowDownCircle,
    color: "text-red-500",
  },
  ajuste: {
    label: "Ajuste",
    icon: RefreshCw,
    color: "text-blue-500",
  },
  descarte: {
    label: "Descarte",
    icon: Trash2,
    color: "text-orange-500",
  },
};

export function EpiMovimentacoes({
  movimentacoes,
  isLoading,
}: EpiMovimentacoesProps) {
  const [filtroColaborador, setFiltroColaborador] = useState("");
  const [filtroEpi, setFiltroEpi] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Obter lista única de EPIs para o filtro
  const episUnicos = useMemo(() => {
    const map = new Map<string, string>();
    movimentacoes.forEach((mov) => {
      if (mov.epi?.tipo?.nome) {
        map.set(mov.epi.tipo.id, mov.epi.tipo.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [movimentacoes]);

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter((mov) => {
      // Filtro por colaborador
      if (filtroColaborador) {
        const nomeRealizador = (mov.realizado_por_nome || "Sistema").toLowerCase();
        if (!nomeRealizador.includes(filtroColaborador.toLowerCase())) {
          return false;
        }
      }

      // Filtro por EPI
      if (filtroEpi && filtroEpi !== "all") {
        if (mov.epi?.tipo?.id !== filtroEpi) {
          return false;
        }
      }

      // Filtro por tipo de movimentação
      if (filtroTipo && filtroTipo !== "all") {
        if (mov.tipo !== filtroTipo) {
          return false;
        }
      }

      // Filtro por período
      if (dataInicio || dataFim) {
        const dataMovimentacao = new Date(mov.created_at);
        
        if (dataInicio && dataFim) {
          if (!isWithinInterval(dataMovimentacao, {
            start: startOfDay(dataInicio),
            end: endOfDay(dataFim),
          })) {
            return false;
          }
        } else if (dataInicio) {
          if (dataMovimentacao < startOfDay(dataInicio)) {
            return false;
          }
        } else if (dataFim) {
          if (dataMovimentacao > endOfDay(dataFim)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [movimentacoes, filtroColaborador, filtroEpi, filtroTipo, dataInicio, dataFim]);

  const limparFiltros = () => {
    setFiltroColaborador("");
    setFiltroEpi("all");
    setFiltroTipo("all");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const temFiltrosAtivos = filtroColaborador || (filtroEpi && filtroEpi !== "all") || (filtroTipo && filtroTipo !== "all") || dataInicio || dataFim;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por colaborador..."
                value={filtroColaborador}
                onChange={(e) => setFiltroColaborador(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-full sm:w-64">
            <Select value={filtroEpi} onValueChange={setFiltroEpi}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por EPI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os EPIs</SelectItem>
                {episUnicos.map((epi) => (
                  <SelectItem key={epi.id} value={epi.id}>
                    {epi.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filtro por período */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 sm:flex-initial">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Data inicial
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !dataInicio && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  disabled={(date) => dataFim ? date > dataFim : false}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="flex-1 sm:flex-initial">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Data final
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !dataFim && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  disabled={(date) => dataInicio ? date < dataInicio : false}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {temFiltrosAtivos && (
            <Button variant="ghost" onClick={limparFiltros} className="gap-2">
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Contador de resultados */}
      {temFiltrosAtivos && (
        <p className="text-sm text-muted-foreground">
          Exibindo {movimentacoesFiltradas.length} de {movimentacoes.length} movimentações
        </p>
      )}

      {movimentacoes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma movimentação registrada</p>
        </div>
      ) : movimentacoesFiltradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma movimentação encontrada com os filtros aplicados</p>
          <Button variant="link" onClick={limparFiltros} className="mt-2">
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>EPI</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-center">Quantidade</TableHead>
                <TableHead className="text-center">Anterior</TableHead>
                <TableHead className="text-center">Atual</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Realizado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoesFiltradas.map((mov) => {
                const config = TIPO_CONFIG[mov.tipo] || TIPO_CONFIG.ajuste;
                const Icon = config.icon;

                return (
                  <TableRow key={mov.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <Badge variant="outline">{config.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{mov.epi.tipo.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(mov as any).tamanho || "—"}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {mov.tipo === "entrada" ? "+" : "-"}
                      {mov.quantidade}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {mov.quantidade_anterior}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {mov.quantidade_atual}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {mov.motivo || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {mov.realizado_por_nome || "Sistema"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
