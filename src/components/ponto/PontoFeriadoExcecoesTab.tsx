import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Plus, Trash2, Loader2, Search, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useToast } from "@/hooks/use-toast";

interface FeriadoExcecao {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  data: string | null;
  comportamento: "folga" | "trabalha";
}

export function PontoFeriadoExcecoesTab() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { colaboradores } = useColaboradores({ excluirPJ: true, apenasBatePonto: true, excluirInativos: true });

  const [showForm, setShowForm] = useState(false);
  const [cargoFiltro, setCargoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [comportamento, setComportamento] = useState<"folga" | "trabalha">("folga");
  const [escopo, setEscopo] = useState<"todos" | "data">("todos");
  const [data, setData] = useState<string>("");
  const [reconsolidando, setReconsolidando] = useState(false);

  const cargos = useMemo(() => {
    const s = new Set<string>();
    colaboradores.forEach((c) => { if (c.cargo) s.add(c.cargo); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [colaboradores]);

  const colaboradoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return colaboradores.filter((c) => {
      if (cargoFiltro !== "todos" && c.cargo !== cargoFiltro) return false;
      if (q && !(c.nome_completo || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [colaboradores, cargoFiltro, busca]);

  const { data: excecoes = [], isLoading } = useQuery({
    queryKey: ["feriado-excecoes", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriado_excecao" as any)
        .select("*")
        .order("data", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data || []) as unknown as FeriadoExcecao[];
    },
    enabled: !!tenantId,
  });

  const mapaColaboradores = useMemo(() => {
    const m = new Map<string, { nome: string; cargo: string }>();
    colaboradores.forEach((c) => m.set(c.id, { nome: c.nome_completo, cargo: c.cargo }));
    return m;
  }, [colaboradores]);

  const reconsolidarDia = async (d: string) => {
    if (!tenantId) return;
    setReconsolidando(true);
    try {
      const { error } = await supabase.rpc("consolidar_ponto_dia_todos" as any, {
        p_tenant_id: tenantId,
        p_data: d,
      } as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ponto-diario"] });
    } catch (e: any) {
      toast({ title: "Falha ao reconsolidar espelho", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setReconsolidando(false);
    }
  };

  const toggleSel = (id: string) => {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleSelAll = () => {
    const allIds = colaboradoresFiltrados.map((c) => c.id);
    const all = allIds.every((id) => selecionados.has(id));
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (all) { allIds.forEach((id) => n.delete(id)); }
      else { allIds.forEach((id) => n.add(id)); }
      return n;
    });
  };

  const abrirForm = () => {
    setSelecionados(new Set());
    setCargoFiltro("todos");
    setBusca("");
    setComportamento("folga");
    setEscopo("todos");
    setData("");
    setShowForm(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado.");
      if (selecionados.size === 0) throw new Error("Selecione ao menos um colaborador.");
      if (escopo === "data" && !data) throw new Error("Informe a data.");

      const rows = Array.from(selecionados).map((colaborador_id) => ({
        tenant_id: tenantId,
        colaborador_id,
        data: escopo === "data" ? data : null,
        comportamento,
      }));
      const { error } = await supabase.from("feriado_excecao" as any).insert(rows as any);
      if (error) throw error;
      return escopo === "data" ? data : null;
    },
    onSuccess: async (dataSalva) => {
      toast({ title: "Exceções cadastradas" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["feriado-excecoes", tenantId] });
      if (dataSalva) await reconsolidarDia(dataSalva);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e?.message || "Tente novamente.", variant: "destructive" });
    },
  });

  const removerMutation = useMutation({
    mutationFn: async (e: FeriadoExcecao) => {
      const { error } = await supabase.from("feriado_excecao" as any).delete().eq("id", e.id);
      if (error) throw error;
      return e.data;
    },
    onSuccess: async (d) => {
      toast({ title: "Exceção removida" });
      queryClient.invalidateQueries({ queryKey: ["feriado-excecoes", tenantId] });
      if (d) await reconsolidarDia(d);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover", description: e?.message || "Tente novamente.", variant: "destructive" });
    },
  });

  const todosSelecionadosNoFiltro =
    colaboradoresFiltrados.length > 0 &&
    colaboradoresFiltrados.every((c) => selecionados.has(c.id));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Exceções por colaborador
            </CardTitle>
            <CardDescription>
              Por padrão, folga/trabalha em feriado vem da escala. Use exceções para casos individuais — vale para todos os feriados ou para uma data específica.
            </CardDescription>
          </div>
          <Button onClick={abrirForm} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova exceção
          </Button>
        </CardHeader>
        <CardContent>
          {reconsolidando && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 p-2 rounded bg-muted/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reconsolidando espelho de ponto…
            </div>
          )}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="w-[180px]">Cargo</TableHead>
                  <TableHead className="w-[150px]">Comportamento</TableHead>
                  <TableHead className="w-[200px]">Escopo</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </TableCell></TableRow>
                ) : excecoes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhuma exceção cadastrada.
                  </TableCell></TableRow>
                ) : excecoes.map((e) => {
                  const c = mapaColaboradores.get(e.colaborador_id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{c?.nome || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c?.cargo || "—"}</TableCell>
                      <TableCell>
                        {e.comportamento === "trabalha" ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Trabalha</Badge>
                        ) : (
                          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">Folga</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.data ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <Badge variant="secondary">Todos os feriados</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Remover exceção?",
                              description: `Remover exceção de ${c?.nome || "colaborador"}${e.data ? ` em ${new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}.`,
                              confirmLabel: "Remover",
                              variant: "destructive",
                            });
                            if (ok) removerMutation.mutate(e);
                          }}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova exceção de feriado</DialogTitle>
            <DialogDescription>
              Selecione colaboradores e defina o comportamento. Uma linha será criada por colaborador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Filtrar por cargo</Label>
                <Select value={cargoFiltro} onValueChange={setCargoFiltro}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os cargos</SelectItem>
                    {cargos.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Buscar por nome</Label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" placeholder="Nome do colaborador" />
                </div>
              </div>
            </div>

            <div className="rounded-md border max-h-64 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={todosSelecionadosNoFiltro}
                        onCheckedChange={toggleSelAll}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="w-[180px]">Cargo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradoresFiltrados.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground">Nenhum colaborador encontrado.</TableCell></TableRow>
                  ) : colaboradoresFiltrados.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => toggleSel(c.id)}>
                      <TableCell><Checkbox checked={selecionados.has(c.id)} onCheckedChange={() => toggleSel(c.id)} /></TableCell>
                      <TableCell className="font-medium">{c.nome_completo}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.cargo || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-xs text-muted-foreground">
              {selecionados.size} colaborador(es) selecionado(s).
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Comportamento</Label>
                <RadioGroup value={comportamento} onValueChange={(v) => setComportamento(v as any)}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="folga" id="comp-folga" />
                    <Label htmlFor="comp-folga" className="font-normal cursor-pointer">Folga (não trabalha no feriado)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="trabalha" id="comp-trab" />
                    <Label htmlFor="comp-trab" className="font-normal cursor-pointer">Trabalha no feriado</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Escopo</Label>
                <RadioGroup value={escopo} onValueChange={(v) => setEscopo(v as any)}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="todos" id="esc-todos" />
                    <Label htmlFor="esc-todos" className="font-normal cursor-pointer">Para todos os feriados</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="data" id="esc-data" />
                    <Label htmlFor="esc-data" className="font-normal cursor-pointer">Para uma data específica</Label>
                  </div>
                </RadioGroup>
                {escopo === "data" && (
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending || selecionados.size === 0}>
              {salvarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar exceções
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
