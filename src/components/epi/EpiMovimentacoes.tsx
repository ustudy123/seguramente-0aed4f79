import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Trash2, Search, X } from "lucide-react";
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

      return true;
    });
  }, [movimentacoes, filtroColaborador, filtroEpi]);

  const limparFiltros = () => {
    setFiltroColaborador("");
    setFiltroEpi("all");
  };

  const temFiltrosAtivos = filtroColaborador || (filtroEpi && filtroEpi !== "all");

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
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
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
        {temFiltrosAtivos && (
          <Button variant="ghost" size="icon" onClick={limparFiltros} title="Limpar filtros">
            <X className="h-4 w-4" />
          </Button>
        )}
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
