import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, Plus, Pencil, Trash2, Loader2, Building2, Briefcase, Search, X, Check, Archive, ArchiveRestore, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useDepartamentos, useCargos } from "@/hooks/useCadastros";
import { GHE_CATEGORIAS, type GHECategoria, type GHETemplate } from "./gheCatalog";

interface GHE {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
}

interface GHECargo {
  id: string;
  ghe_id: string;
  cargo_id: string;
  departamento_id: string | null;
}

// Par cargo+departamento — chave única
type PairKey = string; // `${cargoId}|${deptId || "_"}`
const makeKey = (cargoId: string, deptId: string | null) => `${cargoId}|${deptId || "_"}`;
const parseKey = (k: PairKey): { cargoId: string; deptId: string | null } => {
  const [cargoId, dep] = k.split("|");
  return { cargoId, deptId: dep === "_" ? null : dep };
};

interface FormState {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  pairs: PairKey[];
}

const emptyForm: FormState = { codigo: "", nome: "", descricao: "", pairs: [] };

export function GHEPanel() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();
  const { departamentos } = useDepartamentos();
  const { cargos } = useCargos();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"categoria" | "template" | "form">("categoria");
  const [categoria, setCategoria] = useState<GHECategoria | null>(null);
  const [refPadrao, setRefPadrao] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GHE | null>(null);
  const [deleteText, setDeleteText] = useState("");

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

  // Vínculos cargo→departamentos (suporte multi-departamento por cargo)
  const { data: cargoDeptLinks = [] } = useQuery({
    queryKey: ["cargo_departamentos", tenantId],
    queryFn: async () => {
      const { data, error } = await fromTable("cargo_departamentos")
        .select("cargo_id, departamento_id")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return (data || []) as Array<{ cargo_id: string; departamento_id: string }>;
    },
    enabled: !!tenantId,
  });

  const cargosById = useMemo(() => Object.fromEntries(cargos.map((c) => [c.id, c])), [cargos]);
  const deptById = useMemo(() => Object.fromEntries(departamentos.map((d) => [d.id, d])), [departamentos]);
  const gheById = useMemo(() => Object.fromEntries(ghes.map((g) => [g.id, g])), [ghes]);

  // Pares (cargo, departamento) ocupados por OUTROS GHEs
  const occupiedByOtherGhe = useMemo(() => {
    const map = new Map<PairKey, string>();
    associacoes.forEach((a) => {
      if (form.id && a.ghe_id === form.id) return;
      map.set(makeKey(a.cargo_id, a.departamento_id), a.ghe_id);
    });
    return map;
  }, [associacoes, form.id]);

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.codigo.trim() || !f.nome.trim()) throw new Error("Código e Nome são obrigatórios");
      const conflitos = f.pairs.filter((k) => occupiedByOtherGhe.has(k));
      if (conflitos.length > 0) {
        throw new Error(`${conflitos.length} função/departamento já pertence(m) a outro GHE.`);
      }
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
      if (f.pairs.length > 0) {
        const rows = f.pairs.map((k) => {
          const { cargoId, deptId } = parseKey(k);
          return {
            ghe_id: gheId,
            cargo_id: cargoId,
            departamento_id: deptId,
            tenant_id: tenantId!,
          };
        });
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
      toast.success("GHE excluído");
      qc.invalidateQueries({ queryKey: ["psicossocial_ghe"] });
      setDeleteTarget(null);
      setDeleteText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleArquivar = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await fromTable("psicossocial_ghe").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.ativo ? "GHE reativado" : "GHE arquivado");
      qc.invalidateQueries({ queryKey: ["psicossocial_ghe"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const nextCodigo = () => {
    const maxN = ghes.reduce((max, g) => {
      const m = /(\d+)/.exec(g.codigo || "");
      const n = m ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    return `GHE ${String(maxN + 1).padStart(2, "0")}`;
  };

  const handleNovo = () => {
    setForm({ ...emptyForm, codigo: nextCodigo() });
    setCategoria(null);
    setRefPadrao(null);
    setStep("categoria");
    setOpen(true);
  };

  const handleEditar = (g: GHE) => {
    const pairs = associacoes
      .filter((a) => a.ghe_id === g.id)
      .map((a) => makeKey(a.cargo_id, a.departamento_id));
    setForm({ id: g.id, codigo: g.codigo, nome: g.nome, descricao: g.descricao || "", pairs });
    setCategoria(null);
    setRefPadrao(null);
    setStep("form");
    setOpen(true);
  };

  const escolherCategoria = (cat: GHECategoria) => {
    setCategoria(cat);
    if (cat.templates.length === 1) {
      aplicarTemplate(cat.templates[0]);
    } else {
      setStep("template");
    }
  };

  const aplicarTemplate = (tpl: GHETemplate) => {
    setRefPadrao(tpl.ref);
    setForm((f) => ({
      ...f,
      nome: tpl.nome,
      descricao: tpl.descricao,
    }));
    setStep("form");
  };

  const togglePair = (key: PairKey) => {
    if (occupiedByOtherGhe.has(key)) {
      const otherGhe = gheById[occupiedByOtherGhe.get(key)!];
      toast.warning(`Já vinculado ao ${otherGhe?.codigo || "outro GHE"} — ${otherGhe?.nome || ""}`);
      return;
    }
    setForm((f) => ({
      ...f,
      pairs: f.pairs.includes(key) ? f.pairs.filter((p) => p !== key) : [...f.pairs, key],
    }));
  };

  // Expande cargos pelos departamentos vinculados e agrupa por departamento.
  type PairRow = { cargoId: string; deptId: string | null; cargoNome: string; key: PairKey };
  const pairsPorDept = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows: PairRow[] = [];
    cargos.forEach((c) => {
      const linked = cargoDeptLinks.filter((l) => l.cargo_id === c.id).map((l) => l.departamento_id);
      const depts: (string | null)[] = linked.length ? linked : [c.departamento_id || null];
      depts.forEach((dId) => {
        rows.push({ cargoId: c.id, deptId: dId, cargoNome: c.nome, key: makeKey(c.id, dId) });
      });
    });
    const map: Record<string, PairRow[]> = {};
    rows.forEach((r) => {
      if (term) {
        const deptName = (deptById[r.deptId || ""]?.nome || "").toLowerCase();
        const matches = r.cargoNome.toLowerCase().includes(term) || deptName.includes(term);
        if (!matches) return;
      }
      const key = r.deptId || "_sem_dept";
      (map[key] ||= []).push(r);
    });
    return map;
  }, [cargos, cargoDeptLinks, search, deptById]);

  const toggleDept = (deptId: string, allKeys: PairKey[]) => {
    const selectable = allKeys.filter((k) => !occupiedByOtherGhe.has(k));
    setForm((f) => {
      const allSelected = selectable.every((k) => f.pairs.includes(k));
      const pairs = allSelected
        ? f.pairs.filter((k) => !selectable.includes(k))
        : Array.from(new Set([...f.pairs, ...selectable]));
      return { ...f, pairs };
    });
  };

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
          <Plus className="h-4 w-4" /> Selecionar GHE
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
            const emUso = assoc.length > 0;
            return (
              <motion.div key={g.id} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <Card className={`h-full ${g.ativo === false ? "opacity-60 border-dashed" : ""}`}>
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                            {g.codigo}
                          </Badge>
                          <p className="font-medium text-sm">{g.nome}</p>
                          {g.ativo === false && (
                            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">
                              Arquivado
                            </Badge>
                          )}
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
                          className="h-7 w-7"
                          title={g.ativo === false ? "Reativar GHE" : "Arquivar GHE"}
                          onClick={() => toggleArquivar.mutate({ id: g.id, ativo: g.ativo === false })}
                        >
                          {g.ativo === false ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          title={emUso ? "GHE em uso — desassocie antes de excluir" : "Excluir GHE"}
                          onClick={() => {
                            setDeleteText("");
                            setDeleteTarget(g);
                          }}
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
                          {assoc.length === 1 ? "1 função" : `${assoc.length} funções`}
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

                    <div className="mt-auto pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Criado em {new Date(g.created_at).toLocaleDateString("pt-BR")}</span>
                      {g.updated_at && g.updated_at !== g.created_at && (
                        <span>Alterado em {new Date(g.updated_at).toLocaleDateString("pt-BR")}</span>
                      )}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? "Editar GHE"
                : step === "categoria"
                ? "Novo GHE — escolha a categoria"
                : step === "template"
                ? `${categoria?.emoji} ${categoria?.label}`
                : "Novo GHE — configurar"}
            </DialogTitle>
            <DialogDescription>
              {step === "categoria" && "Selecione a macro-categoria que melhor descreve o grupo de exposição."}
              {step === "template" && "Escolha um modelo padrão (você poderá ajustar nome e descrição em seguida)."}
              {step === "form" && "Defina o código, nome e selecione as funções (com seus departamentos) que compõem este grupo."}
            </DialogDescription>
          </DialogHeader>

          {step === "categoria" && !form.id && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {GHE_CATEGORIAS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => escolherCategoria(cat)}
                  className={`bg-gradient-to-br ${cat.cor} border rounded-lg p-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all`}
                >
                  <div className="text-2xl mb-1">{cat.emoji}</div>
                  <div className="text-xs font-semibold leading-tight">{cat.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {cat.templates.length} modelo{cat.templates.length !== 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "template" && categoria && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setStep("categoria")}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                ← Trocar categoria
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoria.templates.map((tpl) => (
                  <button
                    key={tpl.ref}
                    type="button"
                    onClick={() => aplicarTemplate(tpl)}
                    className="border rounded-lg p-3 text-left hover:bg-primary/5 hover:border-primary/40 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] font-mono">{tpl.ref}</Badge>
                      <span className="text-sm font-semibold">{tpl.nome}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tpl.descricao}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "form" && (
          <div className="space-y-4">
            {!form.id && categoria && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 border">
                <div className="text-xs flex items-center gap-2">
                  <span>{categoria.emoji}</span>
                  <span className="font-medium">{categoria.label}</span>
                  {refPadrao && (
                    <Badge variant="outline" className="text-[10px] font-mono">{refPadrao}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setStep("categoria")}
                >
                  Trocar modelo
                </Button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={form.codigo}
                  readOnly
                  disabled
                  className="bg-muted/60 font-semibold cursor-not-allowed"
                  placeholder="GHE 01"
                />
                <p className="text-[11px] text-muted-foreground">Gerado automaticamente</p>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Funções do GHE
                  <Badge variant="secondary" className="font-mono">
                    {form.pairs.length}
                  </Badge>
                </Label>
                {form.pairs.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, pairs: [] }))}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                  >
                    <X className="h-3 w-3" /> Limpar seleção
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Cada par <strong>cargo + departamento</strong> só pode pertencer a um único GHE. O mesmo cargo em outro departamento permanece disponível.
              </p>

              {/* Chips dos pares selecionados */}
              {form.pairs.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 bg-primary/5 border border-primary/20 rounded-lg max-h-24 overflow-y-auto">
                  {form.pairs.map((k) => {
                    const { cargoId, deptId } = parseKey(k);
                    const c = cargosById[cargoId];
                    if (!c) return null;
                    const dep = deptId ? deptById[deptId]?.nome : "Sem departamento";
                    return (
                      <Badge
                        key={k}
                        variant="default"
                        className="gap-1 pl-2 pr-1 py-0.5 bg-primary text-primary-foreground"
                      >
                        {c.nome} <span className="opacity-70">· {dep || "—"}</span>
                        <button
                          type="button"
                          onClick={() => togglePair(k)}
                          className="hover:bg-white/20 rounded-full p-0.5 ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar função ou departamento…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              {/* Lista agrupada por departamento */}
              <ScrollArea className="h-72 rounded-lg border bg-muted/20">
                <div className="p-2 space-y-1">
                  {Object.entries(pairsPorDept).map(([deptId, list]) => {
                    const keys = list.map((r) => r.key);
                    const selectableKeys = keys.filter((k) => !occupiedByOtherGhe.has(k));
                    const selectedCount = selectableKeys.filter((k) => form.pairs.includes(k)).length;
                    const allSelected = selectedCount === selectableKeys.length && selectableKeys.length > 0;
                    const someSelected = selectedCount > 0 && !allSelected;
                    return (
                      <div key={deptId} className="rounded-md bg-background border">
                        <button
                          type="button"
                          onClick={() => toggleDept(deptId, keys)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 rounded-t-md transition"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allSelected ? true : someSelected ? "indeterminate" : false}
                              className="pointer-events-none"
                            />
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {deptId === "_sem_dept" ? "Sem departamento" : deptById[deptId]?.nome || "—"}
                            </span>
                          </div>
                          <Badge variant={selectedCount > 0 ? "default" : "outline"} className="text-[10px] h-5">
                            {selectedCount}/{selectableKeys.length}
                          </Badge>
                        </button>
                        <div className="px-3 pb-2 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {list.map((r) => {
                            const checked = form.pairs.includes(r.key);
                            const occupiedGheId = occupiedByOtherGhe.get(r.key);
                            const occupied = !!occupiedGheId;
                            const otherGhe = occupiedGheId ? gheById[occupiedGheId] : null;
                            return (
                              <button
                                type="button"
                                key={r.key}
                                onClick={() => togglePair(r.key)}
                                disabled={occupied}
                                title={
                                  occupied
                                    ? `Já vinculado: ${otherGhe?.codigo || ""} — ${otherGhe?.nome || ""}`
                                    : undefined
                                }
                                className={`flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded transition ${
                                  occupied
                                    ? "opacity-50 cursor-not-allowed bg-muted/40 text-muted-foreground"
                                    : checked
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "hover:bg-muted text-foreground/80"
                                }`}
                              >
                                <span
                                  className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition ${
                                    checked ? "bg-primary border-primary" : "border-input bg-background"
                                  }`}
                                >
                                  {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                                </span>
                                <span className="truncate flex-1">{r.cargoNome}</span>
                                {occupied && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                    {otherGhe?.codigo || "ocupado"}
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(pairsPorDept).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      {cargos.length === 0
                        ? "Nenhum cargo cadastrado. Cadastre cargos antes de montar um GHE."
                        : "Nenhum resultado para a busca."}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {step === "form" && (
              <Button onClick={() => upsert.mutate(form)} disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteText(""); } }}>
        <DialogContent className="max-w-md">
          {(() => {
            const assocCount = deleteTarget ? associacoes.filter((a) => a.ghe_id === deleteTarget.id).length : 0;
            const bloqueado = assocCount > 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    {bloqueado ? "Não é possível excluir" : "Excluir GHE definitivamente"}
                  </DialogTitle>
                  <DialogDescription>
                    {bloqueado ? (
                      <>
                        O grupo <strong>{deleteTarget?.codigo} — {deleteTarget?.nome}</strong> está associado a{" "}
                        <strong>{assocCount} função(ões)/departamento(s)</strong>.
                        <br />
                        Desassocie todas as funções e departamentos vinculados (editando o GHE) antes de excluir.
                        Como alternativa, você pode <strong>arquivar</strong> o GHE.
                      </>
                    ) : (
                      <>
                        Esta ação é irreversível. O grupo <strong>{deleteTarget?.codigo} — {deleteTarget?.nome}</strong> será removido permanentemente.
                      </>
                    )}
                  </DialogDescription>
                </DialogHeader>
                {!bloqueado && (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Para confirmar, digite <strong>EXCLUIR</strong> abaixo:
                    </Label>
                    <Input
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      placeholder="EXCLUIR"
                      autoFocus
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteText(""); }}>
                    {bloqueado ? "Entendi" : "Cancelar"}
                  </Button>
                  {bloqueado ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (deleteTarget) handleEditar(deleteTarget);
                        setDeleteTarget(null);
                      }}
                    >
                      Editar GHE
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      disabled={deleteText.trim() !== "EXCLUIR" || del.isPending}
                      onClick={() => deleteTarget && del.mutate(deleteTarget.id)}
                    >
                      {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Excluir definitivamente
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
