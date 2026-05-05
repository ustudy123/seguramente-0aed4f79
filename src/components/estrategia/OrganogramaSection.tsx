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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useEstrategia } from "@/hooks/useEstrategia";
import { useCargos } from "@/hooks/useCadastros";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useStorageImageUrl } from "@/hooks/useStorageImageUrl";
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

const INITIAL_FORM = { titulo: "", nome_ocupante: "", parent_id: "", cargo_id: "", colaborador_id: "", selectedOcupantes: [] as { id: string; nome: string }[] };

// Build a hierarchical suggestion from collaborator gestor_imediato relationships
function buildOrgSuggestion(colaboradores: any[]) {
  // Map each person to their manager
  const nodes: { id: string; nome: string; cargo: string; gestor: string | null }[] = [];
  const seen = new Set<string>();

  colaboradores.forEach((c) => {
    if (!seen.has(c.nome_completo)) {
      seen.add(c.nome_completo);
      nodes.push({ id: c.id, nome: c.nome_completo, cargo: c.cargo || c.nome_completo, gestor: c.gestor_imediato || null });
    }
  });

  // Find root nodes (gestores that don't appear as subordinates, or have no manager)
  const allNomes = new Set(nodes.map(n => n.nome));
  const allGestores = new Set(nodes.map(n => n.gestor).filter(Boolean) as string[]);

  // Include gestores that aren't in the main list
  allGestores.forEach((g) => {
    if (!allNomes.has(g)) {
      nodes.push({ id: "", nome: g, cargo: g, gestor: null });
      allNomes.add(g);
    }
  });

  return nodes;
}

