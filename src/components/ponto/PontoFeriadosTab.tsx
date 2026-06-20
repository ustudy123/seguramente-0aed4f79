import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";

interface Feriado {
  id: string;
  tenant_id: string | null;
  data: string;
  nome: string;
  abrangencia: "nacional" | "estadual" | "municipal";
  uf: string | null;
  municipio: string | null;
  codigo_ibge: string | null;
  tipo: "feriado" | "facultativo";
  ativo: boolean;
}

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const emptyForm = {
  data: "",
  nome: "",
  abrangencia: "estadual" as "estadual" | "municipal",
  uf: "" as string,
  municipio: "" as string,
  codigo_ibge: "" as string,
  tipo: "feriado" as "feriado" | "facultativo",
  ativo: true,
};

export function PontoFeriadosTab() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState<number>(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Feriado | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  
  const [reconsolidando, setReconsolidando] = useState(false);

  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados", tenantId, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados" as any)
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Feriado[];
    },
    enabled: !!tenantId,
  });

  const anos = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 3; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const reconsolidarDia = async (data: string) => {
    if (!tenantId) return;
    setReconsolidando(true);
    try {
      const { error } = await supabase.rpc("consolidar_ponto_dia_todos" as any, {
        p_tenant_id: tenantId,
        p_data: data,
      } as any);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ponto-diario"] });
    } catch (e: any) {
      toast({
        title: "Falha ao reconsolidar espelho",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setReconsolidando(false);
    }
  };

  const abrirNovo = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const abrirEdicao = (f: Feriado) => {
    setEditing(f);
    setForm({
      data: f.data,
      nome: f.nome,
      abrangencia: (f.abrangencia === "municipal" ? "municipal" : "estadual"),
      uf: f.uf || "",
      municipio: f.municipio || "",
      codigo_ibge: f.codigo_ibge || "",
      tipo: f.tipo === "facultativo" ? "facultativo" : "feriado",
      ativo: f.ativo,
    });
    setShowForm(true);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado.");
      if (!form.data) throw new Error("Informe a data.");
      if (!form.nome.trim()) throw new Error("Informe o nome do feriado.");
      if (!form.uf) throw new Error("Selecione a UF.");
      if (form.abrangencia === "municipal" && !form.municipio.trim()) {
        throw new Error("Informe o município para feriado municipal.");
      }

      const payload = {
        tenant_id: tenantId,
        data: form.data,
        nome: form.nome.trim(),
        abrangencia: form.abrangencia,
        uf: form.uf,
        municipio: form.abrangencia === "municipal" ? form.municipio.trim() : null,
        codigo_ibge: form.codigo_ibge?.trim() || null,
        tipo: form.tipo,
        ativo: form.ativo,
      };

      if (editing) {
        const { error } = await supabase
          .from("feriados" as any)
          .update(payload as any)
          .eq("id", editing.id);
        if (error) throw error;
        return { data: form.data, dataAnterior: editing.data };
      } else {
        const { error } = await supabase.from("feriados" as any).insert(payload as any);
        if (error) throw error;
        return { data: form.data, dataAnterior: null as string | null };
      }
    },
    onSuccess: async ({ data, dataAnterior }) => {
      toast({ title: editing ? "Feriado atualizado" : "Feriado adicionado" });
      setShowForm(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["feriados", tenantId] });
      await reconsolidarDia(data);
      if (dataAnterior && dataAnterior !== data) {
        await reconsolidarDia(dataAnterior);
      }
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao salvar",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (f: Feriado) => {
      const { error } = await supabase.from("feriados" as any).delete().eq("id", f.id);
      if (error) throw error;
      return f.data;
    },
    onSuccess: async (data) => {
      toast({ title: "Feriado excluído" });
      
      queryClient.invalidateQueries({ queryKey: ["feriados", tenantId] });
      await reconsolidarDia(data);
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao excluir",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Feriados
            </CardTitle>
            <CardDescription>
              Gerencie feriados estaduais e municipais do tenant. Feriados nacionais são fornecidos pelo sistema.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anos.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={abrirNovo} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar feriado
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reconsolidando && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 p-2 rounded bg-muted/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reconsolidando espelho de ponto dos colaboradores… isso pode levar alguns segundos.
            </div>
          )}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[130px]">Abrangência</TableHead>
                  <TableHead className="w-[70px]">UF</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead className="w-[110px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                    </TableCell>
                  </TableRow>
                ) : feriados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nenhum feriado para {ano}.
                    </TableCell>
                  </TableRow>
                ) : (
                  feriados.map((f) => {
                    const isNacional = !f.tenant_id || f.abrangencia === "nacional";
                    return (
                      <TableRow key={f.id} className={!f.ativo ? "opacity-60" : ""}>
                        <TableCell className="font-mono text-xs">
                          {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>
                          {isNacional ? (
                            <Badge variant="secondary">Nacional</Badge>
                          ) : f.abrangencia === "estadual" ? (
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Estadual</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Municipal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{f.uf || "—"}</TableCell>
                        <TableCell className="text-xs">{f.municipio || "—"}</TableCell>
                        <TableCell>
                          {f.tipo === "facultativo" ? (
                            <Badge variant="outline">Facultativo</Badge>
                          ) : (
                            <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">Feriado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isNacional ? (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Info className="h-3 w-3" /> Somente leitura
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => abrirEdicao(f)}
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setConfirmDel(f)}
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form modal */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar feriado" : "Adicionar feriado"}</DialogTitle>
            <DialogDescription>
              Feriados estaduais ou municipais do tenant. Após salvar, o espelho de ponto é reconsolidado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm({ ...form, tipo: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feriado">Feriado</SelectItem>
                    <SelectItem value="facultativo">Facultativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Aniversário do município"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Abrangência</Label>
                <Select
                  value={form.abrangencia}
                  onValueChange={(v) => setForm({ ...form, abrangencia: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estadual">Estadual</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>UF</Label>
                <Select value={form.uf} onValueChange={(v) => setForm({ ...form, uf: v })}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.abrangencia === "municipal" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-1">
                  <Label>Município</Label>
                  <Input
                    value={form.municipio}
                    onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                    placeholder="Ex.: Itapejara d'Oeste"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>Código IBGE (opcional)</Label>
                  <Input
                    value={form.codigo_ibge}
                    onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value })}
                    placeholder="Ex.: 4111506"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => salvarMutation.mutate()}
              disabled={salvarMutation.isPending}
            >
              {salvarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
