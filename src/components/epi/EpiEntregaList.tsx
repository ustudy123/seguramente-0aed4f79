import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RotateCcw,
  User,
  Calendar,
  Package,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EpiEntrega, EpiCompleto, EntregaStatus } from "@/types/epi";
import { ENTREGA_STATUS_LABELS, ENTREGA_STATUS_COLORS } from "@/types/epi";

interface EpiEntregaListProps {
  entregas: (EpiEntrega & { epi: EpiCompleto })[];
  isLoading?: boolean;
  onDevolucao: (entregaId: string, observacoes?: string) => Promise<void>;
}

export function EpiEntregaList({
  entregas,
  isLoading,
  onDevolucao,
}: EpiEntregaListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [devolucaoModal, setDevolucaoModal] = useState<{
    open: boolean;
    entregaId: string;
    colaborador: string;
  }>({ open: false, entregaId: "", colaborador: "" });
  const [observacoes, setObservacoes] = useState("");
  const [processando, setProcessando] = useState(false);

  const filtered = entregas.filter((entrega) => {
    const matchSearch =
      entrega.colaborador_nome.toLowerCase().includes(search.toLowerCase()) ||
      entrega.epi.tipo.nome.toLowerCase().includes(search.toLowerCase()) ||
      entrega.colaborador_cpf?.includes(search);

    const matchStatus =
      statusFilter === "all" || entrega.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const handleDevolucao = async () => {
    setProcessando(true);
    try {
      await onDevolucao(devolucaoModal.entregaId, observacoes);
      setDevolucaoModal({ open: false, entregaId: "", colaborador: "" });
      setObservacoes("");
    } finally {
      setProcessando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Buscar por colaborador ou EPI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="devolvido">Devolvidas</SelectItem>
            <SelectItem value="extraviado">Extraviadas</SelectItem>
            <SelectItem value="vencido">Vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma entrega encontrada</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>EPI</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead>Data Entrega</TableHead>
                <TableHead>Devolução Prevista</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entrega, index) => (
                <motion.tr
                  key={entrega.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{entrega.colaborador_nome}</p>
                      {entrega.colaborador_cargo && (
                        <p className="text-xs text-muted-foreground">
                          {entrega.colaborador_cargo}
                          {entrega.colaborador_departamento &&
                            ` - ${entrega.colaborador_departamento}`}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{entrega.epi.tipo.nome}</span>
                      {entrega.epi.tamanho && (
                        <Badge variant="outline" className="text-xs">
                          {entrega.epi.tamanho}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {entrega.quantidade}
                  </TableCell>
                  <TableCell>
                    {format(new Date(entrega.data_entrega), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    {entrega.data_devolucao_prevista ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(
                          new Date(entrega.data_devolucao_prevista),
                          "dd/MM/yyyy",
                          { locale: ptBR }
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entrega.motivo_entrega || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={ENTREGA_STATUS_COLORS[entrega.status]}>
                      {ENTREGA_STATUS_LABELS[entrega.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entrega.status === "ativa" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDevolucaoModal({
                            open: true,
                            entregaId: entrega.id,
                            colaborador: entrega.colaborador_nome,
                          })
                        }
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Devolver
                      </Button>
                    )}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={devolucaoModal.open}
        onOpenChange={(open) =>
          setDevolucaoModal({ ...devolucaoModal, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Devolução</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Registrar devolução do EPI de{" "}
              <strong>{devolucaoModal.colaborador}</strong>
            </p>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Estado do EPI, observações sobre a devolução..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDevolucaoModal({ open: false, entregaId: "", colaborador: "" })
              }
            >
              Cancelar
            </Button>
            <Button onClick={handleDevolucao} disabled={processando}>
              {processando ? "Processando..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