export function OrganogramaSection({ escopo }: { escopo: EstrategiaEscopo }) {
  const { organograma, loadingOrganograma, createOrgNode, deleteOrgNode, updateOrgNode } = useEstrategia(escopo);
  const { cargos, createCargo } = useCargos();
  const { colaboradores } = useColaboradores();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [cargoOpen, setCargoOpen] = useState(false);
  const [ocupanteSearch, setOcupanteSearch] = useState("");
  const [showSugestao, setShowSugestao] = useState(false);
  const [isSugerindo, setIsSugerindo] = useState(false);

  const tree = buildTree(organograma);
  const cargosAtivos = (cargos || []).filter((c: any) => c.ativo);

  const colaboradoresMap = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; foto_url?: string }[]>();
    (colaboradores || []).forEach((c) => {
      if (c.cargo) {
        const key = c.cargo.toLowerCase();
        const arr = m.get(key) || [];
        arr.push({ id: c.id, nome: c.nome_completo, foto_url: c.foto_url });
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

  const toggleOcupante = (colab: { id: string; nome: string }) => {
    setForm((prev) => {
      const isSelected = prev.selectedOcupantes.some(o => o.id === colab.id);
      const selected = isSelected
        ? prev.selectedOcupantes.filter((o) => o.id !== colab.id)
        : [...prev.selectedOcupantes, colab];
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
      : [{ id: form.colaborador_id, nome: form.nome_ocupante }];

    const parentId = form.parent_id || undefined;
    const resetForm = () => {
      setShowNew(false);
      setForm(INITIAL_FORM);
      setOcupanteSearch("");
    };

    let remaining = ocupantes.length;
    ocupantes.forEach((colab) => {
      createOrgNode.mutate(
        { titulo, nome_ocupante: colab.nome || undefined, colaborador_id: colab.id || undefined, parent_id: parentId, tipo: "funcao" },
        { onSuccess: () => { remaining--; if (remaining === 0) resetForm(); } },
      );
    });
  };

  const isCreating = createOrgNode.isPending || createCargo.isPending;

  // Suggestion logic: build org from gestor_imediato relationships
  const sugestaoNodes = useMemo(() => {
    const colsWithGestor = colaboradores.filter(c => c.gestor_imediato);
    if (colsWithGestor.length === 0) return [];
    return buildOrgSuggestion(colaboradores);
  }, [colaboradores]);

  const colsComGestor = colaboradores.filter(c => c.gestor_imediato);

  const handleGerarOrganograma = async (limparAntes = false) => {
    if (sugestaoNodes.length === 0) return;
    setIsSugerindo(true);
    try {
      // If requested, delete all existing nodes first
      if (limparAntes) {
        for (const node of organograma) {
          await new Promise<void>((resolve) => {
            deleteOrgNode.mutate(node.id, { onSuccess: () => resolve(), onError: () => resolve() });
          });
        }
      }

      // Map: nome → db id, built sequentially so parents exist before children
      const nomeToId = new Map<string, string>();

      // Helper: insert one node and await its returned id
      const insertNode = (titulo: string, nome: string, parentId?: string): Promise<string | undefined> =>
        new Promise((resolve, reject) => {
          createOrgNode.mutate(
            { titulo, nome_ocupante: nome, parent_id: parentId, tipo: "funcao" },
            {
              onSuccess: (created: any) => resolve(created?.id as string | undefined),
              onError: reject,
            }
          );
        });

      // First pass: root nodes (no gestor)
      for (const node of sugestaoNodes.filter(n => !n.gestor)) {
        const id = await insertNode(node.cargo, node.nome, undefined);
        if (id) nomeToId.set(node.nome, id);
      }

      // Multi-level: iterate until all non-root nodes are inserted or we detect no progress
      let remaining = sugestaoNodes.filter(n => n.gestor);
      let iterations = 0;
      while (remaining.length > 0 && iterations < 20) {
        iterations++;
        const nextRound: typeof remaining = [];
        for (const node of remaining) {
          const parentId = node.gestor ? nomeToId.get(node.gestor) : undefined;
          if (node.gestor && !parentId) {
            nextRound.push(node);
            continue;
          }
          const id = await insertNode(node.cargo, node.nome, parentId);
          if (id) nomeToId.set(node.nome, id);
        }
        if (nextRound.length === remaining.length) break;
        remaining = nextRound;
      }

      toast.success(`Organograma gerado com ${sugestaoNodes.length} posições!`);
      setShowSugestao(false);
    } catch {
      toast.error("Erro ao gerar organograma. Tente novamente.");
    } finally {
      setIsSugerindo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Organograma
          </h3>
          <p className="text-sm text-muted-foreground">
            Arraste para mover · Scroll para zoom · Clique <Plus className="w-3 h-3 inline" /> nos cards para adicionar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sugerir Organograma button */}
          {colsComGestor.length > 0 && (
            <Dialog open={showSugestao} onOpenChange={setShowSugestao}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
                  <Sparkles className="w-4 h-4 mr-1" /> Sugerir Organograma
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-4">{colsComGestor.length}</Badge>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Sugestão de Organograma
                  </DialogTitle>
                  <DialogDescription>
                    Baseado no campo "Gestor Imediato" dos {colsComGestor.length} colaboradores cadastrados, o sistema identificou a seguinte hierarquia:
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-80 overflow-y-auto space-y-2 py-2">
                  {sugestaoNodes.map((node, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/20">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{node.nome}</p>
                        <p className="text-xs text-muted-foreground">{node.cargo}</p>
                        {node.gestor && (
                          <p className="text-xs text-primary/70 mt-0.5">↳ Reporta a: {node.gestor}</p>
                        )}
                        {!node.gestor && (
                          <Badge variant="outline" className="text-[10px] mt-0.5 h-4 px-1.5 border-primary/30 text-primary">Raiz</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {organograma.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-xs">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
                    <div className="text-destructive/90">
                      <p className="font-medium">Organograma já possui {organograma.length} posição(ões).</p>
                      <p className="mt-0.5">Recomendamos <strong>Limpar e Gerar</strong> para recriar com a hierarquia correta, ou <strong>Gerar</strong> para apenas adicionar.</p>
                    </div>
                  </div>
                )}
                <DialogFooter className="gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => setShowSugestao(false)}>Cancelar</Button>
                  {organograma.length > 0 && (
                    <Button variant="destructive" onClick={() => handleGerarOrganograma(true)} disabled={isSugerindo}>
                      {isSugerindo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
                      Limpar e Gerar
                    </Button>
                  )}
                  <Button onClick={() => handleGerarOrganograma(false)} disabled={isSugerindo}>
                    {isSugerindo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    Gerar Organograma
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
                              <CommandItem key={c.id} value={`${c.nome} ${c.departamento?.nome || ''}`} onSelect={() => { handleCargoSelect(c.id); setCargoOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", form.cargo_id === c.id ? "opacity-100" : "opacity-0")} />
                                <span>{c.nome}</span>
                                {c.departamento?.nome && <span className="ml-1.5 text-xs text-muted-foreground">({c.departamento.nome})</span>}
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
                        .filter((c) => c.nome.toLowerCase().includes(ocupanteSearch.toLowerCase()))
                        .map((c) => (
                          <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={form.selectedOcupantes.some(o => o.id === c.id)}
                              onChange={() => toggleOcupante(c)}
                              className="rounded border-input"
                            />
                            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                              {c.foto_url ? (
                                <img src={c.foto_url} alt={c.nome} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-primary" />
                              )}
                            </div>
                            <span className="truncate">{c.nome}</span>
                          </label>
                        ))}
                      {ocupantesDisponiveis.filter((c) => c.nome.toLowerCase().includes(ocupanteSearch.toLowerCase())).length === 0 && (
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
        </div>{/* end flex gap-2 */}
      </div>{/* end header */}

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
            onEdit={(id, updates) => {
              updateOrgNode.mutate({ id, ...updates }, {
                onSuccess: () => toast.success("Posição atualizada"),
                onError: () => toast.error("Erro ao atualizar posição"),
              });
            }}
            onMove={(draggedId, targetId, position) => {
              const isDescendant = (parentId: string, checkId: string): boolean => {
                const node = organograma.find(n => n.id === checkId);
                if (!node?.parent_id) return false;
                if (node.parent_id === parentId) return true;
                return isDescendant(parentId, node.parent_id);
              };
              if (isDescendant(draggedId, targetId)) {
                toast.error("Não é possível mover para um subordinado");
                return;
              }
              const targetNode = organograma.find(n => n.id === targetId);
              if (position === "child") {
                updateOrgNode.mutate({ id: draggedId, parent_id: targetId });
                toast.success("Posição movida como subordinado");
              } else {
                updateOrgNode.mutate({ id: draggedId, parent_id: targetNode?.parent_id || null });
                toast.success("Posição movida ao lado");
              }
            }}
          />
        </OrgCanvas>
      )}
    </div>
  );
}
