import { useState } from "react";
import { Plus, Trash2, Users, User, Building2, ChevronRight, ChevronDown, Loader2, Info, Search, Check, ChevronsUpDown } from "lucide-react";
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
import { useCargos, useDepartamentos } from "@/hooks/useCadastros";
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

function OrgNode({ node, level, onDelete }: { node: EstrategiaOrganograma; level: number; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={level > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}>
      <div className="flex items-center gap-2 py-2 group">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <div className="flex items-center gap-2 flex-1 bg-card border rounded-lg px-3 py-2 shadow-sm">
          {node.tipo === "departamento" ? (
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{node.titulo}</p>
            {node.nome_ocupante && <p className="text-xs text-muted-foreground">{node.nome_ocupante}</p>}
          </div>
          <Badge variant="outline" className="text-[10px]">{node.tipo}</Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => onDelete(node.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <OrgNode key={child.id} node={child} level={level + 1} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrganogramaSection() {
  const { organograma, loadingOrganograma, createOrgNode, deleteOrgNode } = useEstrategia();
  const { cargos, createCargo } = useCargos();
  const { departamentos, createDepartamento } = useDepartamentos();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titulo: "", nome_ocupante: "", parent_id: "", tipo: "funcao", cargo_id: "", departamento_id: "" });
  const [cargoOpen, setCargoOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  const tree = buildTree(organograma);

  const cargosAtivos = (cargos || []).filter((c: any) => c.ativo);
  const deptAtivos = (departamentos || []).filter((d: any) => d.ativo);

  const handleTipoChange = (tipo: string) => {
    setForm({ ...form, tipo, titulo: "", cargo_id: "", departamento_id: "" });
  };

  const handleCargoSelect = (cargoId: string) => {
    const cargo = cargosAtivos.find((c: any) => c.id === cargoId);
    setForm({ ...form, cargo_id: cargoId, titulo: cargo?.nome || "" });
  };

  const handleDeptSelect = (deptId: string) => {
    const dept = deptAtivos.find((d: any) => d.id === deptId);
    setForm({ ...form, departamento_id: deptId, titulo: dept?.nome || "" });
  };

  const handleCreate = async () => {
    if (!form.titulo.trim()) return;
    const titulo = form.titulo.trim();

    // If typing a new function name not from the dropdown, auto-create in cadastros
    if (form.tipo === "funcao" && !form.cargo_id) {
      const exists = cargosAtivos.some((c: any) => c.nome.toLowerCase() === titulo.toLowerCase());
      if (!exists) {
        try {
          await createCargo.mutateAsync({ nome: titulo, ativo: true, descricao: null, departamento_id: null, nivel: null, faixa_salarial_min: null, faixa_salarial_max: null, periodicidade_exame_meses: null, exames_obrigatorios: null });
          toast.info(`Função "${titulo}" cadastrada automaticamente no módulo de Cadastros`);
        } catch {
          // toast already handled by hook
        }
      }
    }

    // If typing a new department name not from the dropdown, auto-create in cadastros
    if (form.tipo === "departamento" && !form.departamento_id) {
      const exists = deptAtivos.some((d: any) => d.nome.toLowerCase() === titulo.toLowerCase());
      if (!exists) {
        try {
          await createDepartamento.mutateAsync({ nome: titulo, ativo: true, descricao: null, responsavel_id: null });
          toast.info(`Departamento "${titulo}" cadastrado automaticamente no módulo de Cadastros`);
        } catch {
          // toast already handled by hook
        }
      }
    }

    createOrgNode.mutate(
      { titulo, nome_ocupante: form.nome_ocupante || undefined, parent_id: form.parent_id || undefined, tipo: form.tipo },
      { onSuccess: () => { setShowNew(false); setForm({ titulo: "", nome_ocupante: "", parent_id: "", tipo: "funcao", cargo_id: "", departamento_id: "" }); } },
    );
  };

  const isCreating = createOrgNode.isPending || createCargo.isPending || createDepartamento.isPending;

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
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={handleTipoChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcao">Função</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="diretoria">Diretoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Combobox pesquisável de cadastros existentes */}
              {form.tipo === "funcao" && cargosAtivos.length > 0 && (
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

              {form.tipo === "departamento" && deptAtivos.length > 0 && (
                <div className="space-y-1">
                  <Label>Departamento cadastrado</Label>
                  <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={deptOpen} className="w-full justify-between font-normal">
                        {form.departamento_id ? deptAtivos.find((d: any) => d.id === form.departamento_id)?.nome : "Pesquisar ou selecionar departamento..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar departamento..." />
                        <CommandList>
                          <CommandEmpty>Nenhum departamento encontrado</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="_none" onSelect={() => { setForm({ ...form, departamento_id: "", titulo: "" }); setDeptOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", !form.departamento_id ? "opacity-100" : "opacity-0")} />
                              — Nenhum (digitar novo) —
                            </CommandItem>
                            {deptAtivos.map((d: any) => (
                              <CommandItem key={d.id} value={d.nome} onSelect={() => { handleDeptSelect(d.id); setDeptOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", form.departamento_id === d.id ? "opacity-100" : "opacity-0")} />
                                {d.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Campo de texto — sempre visível */}
              <div className="space-y-1">
                <Label>{form.tipo === "departamento" ? "Nome do departamento" : form.tipo === "diretoria" ? "Nome da diretoria" : "Nome da função"}</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value, cargo_id: "", departamento_id: "" })}
                  placeholder={form.tipo === "departamento" ? "Ex: Recursos Humanos" : form.tipo === "diretoria" ? "Ex: Diretoria Financeira" : "Ex: Analista de RH"}
                />
                {form.tipo !== "diretoria" && !form.cargo_id && !form.departamento_id && form.titulo.trim() && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" />
                    Será cadastrado automaticamente no módulo de Cadastros
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Ocupante (opcional)</Label>
                <Input value={form.nome_ocupante} onChange={(e) => setForm({ ...form, nome_ocupante: e.target.value })} placeholder="Nome da pessoa" />
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
          <CardContent className="p-4">
            {tree.map((node) => (
              <OrgNode key={node.id} node={node} level={0} onDelete={(id) => deleteOrgNode.mutate(id)} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
