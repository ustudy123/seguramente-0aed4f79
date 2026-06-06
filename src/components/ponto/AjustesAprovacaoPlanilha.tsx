import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Paperclip, FileText, Shield, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PontoAjuste } from "@/hooks/usePonto";

const SLOTS: Array<{ key: "entrada" | "saida_almoco" | "retorno_almoco" | "saida"; label: string; short: string }> = [
  { key: "entrada", label: "Entrada", short: "Entrada" },
  { key: "saida_almoco", label: "Saída Almoço", short: "S. Almoço" },
  { key: "retorno_almoco", label: "Retorno Almoço", short: "R. Almoço" },
  { key: "saida", label: "Saída", short: "Saída" },
];

const formatDate = (iso: string) => {
  const raw = (iso || "").toString().slice(0, 10);
  const [y, m, d] = raw.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

interface Props {
  ajustes: PontoAjuste[];
  processarAjuste: (args: { ajusteId: string; aprovado: boolean; observacao?: string; multiple?: boolean }) => Promise<unknown> | void;
  processando: boolean;
  onOpenAnexos: (ajuste: PontoAjuste) => void;
}

export function AjustesAprovacaoPlanilha({ ajustes, processarAjuste, processando, onOpenAnexos }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "aprovado" | "rejeitado">("pendente");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Group: colaborador_id -> data_referencia -> ajustes[]
  const grouped = useMemo(() => {
    const filtered = ajustes.filter((a) => {
      if (statusFilter !== "todos" && a.status !== statusFilter) return false;
      if (search && !a.colaborador_nome.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const map = new Map<string, { nome: string; cpf: string; days: Map<string, PontoAjuste[]> }>();
    for (const a of filtered) {
      const colabId = a.colaborador_id;
      if (!map.has(colabId)) {
        map.set(colabId, { nome: a.colaborador_nome, cpf: a.colaborador_cpf, days: new Map() });
      }
      const colab = map.get(a.colaborador_id)!;
      const dateKey = (a.data_referencia || "").toString().slice(0, 10);
      if (!colab.days.has(dateKey)) colab.days.set(dateKey, []);
      colab.days.get(dateKey)!.push(a);
    }
    return Array.from(map.entries())
      .map(([id, info]) => ({
        id,
        nome: info.nome,
        cpf: info.cpf,
        days: Array.from(info.days.entries())
          .map(([date, items]) => ({ date, items }))
          .sort((a, b) => b.date.localeCompare(a.date)),
        totalPendentes: Array.from(info.days.values()).flat().filter((a) => a.status === "pendente").length,
      }))
      .sort((a, b) => b.totalPendentes - a.totalPendentes || a.nome.localeCompare(b.nome));
  }, [ajustes, statusFilter, search]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprovarDia = async (items: PontoAjuste[]) => {
    const pendentes = items.filter((a) => a.status === "pendente");
    if (pendentes.length === 0) return;
    
    // Processa todos menos o último silenciosamente
    for (let i = 0; i < pendentes.length - 1; i++) {
      await processarAjuste({ ajusteId: pendentes[i].id, aprovado: true, multiple: true });
    }
    // O último dispara o feedback visual
    await processarAjuste({ ajusteId: pendentes[pendentes.length - 1].id, aprovado: true });
  };

  const handleRejeitarDia = async (items: PontoAjuste[]) => {
    const pendentes = items.filter((a) => a.status === "pendente");
    if (pendentes.length === 0) return;

    const obs = window.prompt(`Observação para rejeição (${pendentes.length} marcação(ões) do dia):`, "") ?? undefined;
    
    // Processa todos menos o último silenciosamente
    for (let i = 0; i < pendentes.length - 1; i++) {
      await processarAjuste({ ajusteId: pendentes[i].id, aprovado: false, observacao: obs, multiple: true });
    }
    // O último dispara o feedback visual
    await processarAjuste({ ajusteId: pendentes[pendentes.length - 1].id, aprovado: false, observacao: obs });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl border overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Folha de Aprovação de Ajustes</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada linha = um dia. Aprove ou rejeite o dia inteiro de uma só vez.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 w-56 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Apenas pendentes</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="rejeitado">Rejeitados</SelectItem>
                <SelectItem value="todos">Todos os status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Legenda */}
        <div className="px-5 py-2 border-b bg-muted/10 flex items-center gap-4 flex-wrap text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span>Inclusão (marcação nova)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            <span>Alteração (substitui original)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-300" />
            <span>Sem alteração</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-indigo-100 border border-indigo-300" />
            <span>Justificativa</span>
          </div>
        </div>

        <div className="divide-y">
          {grouped.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhuma solicitação de ajuste encontrada com os filtros atuais.
            </div>
          )}

          {grouped.map((colab) => {
            const isCollapsed = collapsed.has(colab.id);
            return (
              <div key={colab.id} className="bg-card">
                {/* Cabeçalho colaborador */}
                <button
                  type="button"
                  onClick={() => toggle(colab.id)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {colab.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{colab.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {colab.days.length} dia(s) com ajustes • {colab.days.reduce((s, d) => s + d.items.length, 0)} marcação(ões)
                      </p>
                    </div>
                  </div>
                  {colab.totalPendentes > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 font-semibold">
                      {colab.days.filter(d => d.items.some(a => a.status === "pendente")).length} dia(s) pendente(s)
                    </Badge>
                  )}
                </button>

                {/* Planilha de dias */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-t">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3 text-left w-28">Data</th>
                              {SLOTS.map((s) => (
                                <th key={s.key} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3 text-center">{s.short}</th>
                              ))}
                              <th className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3 text-left min-w-[180px]">Motivo</th>
                              <th className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3 text-center w-16">Anexos</th>
                              <th className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3 text-center w-20">Status</th>
                              <th className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3 text-right w-52">Ações do Dia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {colab.days.map(({ date, items }) => {
                              const hasPendente = items.some((a) => a.status === "pendente");
                              const allApr = items.every((a) => a.status === "aprovado");
                              const allRej = items.every((a) => a.status === "rejeitado");
                              const totalAnexos = items.reduce((s, a) => s + (a.anexos?.length ?? 0), 0);
                              const firstAjusteAnexo = items.find((a) => (a.anexos?.length ?? 0) > 0);
                              const motivos = Array.from(new Set(items.map((a) => a.motivo).filter(Boolean)));

                              return (
                                <tr key={date} className={cn("border-t hover:bg-muted/20", !hasPendente && "opacity-90")}>
                                  <td className="py-2.5 px-3 font-mono font-semibold text-sm text-foreground/90 align-top">
                                    {formatDate(date)}
                                  </td>

                                  {SLOTS.map((slot) => {
                                    const ajuste = items.find((a) => a.tipo_marcacao === slot.key);
                                    if (!ajuste) {
                                      return (
                                        <td key={slot.key} className="py-2.5 px-3 text-center align-top">
                                          <span className="inline-block w-full text-xs text-muted-foreground/60 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">—</span>
                                        </td>
                                      );
                                    }
                                    const isInclusao = ajuste.tipo_ajuste === "inclusao";
                                    const isCorrecao = ajuste.tipo_ajuste === "correcao";
                                    const isJust = ajuste.tipo_ajuste === "justificativa";
                                    return (
                                      <td key={slot.key} className="py-2.5 px-3 text-center align-top">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div
                                              className={cn(
                                                "rounded border px-2 py-1.5 font-mono text-sm font-semibold cursor-help",
                                                isInclusao && "bg-emerald-50 border-emerald-300 text-emerald-900",
                                                isCorrecao && "bg-amber-50 border-amber-300 text-amber-900",
                                                isJust && "bg-indigo-50 border-indigo-300 text-indigo-900",
                                              )}
                                            >
                                              {isJust ? "JUST" : ajuste.hora_solicitada || "—"}
                                              {isCorrecao && ajuste.hora_original && (
                                                <div className="text-[10px] font-normal text-muted-foreground line-through mt-0.5">
                                                  {ajuste.hora_original}
                                                </div>
                                              )}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs">
                                            <p className="font-semibold mb-1">{slot.label} — {isInclusao ? "Inclusão" : isCorrecao ? "Alteração" : "Justificativa"}</p>
                                            <p className="text-xs">Motivo: {ajuste.motivo}</p>
                                            {isCorrecao && ajuste.hora_original && (
                                              <p className="text-xs mt-1">Original: <span className="line-through">{ajuste.hora_original}</span> → Solicitado: <strong>{ajuste.hora_solicitada}</strong></p>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      </td>
                                    );
                                  })}

                                  <td className="py-2.5 px-3 align-top">
                                    <p className="text-xs leading-snug line-clamp-2">
                                      {motivos.join(" • ") || "—"}
                                    </p>
                                  </td>

                                  <td className="py-2.5 px-3 text-center align-top">
                                    {totalAnexos > 0 && firstAjusteAnexo ? (
                                      <Button size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={() => onOpenAnexos(firstAjusteAnexo)}>
                                        <Paperclip className="w-3 h-3" />
                                        <span className="text-[11px]">{totalAnexos}</span>
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-center align-top">
                                    {hasPendente && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">Pendente</Badge>}
                                    {!hasPendente && allApr && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">Aprovado</Badge>}
                                    {!hasPendente && allRej && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px]">Rejeitado</Badge>}
                                    {!hasPendente && !allApr && !allRej && <Badge variant="outline" className="text-[10px]">Misto</Badge>}
                                  </td>

                                  <td className="py-2.5 px-3 text-right align-top">
                                    {hasPendente ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                          onClick={() => handleApprovarDia(items)}
                                          disabled={processando}
                                        >
                                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar dia
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-rose-700 border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                          onClick={() => handleRejeitarDia(items)}
                                          disabled={processando}
                                        >
                                          <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">
                                        {items[0].aprovado_por_nome ? `por ${items[0].aprovado_por_nome}` : "—"}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t bg-muted/20 flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5" />
          Logs de auditoria em conformidade com Portaria 671 MTP
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
