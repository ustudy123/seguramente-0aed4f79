import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Clock,
  CheckCircle,
  Plus,
  X,
  Calendar,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/dataLocal";

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

interface FeriasCalendarioProps {
  ferias: FeriasItem[];
  onNewSolicitacao?: (date: string) => void;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  aprovado: { bg: "bg-success/20", border: "border-success/40", text: "text-success" },
  pendente: { bg: "bg-warning/20", border: "border-warning/40", text: "text-warning" },
  recusado: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive" },
};

export function FeriasCalendario({ ferias, onNewSolicitacao }: FeriasCalendarioProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Find férias that overlap with current month
  const feriasThisMonth = useMemo(() => {
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    return ferias.filter((f) => {
      if (f.status === "recusado") return false;
      const start = new Date(f.dataInicio);
      const end = new Date(f.dataFim);
      return start <= monthEnd && end >= monthStart;
    });
  }, [ferias, currentMonth, currentYear]);

  // Map day -> férias entries
  const dayMap = useMemo(() => {
    const map: Record<number, FeriasItem[]> = {};
    feriasThisMonth.forEach((f) => {
      const start = new Date(f.dataInicio);
      const end = new Date(f.dataFim);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentYear, currentMonth, d);
        if (date >= start && date <= end) {
          if (!map[d]) map[d] = [];
          map[d].push(f);
        }
      }
    });
    return map;
  }, [feriasThisMonth, daysInMonth, currentMonth, currentYear]);

  // Timeline view data
  const timelineData = useMemo(() => {
    return feriasThisMonth.map((f) => {
      const start = new Date(f.dataInicio);
      const end = new Date(f.dataFim);
      const startDay = start.getMonth() === currentMonth && start.getFullYear() === currentYear
        ? start.getDate() : 1;
      const endDay = end.getMonth() === currentMonth && end.getFullYear() === currentYear
        ? end.getDate() : daysInMonth;
      return { ...f, startDay, endDay };
    });
  }, [feriasThisMonth, currentMonth, currentYear, daysInMonth]);

  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Month navigation */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-lg font-semibold text-foreground">
            {MESES[currentMonth]} {currentYear}
          </h3>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const entries = dayMap[day] || [];
              const weekend = (firstDayOfWeek + i) % 7 === 0 || (firstDayOfWeek + i) % 7 === 6;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                  className={cn(
                    "h-20 rounded-lg border p-1 text-xs transition-all text-left cursor-pointer hover:border-primary/50 hover:shadow-sm",
                    isToday(day)
                      ? "border-primary bg-primary/5"
                      : weekend
                        ? "border-border/50 bg-muted/30"
                        : "border-border/50",
                    entries.length > 0 && "bg-accent/30",
                    selectedDay === day && "ring-2 ring-primary border-primary"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-medium",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {entries.slice(0, 2).map((e) => {
                      const colors = statusColors[e.status];
                      return (
                        <div
                          key={e.id}
                          className={cn("truncate rounded px-1 py-0.5 text-[10px] font-medium", colors.bg, colors.text)}
                          title={e.colaborador}
                        >
                          {e.colaborador.split(" ")[0]}
                        </div>
                      );
                    })}
                    {entries.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{entries.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected day detail panel */}
      <AnimatePresence>
        {selectedDay !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  {selectedDay} de {MESES[currentMonth]} de {currentYear}
                </h4>
                <div className="flex items-center gap-2">
                  {onNewSolicitacao && (
                    <Button
                      size="sm"
                      className="gradient-primary"
                      onClick={() => {
                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
                        onNewSolicitacao(dateStr);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Nova Solicitação
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {(() => {
                const entries = dayMap[selectedDay] || [];
                if (entries.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhuma férias nesta data.
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {entries.map((e) => {
                      const colors = statusColors[e.status];
                      const startDate = formatDateBR(e.dataInicio);
                      const endDate = formatDateBR(e.dataFim);
                      return (
                        <div
                          key={e.id}
                          className={cn("flex items-center gap-4 p-3 rounded-lg border", colors.bg, colors.border)}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {e.colaborador.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{e.colaborador}</p>
                            <p className="text-xs text-muted-foreground">{e.departamento}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {startDate} → {endDate} · {e.diasSolicitados} dias
                            </p>
                          </div>
                          <Badge className={cn("text-[11px]", colors.bg, colors.text, colors.border)} variant="outline">
                            {e.status === "aprovado" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                            {e.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline view */}
      {timelineData.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            Períodos no mês
          </h4>
          <div className="space-y-3">
            {timelineData.map((item) => {
              const colors = statusColors[item.status];
              const widthPct = ((item.endDay - item.startDay + 1) / daysInMonth) * 100;
              const leftPct = ((item.startDay - 1) / daysInMonth) * 100;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0 flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {item.colaborador.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground truncate">{item.colaborador.split(" ").slice(0, 2).join(" ")}</span>
                  </div>
                  <div className="flex-1 relative h-7 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className={cn("absolute top-0 h-full rounded-md flex items-center justify-center text-[10px] font-semibold", colors.bg, colors.text, colors.border, "border")}
                      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 5)}%` }}
                    >
                      {item.diasSolicitados}d
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] flex-shrink-0", colors.bg, colors.text, colors.border)} variant="outline">
                    {item.status === "aprovado" ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                    {item.status}
                  </Badge>
                </div>
              );
            })}
          </div>
          {/* Day ruler */}
          <div className="flex mt-2 border-t border-border pt-2">
            {[1, 5, 10, 15, 20, 25, daysInMonth].map((d) => (
              <span
                key={d}
                className="text-[10px] text-muted-foreground"
                style={{ position: "relative", left: `${((d - 1) / daysInMonth) * 100}%` }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
