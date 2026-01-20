import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (movimentacoes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma movimentação registrada</p>
      </div>
    );
  }

  return (
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
          {movimentacoes.map((mov) => {
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
  );
}
