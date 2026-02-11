import { useState, useMemo } from "react";
import { Plus, Trash2, Users, User, Loader2, Info, Check, ChevronsUpDown, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useEstrategia } from "@/hooks/useEstrategia";
import { useCargos } from "@/hooks/useCadastros";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";
import type { EstrategiaOrganograma } from "@/types/estrategia";

function buildTree(nodes: EstrategiaOrganograma[]): EstrategiaOrganograma[] {
  const map = new Map<string, EstrategiaOrganograma>();
  const roots: EstrategiaOrganograma[] = [];
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  nodes.forEach((n) => {
    const node = map.get(n.id)!;
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

const TIPO_CONFIG = {
  funcao: {
    icon: Briefcase,
    gradient: "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/30 shadow-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20",
    badgeText: "Função",
  },
};

function OrgCard({ node, onDelete, ocupantes }: { node: EstrategiaOrganograma; onDelete: (id: string) => void; ocupantes?: string[] }) {
  const config = TIPO_CONFIG.funcao;
  const Icon = config.icon;
  const displayOcupantes = ocupantes && ocupantes.length > 0 ? ocupantes : node.nome_ocupante ? [node.nome_ocupante] : [];

  return (
    <div className={cn(
      "relative group rounded-xl border-2 shadow-md px-5 py-4 min-w-[180px] max-w-[240px] text-center transition-all hover:shadow-lg",
      config.gradient, config.border
    )}>
      <div className="flex justify-center mb-2">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", config.badge)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight">{node.titulo}</p>
      {displayOcupantes.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {displayOcupantes.map((nome, i) => (
            <p key={i} className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <User className="w-3 h-3" />
              {nome}
            </p>
          ))}
        </div>
      )}
      <Badge variant="outline" className={cn("mt-2 text-[10px] border", config.badge)}>
        {config.badgeText}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

function OrgBranch({ node, onDelete, isRoot, colaboradoresMap }: { node: EstrategiaOrganograma; onDelete: (id: string) => void; isRoot?: boolean; colaboradoresMap: Map<string, string[]> }) {
  const hasChildren = node.children && node.children.length > 0;
  const ocupantes = colaboradoresMap.get(node.titulo.toLowerCase());

  return (
    <div className="flex flex-col items-center">
      {/* Connector line from parent */}
      {!isRoot && (
        <div className="w-0.5 h-6 bg-border" />
      )}

      {/* The card */}
      <OrgCard node={node} onDelete={onDelete} ocupantes={ocupantes} />

      {/* Children */}
      {hasChildren && (
        <>
          {/* Vertical line down from card */}
          <div className="w-0.5 h-6 bg-border" />

          {/* Horizontal connector bar + children */}
          <div className="relative flex items-start">
            {/* Horizontal line spanning children */}
            {node.children!.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-border"
                style={{
                  left: `calc(50% / ${node.children!.length})`,
                  right: `calc(50% / ${node.children!.length})`,
                }}
              />
            )}
            <div className="flex gap-4">
              {node.children!.map((child) => (
                <OrgBranch key={child.id} node={child} onDelete={onDelete} colaboradoresMap={colaboradoresMap} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OrgTreeVisual({ roots, onDelete, colaboradoresMap }: { roots: EstrategiaOrganograma[]; onDelete: (id: string) => void; colaboradoresMap: Map<string, string[]> }) {
  return (
    <div className="flex gap-8 justify-center flex-wrap overflow-x-auto py-6 px-4">
      {roots.map((root) => (
        <OrgBranch key={root.id} node={root} onDelete={onDelete} isRoot colaboradoresMap={colaboradoresMap} />
      ))}
    </div>
  );
}

export function OrganogramaSection() {
  const { organograma, loadingOrganograma, createOrgNode, deleteOrgNode } = useEstrategia();
  const { cargos, createCargo } = useCargos();
  const { colaboradores } = useColaboradores();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titulo: "", nome_ocupante: "", parent_id: "", cargo_id: "", selectedOcupantes: [] as string[] });
  const [cargoOpen, setCargoOpen] = useState(false);
  const [ocupanteSearch, setOcupanteSearch] = useState("");

  const tree = buildTree(organograma);

  const cargosAtivos = (cargos || []).filter((c: any) => c.ativo);

  // Map cargo name (lowercase) -> colaborador name for auto-identification
  const colaboradoresMap = new Map<string, string[]>();
  (colaboradores || []).forEach((c) => {
    if (c.cargo) {
      const key = c.cargo.toLowerCase();
      const arr = colaboradoresMap.get(key) || [];
      arr.push(c.nome_completo);
      colaboradoresMap.set(key, arr);
    }
  });

  const handleCargoSelect = (cargoId: string) => {
    const cargo = cargosAtivos.find((c: any) => c.id === cargoId);
    setForm({ ...form, cargo_id: cargoId, titulo: cargo?.nome || "", selectedOcupantes: [], nome_ocupante: "" });
    setOcupanteSearch("");
  };

  // Colaboradores matching the current titulo
  const ocupantesDisponiveis = useMemo(() => {
    const key = form.titulo.trim().toLowerCase();
    if (!key) return [];
    return colaboradoresMap.get(key) || [];
  }, [form.titulo, colaboradoresMap]);

  const toggleOcupante = (nome: string) => {
    setForm(prev => {
      const selected = prev.selectedOcupantes.includes(nome)
        ? prev.selectedOcupantes.filter(n => n !== nome)
        : [...prev.selectedOcupantes, nome];
      return { ...prev, selectedOcupantes: selected };
    });
  };

  const handleCreate = async () => {
    if (!form.titulo.trim()) return;
    const titulo = form.titulo.trim();

    if (!form.cargo_id) {
      const exists = cargosAtivos.some((c: any) => c.nome.toLowerCase() === titulo.toLowerCase());
      if (!exists) {
        try {
          await createCargo.mutateAsync({ nome: titulo, ativo: true, descricao: null, departamento_id: null, nivel: null, faixa_salarial_min: null, faixa_salarial_max: null, periodicidade_exame_meses: null, exames_obrigatorios: null });
          toast.info(`Função "${titulo}" cadastrada automaticamente no módulo de Cadastros`);
        } catch { /* handled */ }
      }
    }

    // Build ocupante string from selection or manual input
    const ocupante = form.selectedOcupantes.length > 0
      ? form.selectedOcupantes.join(", ")
      : form.nome_ocupante || undefined;

    createOrgNode.mutate(
      { titulo, nome_ocupante: ocupante, parent_id: form.parent_id || undefined, tipo: "funcao" },
      { onSuccess: () => { setShowNew(false); setForm({ titulo: "", nome_ocupante: "", parent_id: "", cargo_id: "", selectedOcupantes: [] }); } },
    );
  };

  const isCreating = createOrgNode.isPending || createCargo.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Organograma
          </h3>
          <p className="text-sm text-muted-foreground">Estrutura hierárquica visual da empresa</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Posição</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Posição no Organograma</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {cargosAtivos.length > 0 && (
                <div className="space-y-1">
                  <Label>Função cadastrada</Label>
                  <Popover open={cargoOpen} onOpenChange={setCargoOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={cargoOpen} className="w-full justify-between font-normal">
                        {form.cargo_id ? cargosAtivos.find((c: any) => c.id === form.cargo_id)?.nome : "Pesquisar ou selecionar função..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar função..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma função encontrada</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="_none" onSelect={() => { setForm({ ...form, cargo_id: "", titulo: "" }); setCargoOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", !form.cargo_id ? "opacity-100" : "opacity-0")} />
                              — Nenhuma (digitar nova) —
                            </CommandItem>
                            {cargosAtivos.map((c: any) => (
                              <CommandItem key={c.id} value={c.nome} onSelect={() => { handleCargoSelect(c.id); setCargoOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", form.cargo_id === c.id ? "opacity-100" : "opacity-0")} />
                                {c.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="space-y-1">
                <Label>Nome da função</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value, cargo_id: "", selectedOcupantes: [] })}
                  placeholder="Ex: Analista de RH"
                />
                {!form.cargo_id && form.titulo.trim() && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" />
                    Será cadastrado automaticamente no módulo de Cadastros
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Ocupante</Label>
                {ocupantesDisponiveis.length > 0 ? (
                  <div className="border rounded-md p-2 space-y-1">
                    <Input
                      value={ocupanteSearch}
                      onChange={(e) => setOcupanteSearch(e.target.value)}
                      placeholder="Pesquisar ocupante..."
                      className="h-8 text-sm mb-1"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {ocupantesDisponiveis
                        .filter(nome => nome.toLowerCase().includes(ocupanteSearch.toLowerCase()))
                        .map((nome) => (
                          <label key={nome} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={form.selectedOcupantes.includes(nome)}
                              onChange={() => toggleOcupante(nome)}
                              className="rounded border-input"
                            />
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {nome}
                          </label>
                        ))}
                      {ocupantesDisponiveis.filter(nome => nome.toLowerCase().includes(ocupanteSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">Nenhum ocupante encontrado</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Input value={form.nome_ocupante} onChange={(e) => setForm({ ...form, nome_ocupante: e.target.value })} placeholder="Nome da pessoa (opcional)" />
                )}
              </div>

              {organograma.length > 0 && (
                <div className="space-y-1">
                  <Label>Superior (opcional)</Label>
                  <Select value={form.parent_id || "_none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Raiz (sem superior)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Raiz (sem superior)</SelectItem>
                      {organograma.map((n) => <SelectItem key={n.id} value={n.id}>{n.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleCreate} disabled={!form.titulo.trim() || isCreating} className="w-full">
                {isCreating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loadingOrganograma ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : tree.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Organograma vazio</p>
            <p className="text-xs text-muted-foreground mt-1">Adicione posições para construir a hierarquia</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-2 overflow-x-auto">
            <OrgTreeVisual roots={tree} onDelete={(id) => deleteOrgNode.mutate(id)} colaboradoresMap={colaboradoresMap} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
