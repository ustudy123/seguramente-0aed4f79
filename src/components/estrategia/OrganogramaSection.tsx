import { useState, useMemo } from "react";
import { Plus, Users, User, Loader2, Info, Check, ChevronsUpDown, Sparkles, AlertTriangle, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useEstrategia } from "@/hooks/useEstrategia";
import { useCargos } from "@/hooks/useCadastros";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";
import { useStorageImageUrl } from "@/hooks/useStorageImageUrl";
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

const INITIAL_FORM = { 
  titulo: "", 
  nome_ocupante: "", 
  parent_id: "", 
  cargo_id: "", 
  colaborador_id: "", 
  selectedOcupantes: [] as { id: string; nome: string; foto_url?: string | null }[] 
};

function buildOrgSuggestion(colaboradores: any[]) {
  const nodes: { id: string; nome: string; cargo: string; gestor: string | null; foto_url?: string | null }[] = [];
  const seen = new Set<string>();

  colaboradores.forEach((c) => {
    if (!seen.has(c.nome_completo)) {
      seen.add(c.nome_completo);
      nodes.push({ 
        id: c.id, 
        nome: c.nome_completo, 
        cargo: c.cargo || c.nome_completo, 
        gestor: c.gestor_imediato || null,
        foto_url: c.foto_url
      });
    }
  });

  const allNomes = new Set(nodes.map(n => n.nome));
  const allGestores = new Set(nodes.map(n => n.gestor).filter(Boolean) as string[]);

  allGestores.forEach((g) => {
    if (!allNomes.has(g)) {
      nodes.push({ id: "", nome: g, cargo: g, gestor: null });
      allNomes.add(g);
    }
  });

  return nodes;
}

function OcupanteItem({ colab, isSelected, onToggle }: {
  colab: { id: string; nome: string; foto_url?: string | null };
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="rounded border-input"
      />
      <Avatar className="w-6 h-6">
        <AvatarImage src={colab.foto_url || undefined} />
        <AvatarFallback><User className="w-3 h-3" /></AvatarFallback>
      </Avatar>
      <span className="truncate">{colab.nome}</span>
    </label>
  );
}

function AvatarNode({ fotoUrl, size = "default" }: { fotoUrl?: string | null; size?: "small" | "default" }) {
  const resolved = useStorageImageUrl(fotoUrl);
  return (
    <Avatar className={cn(size === "small" ? "w-6 h-6" : "w-7 h-7")}>
      <AvatarImage src={resolved || undefined} />
      <AvatarFallback><User className={size === "small" ? "w-3 h-3" : "w-3.5 h-3.5"} /></AvatarFallback>
    </Avatar>
  );
}

