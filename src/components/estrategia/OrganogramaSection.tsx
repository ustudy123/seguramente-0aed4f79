import { useState, useMemo } from "react";
import { Plus, Users, User, Loader2, Info, Check, ChevronsUpDown, Sparkles, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEstrategia } from "@/hooks/useEstrategia";
import { useCargos } from "@/hooks/useCadastros";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";
import type { EstrategiaOrganograma } from "@/types/estrategia";
import type { EstrategiaEscopo } from "./EstrategiaEscopoSelector";
import { OrgCanvas } from "./organograma/OrgCanvas";
import { OrgTree } from "./organograma/OrgTree";



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

const INITIAL_FORM = { titulo: "", nome_ocupante: "", parent_id: "", cargo_id: "", selectedOcupantes: [] as string[] };

export function OrganogramaSection({ escopo }: { escopo: EstrategiaEscopo }) {
  const { organograma, loadingOrganograma, createOrgNode, deleteOrgNode } = useEstrategia(escopo);
  const { cargos, createCargo } = useCargos();
  const { colaboradores } = useColaboradores();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [cargoOpen, setCargoOpen] = useState(false);
  const [ocupanteSearch, setOcupanteSearch] = useState("");

  const tree = buildTree(organograma);
  const cargosAtivos = (cargos || []).filter((c: any) => c.ativo);

  const colaboradoresMap = useMemo(() => {
    const m = new Map<string, string[]>();
    (colaboradores || []).forEach((c) => {
      if (c.cargo) {
        const key = c.cargo.toLowerCase();
        const arr = m.get(key) || [];
        arr.push(c.nome_completo);
        m.set(key, arr);
      }
    });
    return m;
  }, [colaboradores]);

  const handleCargoSelect = (cargoId: string) => {
    const cargo = cargosAtivos.find((c: any) => c.id === cargoId);
    setForm({ ...INITIAL_FORM, cargo_id: cargoId, titulo: cargo?.nome || "", parent_id: form.parent_id });
    setOcupanteSearch("");
  };

  const ocupantesDisponiveis = useMemo(() => {
    const key = form.titulo.trim().toLowerCase();
    if (!key) return [];
    return colaboradoresMap.get(key) || [];
  }, [form.titulo, colaboradoresMap]);

  const toggleOcupante = (nome: string) => {
    setForm((prev) => {
      const selected = prev.selectedOcupantes.includes(nome)
        ? prev.selectedOcupantes.filter((n) => n !== nome)
        : [...prev.selectedOcupantes, nome];
      return { ...prev, selectedOcupantes: selected };
    });
  };

  const openDialogForParent = (parentId: string) => {
    setForm({ ...INITIAL_FORM, parent_id: parentId });
    setOcupanteSearch("");
    setShowNew(true);
  };

  const handleCreate = async () => {
    if (!form.titulo.trim()) {
      toast.error("Preencha o nome da função");
      return;
    }
    const titulo = form.titulo.trim();

    if (!form.cargo_id) {
      const exists = cargosAtivos.some((c: any) => c.nome.toLowerCase() === titulo.toLowerCase());
      if (!exists) {
        try {
          await createCargo.mutateAsync({
            nome: titulo, ativo: true, descricao: null, departamento_id: null,
            nivel: null, faixa_salarial_min: null, faixa_salarial_max: null,
            periodicidade_exame_meses: null, exames_obrigatorios: null,
            insalubridade: false, insalubridade_grau: null, insalubridade_agente_nocivo: null,
            periculosidade: false, periculosidade_tipo: null,
            aposentadoria_especial: false, aposentadoria_especial_anos: null,
          });
          toast.info(`Função "${titulo}" cadastrada automaticamente no módulo de Cadastros`);
        } catch { /* handled */ }
      }
    }

    const ocupantes = form.selectedOcupantes.length > 0
      ? form.selectedOcupantes
      : [form.nome_ocupante || ""];

    const parentId = form.parent_id || undefined;
    const resetForm = () => {
      setShowNew(false);
      setForm(INITIAL_FORM);
      setOcupanteSearch("");
    };

    let remaining = ocupantes.length;
    ocupantes.forEach((nome) => {
      createOrgNode.mutate(
        { titulo, nome_ocupante: nome || undefined, parent_id: parentId, tipo: "funcao" },
        { onSuccess: () => { remaining--; if (remaining === 0) resetForm(); } },
      );
    });
  };

  const isCreating = createOrgNode.isPending || createCargo.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Organograma
          </h3>
          <p className="text-sm text-muted-foreground">
            Arraste para mover · Scroll para zoom · Clique <Plus className="w-3 h-3 inline" /> nos cards para adicionar
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setForm(INITIAL_FORM)}>
              <Plus className="w-4 h-4 mr-1" /> Nova Posição
            </Button>
          </DialogTrigger>
          <DialogContent data-organograma-dialog-content="true">
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
                    <PopoverContent
                      container={typeof document !== "undefined" ? (document.querySelector("[data-organograma-dialog-content='true']") as HTMLElement | null) : null}
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
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
                        .filter((nome) => nome.toLowerCase().includes(ocupanteSearch.toLowerCase()))
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
                      {ocupantesDisponiveis.filter((n) => n.toLowerCase().includes(ocupanteSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">Nenhum ocupante encontrado</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Input
                    value={form.nome_ocupante}
                    onChange={(e) => setForm({ ...form, nome_ocupante: e.target.value })}
                    placeholder="Nome da pessoa (opcional)"
                  />
                )}
              </div>

              {organograma.length > 0 && (
                <div className="space-y-1">
                  <Label>Superior {form.parent_id ? "" : "(opcional)"}</Label>
                  <Select value={form.parent_id || "_none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Raiz (sem superior)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Raiz (sem superior)</SelectItem>
                      {organograma.map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.titulo}{n.nome_ocupante ? ` (${n.nome_ocupante})` : ""}</SelectItem>
                      ))}
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
        <OrgCanvas>
          <OrgTree
            roots={tree}
            onDelete={(id) => deleteOrgNode.mutate(id)}
            onAddChild={openDialogForParent}
            onAddSibling={(parentId) => openDialogForParent(parentId || "")}
          />
        </OrgCanvas>
      )}
    </div>
  );
}
