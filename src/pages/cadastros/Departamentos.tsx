import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Building2, Search, UserCog, KeyRound, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useDepartamentos, useFiliais, Departamento } from "@/hooks/useCadastros";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useColaboradores } from "@/hooks/useColaboradores";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useSyncCadastros } from "@/hooks/useSyncCadastros";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface ColaboradorPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  options: { id: string; nome_completo: string; cpf: string }[];
  allowClear?: boolean;
}

function ColaboradorPicker({ value, onChange, placeholder, options, allowClear }: ColaboradorPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selected ? selected.nome_completo : <span className="text-muted-foreground">{placeholder || "Selecione um colaborador"}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar colaborador..." />
          <CommandList>
            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }}>
                  <span className="text-muted-foreground">— Nenhum —</span>
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.nome_completo} ${o.cpf}`}
                  onSelect={() => { onChange(o.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  {o.nome_completo}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Departamentos() {
  const { departamentos, isLoading, createDepartamento, updateDepartamento, deleteDepartamento } = useDepartamentos();
  const { filiais } = useFiliais();
  const { empresaAtiva } = useEmpresaAtiva();
  const { colaboradores } = useColaboradores({ excluirPJ: true });
  const { sincronizar } = useSyncCadastros();
  const { hasMinimumRole } = useAuth();
  const isAdmin = hasMinimumRole("manager");

  useEffect(() => {
    sincronizar();
  }, [sincronizar]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDepartamento, setSelectedDepartamento] = useState<Departamento | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    ativo: true,
    filial_id: null as string | null,
    gestor_admissao_id: null as string | null,
    gestor_substituto_admissao_id: null as string | null,
    substituto_ativo: false,
  });
  const [provisioning, setProvisioning] = useState(false);

  // Mostra apenas estabelecimentos/obras ativos DA EMPRESA ATIVA.
  // Sem esse filtro, o dropdown exibia registros de outras empresas
  // do mesmo tenant (YOUREYES-148).
  const filiaisAtivas = filiais.filter(
    (f) => f.ativo && (!empresaAtiva || f.empresa_id === empresaAtiva.id)
  );

  const colabOptions = useMemo(
    () => colaboradores.map((c) => ({ id: c.id, nome_completo: c.nome_completo, cpf: c.cpf })),
    [colaboradores],
  );

  const colabById = useMemo(() => {
    const m = new Map<string, string>();
    colabOptions.forEach((c) => m.set(c.id, c.nome_completo));
    return m;
  }, [colabOptions]);

  const filteredDepartamentos = departamentos.filter((dep) =>
    dep.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFilialNome = (filialId: string | null) =>
    !filialId ? "-" : filiais.find((f) => f.id === filialId)?.nome || "-";

  const handleOpenCreate = () => {
    setSelectedDepartamento(null);
    setFormData({
      nome: "", descricao: "", ativo: true, filial_id: null,
      gestor_admissao_id: null, gestor_substituto_admissao_id: null, substituto_ativo: false,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (d: Departamento) => {
    setSelectedDepartamento(d);
    setFormData({
      nome: d.nome,
      descricao: d.descricao || "",
      ativo: d.ativo,
      filial_id: d.filial_id ?? null,
      gestor_admissao_id: d.gestor_admissao_id ?? null,
      gestor_substituto_admissao_id: d.gestor_substituto_admissao_id ?? null,
      substituto_ativo: d.substituto_ativo ?? false,
    });
    setIsFormOpen(true);
  };

  const handleOpenDelete = (d: Departamento) => {
    setSelectedDepartamento(d);
    setIsDeleteOpen(true);
  };

  const provisionarGestor = async (admissaoId: string) => {
    const { data, error } = await supabase.functions.invoke("provisionar-gestor", {
      body: { admissao_id: admissaoId },
    });
    if (error || (data as any)?.error) {
      toast.error(`Falha ao provisionar gestor: ${(data as any)?.error || error?.message}`);
      return;
    }
    toast.success(`Login criado: ${(data as any).login} — senha inicial: CPF do gestor.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      responsavel_id: null,
    };
    const previousGestor = selectedDepartamento?.gestor_admissao_id ?? null;
    const previousSub = selectedDepartamento?.gestor_substituto_admissao_id ?? null;

    if (selectedDepartamento) {
      await updateDepartamento.mutateAsync({ id: selectedDepartamento.id, ...payload } as any);
    } else {
      await createDepartamento.mutateAsync(payload as any);
    }

    // Provisionar novos gestores
    setProvisioning(true);
    try {
      if (formData.gestor_admissao_id && formData.gestor_admissao_id !== previousGestor) {
        await provisionarGestor(formData.gestor_admissao_id);
      }
      if (formData.gestor_substituto_admissao_id && formData.gestor_substituto_admissao_id !== previousSub) {
        await provisionarGestor(formData.gestor_substituto_admissao_id);
      }
    } finally {
      setProvisioning(false);
    }

    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (selectedDepartamento) {
      await deleteDepartamento.mutateAsync(selectedDepartamento.id);
      setIsDeleteOpen(false);
    }
  };

  const handleResetSenha = async (admissaoId: string, nome: string) => {
    const { data, error } = await supabase.functions.invoke("reset-senha-gestor", {
      body: { admissao_id: admissaoId },
    });
    if (error || (data as any)?.error) {
      toast.error(`Falha ao resetar senha: ${(data as any)?.error || error?.message}`);
      return;
    }
    toast.success(`Link de redefinição enviado para ${nome}. Login: ${(data as any).login}`);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departamentos</h1>
          <p className="text-muted-foreground">Gerencie departamentos, gestores e substitutos</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Departamento
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar departamentos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-sm"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Estabelecimento/Obra</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Substituto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : filteredDepartamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum departamento encontrado" : "Nenhum departamento cadastrado"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDepartamentos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{getFilialNome(d.filial_id)}</TableCell>
                  <TableCell>
                    {d.gestor_admissao_id
                      ? <span className="text-sm">{colabById.get(d.gestor_admissao_id) || "—"}</span>
                      : <span className="text-xs text-muted-foreground italic">Sem gestor</span>}
                  </TableCell>
                  <TableCell>
                    {d.gestor_substituto_admissao_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{colabById.get(d.gestor_substituto_admissao_id) || "—"}</span>
                        {d.substituto_ativo && <Badge variant="default" className="text-[10px]">Atuando</Badge>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground italic">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.ativo ? "default" : "secondary"}>{d.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isAdmin && d.gestor_admissao_id && (
                        <Button variant="ghost" size="icon" title="Resetar senha do gestor"
                          onClick={() => handleResetSenha(d.gestor_admissao_id!, colabById.get(d.gestor_admissao_id!) || "gestor")}>
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(d)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(d)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedDepartamento ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
            <DialogDescription>
              {selectedDepartamento ? "Edite as informações do departamento" : "Preencha os dados do novo departamento"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Recursos Humanos" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filial">Estabelecimento/Obra</Label>
              <Select value={formData.filial_id ?? "none"} onValueChange={(v) => setFormData({ ...formData, filial_id: v === "none" ? null : v })}>
                <SelectTrigger id="filial"><SelectValue placeholder="Selecione um estabelecimento ou obra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (vinculado à empresa)</SelectItem>
                  {filiaisAtivas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                      <span className="text-muted-foreground"> · {f.tipo === "obra" ? "Obra" : "Estabelecimento"}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserCog className="w-4 h-4" /> Gestão do Departamento
              </div>
              <div className="space-y-2">
                <Label>Gestor responsável</Label>
                <ColaboradorPicker
                  value={formData.gestor_admissao_id}
                  onChange={(id) => setFormData({ ...formData, gestor_admissao_id: id })}
                  options={colabOptions}
                  placeholder="Selecione o gestor titular"
                  allowClear
                />
                <p className="text-xs text-muted-foreground">
                  Ao salvar, será gerado um login `primeiro.ultimo@youreyes.com.br` com senha inicial = CPF.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Substituto do gestor (opcional)</Label>
                <ColaboradorPicker
                  value={formData.gestor_substituto_admissao_id}
                  onChange={(id) => setFormData({ ...formData, gestor_substituto_admissao_id: id, substituto_ativo: id ? formData.substituto_ativo : false })}
                  options={colabOptions.filter((o) => o.id !== formData.gestor_admissao_id)}
                  placeholder="Selecione um substituto"
                  allowClear
                />
              </div>
              {formData.gestor_substituto_admissao_id && (
                <div className="flex items-center justify-between rounded-md border bg-background p-2">
                  <div>
                    <Label htmlFor="substituto_ativo" className="text-sm">Substituto está atuando agora</Label>
                    <p className="text-xs text-muted-foreground">Ative durante licenças/afastamentos do gestor titular.</p>
                  </div>
                  <Switch id="substituto_ativo" checked={formData.substituto_ativo}
                    onCheckedChange={(c) => setFormData({ ...formData, substituto_ativo: c })} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch id="ativo" checked={formData.ativo} onCheckedChange={(c) => setFormData({ ...formData, ativo: c })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createDepartamento.isPending || updateDepartamento.isPending || provisioning}>
                {provisioning ? "Provisionando..." : selectedDepartamento ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Departamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o departamento "{selectedDepartamento?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