export function OrganogramaSection({ escopo }: { escopo: EstrategiaEscopo }) {
  const { organograma, loadingOrganograma, createOrgNode, deleteOrgNode, updateOrgNode } = useEstrategia(escopo);
  const { cargos, createCargo } = useCargos();
  const { colaboradores } = useColaboradores();
  const [showNew, setShowNew] = useState(false);
  const [editingNode, setEditingNode] = useState<EstrategiaOrganograma | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [cargoOpen, setCargoOpen] = useState(false);
  const [ocupanteSearch, setOcupanteSearch] = useState("");
  const [showSugestao, setShowSugestao] = useState(false);
  const [isSugerindo, setIsSugerindo] = useState(false);
  const [insertingBetweenId, setInsertingBetweenId] = useState<string | null>(null);
  const [showCargoConfirm, setShowCargoConfirm] = useState(false);

  const tree = buildTree(organograma);
  const cargosAtivos = (cargos || []).filter((c: any) => c.ativo);

  const handleCargoSelect = (cargoId: string) => {
    const cargo = cargosAtivos.find((c: any) => c.id === cargoId);
    setForm({ ...INITIAL_FORM, cargo_id: cargoId, titulo: cargo?.nome || "", parent_id: form.parent_id });
    setOcupanteSearch("");
  };

  const toggleOcupante = (colab: { id: string; nome: string; foto_url?: string | null }) => {
    setForm((prev) => {
      const isSelected = prev.selectedOcupantes.some(o => o.id === colab.id);
      const selected = isSelected
        ? prev.selectedOcupantes.filter((o) => o.id !== colab.id)
        : [...prev.selectedOcupantes, colab];
      return { ...prev, selectedOcupantes: selected };
    });
  };

  const openDialogForParent = (parentId: string) => {
    setEditingNode(null);
    setForm({ ...INITIAL_FORM, parent_id: parentId });
    setOcupanteSearch("");
    setShowNew(true);
  };

  const openDialogForEdit = (node: EstrategiaOrganograma) => {
    setEditingNode(node);
    setForm({
      titulo: node.titulo,
      nome_ocupante: node.nome_ocupante || "",
      parent_id: node.parent_id || "",
      cargo_id: node.cargo_id || "",
      colaborador_id: node.colaborador_id || "",
      selectedOcupantes: node.colaborador_id ? [{ id: node.colaborador_id, nome: node.nome_ocupante || "" }] : []
    });
    setOcupanteSearch("");
    setShowNew(true);
  };

  const openDialogForInsertion = (childId: string) => {
    const childNode = organograma.find(n => n.id === childId);
    setEditingNode(null);
    setInsertingBetweenId(childId);
    // When inserting between, the new node's parent becomes the child's current parent
    setForm({ ...INITIAL_FORM, parent_id: childNode?.parent_id || "" });
    setShowNew(true);
  };

  const openDialogForRootInsertion = () => {
    // To insert a new root above all existing roots, we need a special mode.
    // However, the current logic for "insertingBetweenId" already works if parent_id is empty.
    // The problem is that when inserting a new root, it should become the parent of ALL current roots.
    // But since the UI usually triggers this from one specific card, we'll start with that.
    // If the user wants a new global root, they should use "Nova Posição" and then manually move others under it,
    // OR we can make "insertingBetween" on a root node behave as "new root parent".
    setEditingNode(null);
    setInsertingBetweenId("all_roots");
    setForm({ ...INITIAL_FORM, parent_id: "" });
    setShowNew(true);
  };

  const executeFinalCreation = async (createInSystem: boolean) => {
    const titulo = form.titulo.trim();

    if (createInSystem && !form.cargo_id) {
      try {
        await createCargo.mutateAsync({
          nome: titulo, ativo: true, descricao: null, departamento_id: null,
          nivel: null, faixa_salarial_min: null, faixa_salarial_max: null,
          periodicidade_exame_meses: null, exames_obrigatorios: null,
          insalubridade: false, insalubridade_grau: null, insalubridade_agente_nocivo: null,
          periculosidade: false, periculosidade_tipo: null,
          aposentadoria_especial: false, aposentadoria_especial_anos: null,
        });
        toast.success(`Função "${titulo}" cadastrada no sistema`);
      } catch (error) {
        console.error("Erro ao criar cargo:", error);
      }
    }

    if (editingNode) {
      updateOrgNode.mutate({
        id: editingNode.id,
        titulo,
        nome_ocupante: form.nome_ocupante || undefined,
        colaborador_id: form.colaborador_id || undefined,
        parent_id: form.parent_id || undefined,
        cargo_id: form.cargo_id || undefined,
      }, {
        onSuccess: () => {
          toast.success("Posição atualizada");
          setShowNew(false);
          setEditingNode(null);
          setForm(INITIAL_FORM);
          setOcupanteSearch("");
        },
        onError: () => toast.error("Erro ao atualizar posição")
      });
      return;
    }

    const ocupantes = form.selectedOcupantes.length > 0
      ? form.selectedOcupantes
      : [{ id: form.colaborador_id, nome: form.nome_ocupante }];

    // If we're choosing "Raiz" in the select but also want to insert above, we should respect the insert logic
    const parentId = (insertingBetweenId && insertingBetweenId !== "all_roots")
      ? (organograma.find(n => n.id === insertingBetweenId)?.parent_id || undefined)
      : (form.parent_id || undefined);

    const resetForm = () => {
      setShowNew(false);
      setForm(INITIAL_FORM);
      setOcupanteSearch("");
      setInsertingBetweenId(null);
    };

    let remaining = ocupantes.length;
    ocupantes.forEach((colab) => {
      createOrgNode.mutate(
        { 
          titulo, 
          nome_ocupante: colab.nome || undefined, 
          colaborador_id: colab.id || undefined, 
          parent_id: parentId, 
          tipo: "funcao" 
        },
        { 
          onSuccess: (createdNode: any) => { 
            if (insertingBetweenId && createdNode?.id) {
              if (insertingBetweenId === "all_roots") {
                // Special case: new root above all existing roots
                const currentRoots = organograma.filter(n => !n.parent_id);
                currentRoots.forEach(root => {
                  updateOrgNode.mutate({ id: root.id, parent_id: createdNode.id });
                });
                toast.info("Nova posição definida como raiz principal");
              } else {
                // Update the existing node to point to the newly created parent
                updateOrgNode.mutate({ id: insertingBetweenId, parent_id: createdNode.id });
                toast.info("Posição inserida na hierarquia");
              }
              setInsertingBetweenId(null);
            }
            remaining--; 
            if (remaining === 0) resetForm(); 
          } 
        },
      );
    });
  };

  const handleCreateOrUpdate = async () => {
    if (!form.titulo.trim()) {
      toast.error("Preencha o nome da função");
      return;
    }

    const titulo = form.titulo.trim();
    const cargoExists = cargosAtivos.some((c: any) => c.nome.toLowerCase() === titulo.toLowerCase());

    if (!form.cargo_id && !cargoExists) {
      setShowCargoConfirm(true);
      return;
    }

    executeFinalCreation(false);
  };

  const isCreating = createOrgNode.isPending || createCargo.isPending;

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
      if (limparAntes) {
        for (const node of organograma) {
          await new Promise<void>((resolve) => {
            deleteOrgNode.mutate(node.id, { onSuccess: () => resolve(), onError: () => resolve() });
          });
        }
      }

      const nomeToId = new Map<string, string>();

      const insertNode = (titulo: string, nome: string, colabId?: string, parentId?: string): Promise<string | undefined> =>
        new Promise((resolve, reject) => {
          createOrgNode.mutate(
            { 
              titulo, 
              nome_ocupante: nome, 
              colaborador_id: colabId || undefined, 
              parent_id: parentId, 
              tipo: "funcao" 
            },
            {
              onSuccess: (created: any) => resolve(created?.id as string | undefined),
              onError: reject,
            }
          );
        });

      for (const node of sugestaoNodes.filter(n => !n.gestor)) {
        const dbId = await insertNode(node.cargo, node.nome, node.id, undefined);
        if (dbId) nomeToId.set(node.nome, dbId);
      }

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
          const dbId = await insertNode(node.cargo, node.nome, node.id, parentId);
          if (dbId) nomeToId.set(node.nome, dbId);
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
          <p className="text-sm text-muted-foreground">
            Arraste para mover · Scroll para zoom · Clique <Plus className="w-3 h-3 inline" /> nos cards para adicionar
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                    <div className="w-7 h-7 mt-0.5">
                        <AvatarNode fotoUrl={node.foto_url} />
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
              <Button size="sm" onClick={() => { setEditingNode(null); setForm(INITIAL_FORM); setInsertingBetweenId(null); }}>
                <Plus className="w-4 h-4 mr-1" /> Nova Posição
              </Button>
            </DialogTrigger>
            <DialogContent data-organograma-dialog-content="true">
              <DialogHeader><DialogTitle>{editingNode ? "Editar Posição" : "Nova Posição no Organograma"}</DialogTitle></DialogHeader>
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
                      <HelpCircle className="w-3 h-3" />
                      O sistema perguntará se deseja cadastrar esta função nos registros gerais.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Ocupante</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left overflow-hidden">
                        <div className="truncate flex-1">
                          {editingNode ? (
                            form.nome_ocupante || "Selecione o colaborador..."
                          ) : (
                            form.selectedOcupantes.length > 0 
                              ? `${form.selectedOcupantes.length} selecionado(s)` 
                              : form.nome_ocupante || "Selecione o(s) colaborador(es)..."
                          )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      container={typeof document !== "undefined" ? (document.querySelector("[data-organograma-dialog-content='true']") as HTMLElement | null) : null}
                      className="w-[--radix-popover-trigger-width] p-0" 
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar colaborador..." />
                        <CommandList>
                          <CommandEmpty>Nenhum colaborador encontrado</CommandEmpty>
                          <CommandGroup heading="Colaboradores da Empresa">
                            {colaboradores.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.nome_completo}
                                onSelect={() => {
                                  if (editingNode) {
                                    setForm({ ...form, colaborador_id: form.colaborador_id === c.id ? "" : c.id, nome_ocupante: c.nome_completo });
                                  } else {
                                    toggleOcupante({ id: c.id, nome: c.nome_completo, foto_url: c.foto_url });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="relative">
                                    <Check className={cn(
                                      "mr-2 h-4 w-4 absolute -left-6",
                                      (editingNode ? form.colaborador_id === c.id : form.selectedOcupantes.some(o => o.id === c.id)) ? "opacity-100" : "opacity-0"
                                    )} />
                                    <AvatarNode fotoUrl={c.foto_url} size="small" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{c.nome_completo}</span>
                                    <span className="text-[10px] text-muted-foreground">{c.cargo}</span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {!editingNode && (
                  <div className="mt-2 pt-2 border-t">
                    <Label className="text-xs">Ou digite um nome (sem vincular):</Label>
                    <Input
                      value={form.nome_ocupante}
                      onChange={(e) => setForm({ ...form, nome_ocupante: e.target.value, colaborador_id: "", selectedOcupantes: [] })}
                      placeholder="Nome personalizado"
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                )}

                {organograma.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label>Posição {form.parent_id ? "" : "(opcional)"}</Label>
                      {!editingNode && !insertingBetweenId && (
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-[10px]" 
                          onClick={openDialogForRootInsertion}
                        >
                          Tornar Raiz Principal (acima de todos)
                        </Button>
                      )}
                      {insertingBetweenId === "all_roots" && (
                        <Badge variant="secondary" className="text-[10px]">Modo: Nova Raiz Principal</Badge>
                      )}
                    </div>
                    <Select 
                      value={insertingBetweenId === "all_roots" ? "_new_root" : (form.parent_id || "_none")} 
                      onValueChange={(v) => {
                        if (v === "_new_root") {
                          openDialogForRootInsertion();
                        } else {
                          setInsertingBetweenId(null);
                          setForm({ ...form, parent_id: v === "_none" ? "" : v });
                        }
                      }}
                      disabled={insertingBetweenId && insertingBetweenId !== "all_roots"}
                    >
                      <SelectTrigger><SelectValue placeholder="Raiz (sem superior)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Raiz (sem superior)</SelectItem>
                        <SelectItem value="_new_root" className="text-primary font-medium">Tornar Raiz Principal (acima de todos)</SelectItem>
                        {organograma.map((n) => (
                          <SelectItem key={n.id} value={n.id}>{n.titulo}{n.nome_ocupante ? ` (${n.nome_ocupante})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button onClick={handleCreateOrUpdate} disabled={!form.titulo.trim() || isCreating} className="w-full">
                  {isCreating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  {editingNode ? "Salvar Alterações" : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={showCargoConfirm} onOpenChange={setShowCargoConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  Nova Função Detectada
                </AlertDialogTitle>
                <AlertDialogDescription>
                  A função <strong>"{form.titulo}"</strong> não está cadastrada no sistema. 
                  Deseja cadastrá-la no módulo de funções para uso futuro ou apenas adicioná-la a este organograma?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel onClick={() => setShowCargoConfirm(false)}>Cancelar</AlertDialogCancel>
                <div className="flex flex-1 gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setShowCargoConfirm(false); executeFinalCreation(false); }}>
                    {editingNode ? "Apenas Salvar" : "Apenas Adicionar"}
                  </Button>
                  <Button onClick={() => { setShowCargoConfirm(false); executeFinalCreation(true); }}>
                    {editingNode ? "Cadastrar e Salvar" : "Cadastrar e Adicionar"}
                  </Button>
                </div>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
        <OrgCanvas onDropBackground={(draggedId) => {
          updateOrgNode.mutate({ id: draggedId, parent_id: null });
          toast.success("Posição movida para a raiz");
        }}>
          <OrgTree
            roots={tree}
            onDelete={(id) => deleteOrgNode.mutate(id)}
            onAddChild={openDialogForParent}
            onAddSibling={(parentId) => openDialogForParent(parentId || "")}
            onInsertBetween={openDialogForInsertion}
            onEdit={(id) => {
              const node = organograma.find(n => n.id === id);
              if (node) openDialogForEdit(node);
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