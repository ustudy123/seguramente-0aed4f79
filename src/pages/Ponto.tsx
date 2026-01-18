import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Clock, 
  Calendar, 
  Download, 
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface RegistroPonto {
  id: number;
  colaborador: string;
  data: string;
  entrada: string;
  saidaAlmoco: string;
  retornoAlmoco: string;
  saida: string;
  horasTrabalhadas: string;
  status: "regular" | "atraso" | "falta" | "ajuste";
}

const registros: RegistroPonto[] = [
  {
    id: 1,
    colaborador: "Ana Carolina Silva",
    data: "2025-01-17",
    entrada: "08:02",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:05",
    horasTrabalhadas: "8h 03min",
    status: "regular",
  },
  {
    id: 2,
    colaborador: "Carlos Eduardo Mendes",
    data: "2025-01-17",
    entrada: "08:45",
    saidaAlmoco: "12:30",
    retornoAlmoco: "13:30",
    saida: "17:00",
    horasTrabalhadas: "7h 15min",
    status: "atraso",
  },
  {
    id: 3,
    colaborador: "Paula Santos Oliveira",
    data: "2025-01-17",
    entrada: "07:55",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    horasTrabalhadas: "8h 05min",
    status: "regular",
  },
  {
    id: 4,
    colaborador: "João Pedro Almeida",
    data: "2025-01-17",
    entrada: "--:--",
    saidaAlmoco: "--:--",
    retornoAlmoco: "--:--",
    saida: "--:--",
    horasTrabalhadas: "0h 00min",
    status: "falta",
  },
  {
    id: 5,
    colaborador: "Maria Fernanda Costa",
    data: "2025-01-17",
    entrada: "08:00",
    saidaAlmoco: "12:00",
    retornoAlmoco: "13:00",
    saida: "17:00",
    horasTrabalhadas: "8h 00min",
    status: "regular",
  },
  {
    id: 6,
    colaborador: "Roberto Carlos Lima",
    data: "2025-01-17",
    entrada: "08:10",
    saidaAlmoco: "12:15",
    retornoAlmoco: "13:20",
    saida: "17:30",
    horasTrabalhadas: "8h 05min",
    status: "ajuste",
  },
];

const statusConfig = {
  regular: {
    label: "Regular",
    icon: CheckCircle,
    style: "bg-success/10 text-success border-success/20",
  },
  atraso: {
    label: "Atraso",
    icon: AlertCircle,
    style: "bg-warning/10 text-warning border-warning/20",
  },
  falta: {
    label: "Falta",
    icon: XCircle,
    style: "bg-destructive/10 text-destructive border-destructive/20",
  },
  ajuste: {
    label: "Ajuste Pendente",
    icon: Clock,
    style: "bg-info/10 text-info border-info/20",
  },
};

const Ponto = () => {
  const [selectedDate, setSelectedDate] = useState("2025-01-17");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRegistros = registros.filter(
    (reg) => statusFilter === "all" || reg.status === statusFilter
  );

  const stats = {
    regulares: registros.filter((r) => r.status === "regular").length,
    atrasos: registros.filter((r) => r.status === "atraso").length,
    faltas: registros.filter((r) => r.status === "falta").length,
    ajustes: registros.filter((r) => r.status === "ajuste").length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Ponto</h1>
          <p className="text-muted-foreground">Registros de entrada e saída</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Hoje
          </Button>
          <Button className="gradient-primary shadow-glow">
            <Clock className="w-4 h-4 mr-2" />
            Registrar Ponto
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {Object.entries(stats).map(([key, value], index) => {
          const config = statusConfig[key === "regulares" ? "regular" : key === "atrasos" ? "atraso" : key === "faltas" ? "falta" : "ajuste"];
          return (
            <div
              key={key}
              className={cn(
                "p-4 rounded-xl border flex items-center gap-4",
                config.style
              )}
            >
              <config.icon className="w-8 h-8" />
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm capitalize">{key}</p>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-card rounded-xl border border-border p-4 shadow-sm"
      >
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-2 bg-muted rounded-lg min-w-[150px] text-center">
                <span className="font-medium">17 Jan 2025</span>
              </div>
              <Button variant="outline" size="icon">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="atraso">Atraso</SelectItem>
                <SelectItem value="falta">Falta</SelectItem>
                <SelectItem value="ajuste">Ajuste Pendente</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Colaborador</TableHead>
              <TableHead className="font-semibold text-center">Entrada</TableHead>
              <TableHead className="font-semibold text-center">Saída Almoço</TableHead>
              <TableHead className="font-semibold text-center">Retorno Almoço</TableHead>
              <TableHead className="font-semibold text-center">Saída</TableHead>
              <TableHead className="font-semibold text-center">Total</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegistros.map((registro, index) => {
              const config = statusConfig[registro.status];
              return (
                <motion.tr
                  key={registro.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.25 + index * 0.05 }}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {registro.colaborador.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{registro.colaborador}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono">{registro.entrada}</TableCell>
                  <TableCell className="text-center font-mono">{registro.saidaAlmoco}</TableCell>
                  <TableCell className="text-center font-mono">{registro.retornoAlmoco}</TableCell>
                  <TableCell className="text-center font-mono">{registro.saida}</TableCell>
                  <TableCell className="text-center font-medium">{registro.horasTrabalhadas}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-xs", config.style)}>
                      {config.label}
                    </Badge>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
};

export default Ponto;
