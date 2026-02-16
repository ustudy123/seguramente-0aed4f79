import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Search,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useColaboradores } from "@/hooks/useColaboradores";
import { calcularPeriodoFerias } from "@/lib/feriasPeriodo";

interface FeriasItem {
  id: number;
  colaborador: string;
  departamento: string;
  dataInicio: string;
  dataFim: string;
  diasSolicitados: number;
  saldoDias: number;
  status: "pendente" | "aprovado" | "recusado";
  dataSolicitacao: string;
  abonoPecuniario?: boolean;
  diasAbono?: number;
  salarioBase?: number;
}

interface FeriasSaldosProps {
  ferias: FeriasItem[];
}

interface ColaboradorSaldo {
  nome: string;
  departamento: string;
  saldoTotal: number;
  diasUsados: number;
  diasPendentes: number;
  saldoDisponivel: number;
  periodoAquisitivo: string;
  vencimento: string;
  statusVencimento: "ok" | "alerta" | "vencido";
  diasParaVencimento: number;
}

export function FeriasSaldos({ ferias }: FeriasSaldosProps) {
  const { colaboradores } = useColaboradores();
  const [search, setSearch] = useState("");

  const saldos = useMemo<ColaboradorSaldo[]>(() => {
    const map = new Map<string, ColaboradorSaldo>();

    colaboradores.forEach((c) => {
      const colabFerias = ferias.filter((f) => f.colaborador === c.nome_completo);
      const diasUsados = colabFerias
        .filter((f) => f.status === "aprovado")
        .reduce((sum, f) => sum + f.diasSolicitados, 0);
      const diasPendentes = colabFerias
        .filter((f) => f.status === "pendente")
        .reduce((sum, f) => sum + f.diasSolicitados, 0);

      // Calcular período aquisitivo real
      const periodo = calcularPeriodoFerias(c.data_admissao, diasUsados);

      map.set(c.nome_completo, {
        nome: c.nome_completo,
        departamento: c.departamento || "Não informado",
        saldoTotal: 30,
        diasUsados,
        diasPendentes,
        saldoDisponivel: 30 - diasUsados,
        periodoAquisitivo: periodo?.periodoAquisitivoLabel || "Sem admissão",
        vencimento: periodo?.vencimentoLabel || "—",
        statusVencimento: periodo?.statusVencimento || "ok",
        diasParaVencimento: periodo?.diasParaVencimento ?? 999,
      });
    });

    // Also include any férias entries for people not in colaboradores
    ferias.forEach((f) => {
      if (!map.has(f.colaborador)) {
        map.set(f.colaborador, {
          nome: f.colaborador,
          departamento: f.departamento,
          saldoTotal: 30,
          diasUsados: f.status === "aprovado" ? f.diasSolicitados : 0,
          diasPendentes: f.status === "pendente" ? f.diasSolicitados : 0,
          saldoDisponivel: f.saldoDias,
          periodoAquisitivo: "N/A",
          vencimento: "N/A",
          statusVencimento: "ok",
          diasParaVencimento: 999,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const order = { vencido: 0, alerta: 1, ok: 2 };
      return order[a.statusVencimento] - order[b.statusVencimento] || a.nome.localeCompare(b.nome);
    });
  }, [colaboradores, ferias]);

  const filtered = useMemo(() => {
    if (!search.trim()) return saldos;
    const q = search.toLowerCase();
    return saldos.filter(
      (s) => s.nome.toLowerCase().includes(q) || s.departamento.toLowerCase().includes(q)
    );
  }, [saldos, search]);

  const summary = useMemo(() => ({
    total: saldos.length,
    vencidos: saldos.filter((s) => s.statusVencimento === "vencido").length,
    alertas: saldos.filter((s) => s.statusVencimento === "alerta").length,
  }), [saldos]);

  const vencimentoTooltip = (s: ColaboradorSaldo) => {
    if (s.statusVencimento === "vencido") return "Férias vencidas! Conceder imediatamente.";
    if (s.statusVencimento === "alerta") return `Faltam ${s.diasParaVencimento} dias para vencer`;
    return "Dentro do prazo";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Colaboradores</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/10">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.alertas}</p>
            <p className="text-xs text-muted-foreground">Vencem em até 90 dias</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{summary.vencidos}</p>
            <p className="text-xs text-muted-foreground">Férias vencidas</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar colaborador ou departamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Colaborador</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Departamento</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Saldo</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Usados</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Pendentes</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Progresso</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Per. Aquisitivo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum colaborador encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const pct = (s.diasUsados / s.saldoTotal) * 100;
                  return (
                    <tr
                      key={s.nome}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                        s.statusVencimento === "vencido" && "bg-destructive/5"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {s.nome.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{s.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.departamento}</td>
                      <td className="px-4 py-3 text-center font-semibold text-foreground">{s.saldoDisponivel}d</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{s.diasUsados}d</td>
                      <td className="px-4 py-3 text-center">
                        {s.diasPendentes > 0 ? (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[11px]">
                            {s.diasPendentes}d
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-[11px] text-muted-foreground w-8">{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.periodoAquisitivo}</td>
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] cursor-help",
                                s.statusVencimento === "vencido" && "bg-destructive/10 text-destructive border-destructive/20",
                                s.statusVencimento === "alerta" && "bg-warning/10 text-warning border-warning/20",
                                s.statusVencimento === "ok" && "bg-success/10 text-success border-success/20"
                              )}
                            >
                              {s.statusVencimento === "ok" && <CheckCircle className="w-3 h-3 mr-1" />}
                              {s.statusVencimento === "alerta" && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {s.statusVencimento === "vencido" && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {s.vencimento}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            {vencimentoTooltip(s)}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
