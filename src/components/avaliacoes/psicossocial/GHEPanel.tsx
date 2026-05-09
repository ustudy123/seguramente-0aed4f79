import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Plus, Pencil, Trash2, Loader2, Building2, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useDepartamentos, useCargos } from "@/hooks/useCadastros";

interface GHE {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

interface GHECargo {
  id: string;
  ghe_id: string;
  cargo_id: string;
  departamento_id: string | null;
}

interface FormState {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  cargoIds: string[];
}

const emptyForm: FormState = { codigo: "", nome: "", descricao: "", cargoIds: [] };

export function GHEPanel() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();
  const { departamentos } = useDepartamentos();
  const { cargos } = useCargos();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDel, setConfirmDel] = useState<GHE | null>(null);

  const { data: ghes = [], isLoading } = useQuery({
    queryKey: ["psicossocial_ghe", tenantId, empresaAtivaId],
    queryFn: async () => {
      let q = fromTable("psicossocial_ghe").select("*").eq("tenant_id", tenantId!).order("codigo");
      if (empresaAtivaId) q = q.or(`empresa_id.eq.${empresaAtivaId},empresa_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as GHE[];
    },
    enabled: !!tenantId,
  });

  const { data: associacoes = [] } = useQuery({
    queryKey: ["psicossocial_ghe_cargos", tenantId, ghes.map((g) => g.id).join(",")],
    queryFn: async () => {
      if (ghes.length === 0) return [];
      const { data, error } = await fromTable("psicossocial_ghe_cargos")
        .select("*")
        .in("ghe_id", ghes.map((g) => g.id));
      if (error) throw error;
      return (data || []) as GHECargo[];
    },
    enabled: !!tenantId && ghes.length > 0,
  });

  const cargosById = useMemo(() => Object.fromEntries(cargos.map((c) => [c.id, c])), [cargos]);
  const deptById = useMemo(() => Object.fromEntries(departamentos.map((d) => [d.id, d])), [departamentos]);

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.codigo.trim() || !f.nome.trim()) throw new Error("Código e Nome são obrigatórios");
      let gheId = f.id;
      if (gheId) {
        const { error } = await fromTable("psicossocial_ghe")
          .update({ codigo: f.codigo.trim(), nome: f.nome.trim(), descricao: f.descricao.trim() || null })
          .eq("id", gheId);
        if (error) throw error;
        await fromTable("psicossocial_ghe_cargos").delete().eq("ghe_id", gheId);
      } else {
        const { data, error } = await fromTable("psicossocial_ghe")
          .insert({
            tenant_id: tenantId!,
            empresa_id: empresaAtivaId || null,
            codigo: f.codigo.trim(),
            nome: f.nome.trim(),
            descricao: f.descricao.trim() || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        gheId = (data as any).id;
      }
      if (f.cargoIds.length > 0) {
        const rows = f.cargoIds.map((cid) => ({
          ghe_id: gheId,
          cargo_id: cid,
          departamento_id: cargosById[cid]?.departamento_id || null,
          tenant_id: tenantId!,
        }));
        const { error } = await fromTable("psicossocial_ghe_cargos").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("GHE salvo");
      qc.invalidateQueries({ queryKey: ["psicossocial_ghe"] });
      qc.invalidateQueries({ queryKey: ["psicossocial_ghe_cargos"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("psicossocial_ghe").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("GHE removido");
      qc.invalidateQueries({ queryKey: ["psicossocial_ghe"] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleNovo = () => {
    const next = `GHE ${String(ghes.length + 1).padStart(2, "0")}`;
    setForm({ ...emptyForm, codigo: next });
    setOpen(true);
  };

  const handleEditar = (g: GHE) => {
    const cargoIds = associacoes.filter((a) => a.ghe_id === g.id).map((a) => a.cargo_id);
    setForm({ id: g.id, codigo: g.codigo, nome: g.nome, descricao: g.descricao || "", cargoIds });
    setOpen(true);
  };

  const toggleCargo = (id: string) => {
    setForm((f) => ({
      ...f,
      cargoIds: f.cargoIds.includes(id) ? f.cargoIds.filter((c) => c !== id) : [...f.cargoIds, id],
    }));
  };

  // Agrupa cargos por departamento para o seletor
  const cargosPorDept = useMemo(() => {
    const map: Record<string, typeof cargos> = {};
    cargos.forEach((c) => {
      const key = c.departamento_id || "_sem_dept";
      (map[key] ||= []).push(c);
    });
    return map;
  }, [cargos]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Grupo Homogêneo de Exposição (GHE)
          </h2>
          <p className="text-sm text-muted-foreground">
            Agrupe departamentos e funções com exposição a riscos psicossociais semelhantes.
          </p>
        </div>
        <Button onClick={handleNovo} className="gap-2">
          <Plus className="h-4 w-4" /> Novo GHE
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : ghes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum GHE cadastrado. Clique em <strong>Novo GHE</strong> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {ghes.map((g) => {
            const assoc = associacoes.filter((a) => a.ghe_id === g.id);
            const deptIds = Array.from(new Set(assoc.map((a) => a.departamento_id).filter(Boolean) as string[]));
            return (
              <motion.div key={g.id} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <Card className="h-full">
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                            {g.codigo}
                          </Badge>
                          <p className="font-medium text-sm">{g.nome}</p>
                        </div>
                        {g.descricao && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.descricao}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditar(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setConfirmDel(g)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>
                          {deptIds.length} departamento{deptIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {deptIds.slice(0, 3).map((id) => (
                          <Badge key={id} variant="outline" className="text-[10px]">
                            {deptById[id]?.nome || "—"}
                          </Badge>
                        ))}
                        {deptIds.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">+{deptIds.length - 3}</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>
                          {assoc.length} função{assoc.length !== 1 ? "ões" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {assoc.slice(0, 4).map((a) => (
                          <Badge key={a.id} variant="secondary" className="text-[10px]">
                            {cargosById[a.cargo_id]?.nome || "—"}
                          </Badge>
                        ))}
                        {assoc.length > 4 && (
                          <Badge variant="secondary" className="text-[10px]">+{assoc.length - 4}</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar GHE" : "Novo GHE"}</DialogTitle>
            <DialogDescription>
              Defina o código, nome e selecione os cargos (com seus departamentos) que compõem este grupo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  placeholder="GHE 01"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex.: Operação Administrativa"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição (opcional)</Label>
              <Textarea
                id="desc"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Características da exposição psicossocial deste grupo…"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Funções do GHE ({form.cargoIds.length} selecionadas)</Label>
              <div className="border rounded-lg max-h-72 overflow-y-auto p-2 space-y-3">
                {Object.entries(cargosPorDept).map(([deptId, list]) => (
                  <div key={deptId}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {deptId === "_sem_dept" ? "Sem departamento" : deptById[deptId]?.nome || "—"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((c) => {
                        const checked = form.cargoIds.includes(c.id);
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => toggleCargo(c.id)}
                            className={`text-xs px-2 py-1 rounded-md border transition ${
                              checked
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border"
                            }`}
                          >
                            {c.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {cargos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum cargo cadastrado. Cadastre cargos antes de montar um GHE.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
