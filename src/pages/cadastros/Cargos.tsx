import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Briefcase, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCargos, useDepartamentos, Cargo } from "@/hooks/useCadastros";

const NIVEIS = [
  { value: "estagiario", label: "Estagiário" },
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "especialista", label: "Especialista" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gerente", label: "Gerente" },
  { value: "diretor", label: "Diretor" },
];

export default function Cargos() {
  const { cargos, isLoading, createCargo, updateCargo, deleteCargo } = useCargos();
  const { departamentos } = useDepartamentos();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    departamento_id: null as string | null,
    nivel: null as string | null,
    faixa_salarial_min: null as number | null,
    faixa_salarial_max: null as number | null,
    ativo: true,
  });

  const filteredCargos = cargos.filter((cargo) =>
    cargo.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setSelectedCargo(null);
    setFormData({
      nome: "",
      descricao: "",
      departamento_id: null,
      nivel: null,
      faixa_salarial_min: null,
      faixa_salarial_max: null,
      ativo: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    setFormData({
      nome: cargo.nome,
      descricao: cargo.descricao || "",
      departamento_id: cargo.departamento_id,
      nivel: cargo.nivel,
      faixa_salarial_min: cargo.faixa_salarial_min,
      faixa_salarial_max: cargo.faixa_salarial_max,
      ativo: cargo.ativo,
    });
    setIsFormOpen(true);
  };

  const handleOpenDelete = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCargo) {
      await updateCargo.mutateAsync({
        id: selectedCargo.id,
        ...formData,
      });
    } else {
      await createCargo.mutateAsync(formData);
    }

    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (selectedCargo) {
      await deleteCargo.mutateAsync(selectedCargo.id);
      setIsDeleteOpen(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getNivelLabel = (nivel: string | null) => {
    if (!nivel) return "-";
    return NIVEIS.find((n) => n.value === nivel)?.label || nivel;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cargos</h1>
          <p className="text-muted-foreground">
            Gerencie os cargos da sua empresa
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Cargo
        </Button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cargos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-sm"
        />
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-lg border bg-card"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Faixa Salarial</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredCargos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Briefcase className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm
                        ? "Nenhum cargo encontrado"
                        : "Nenhum cargo cadastrado"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCargos.map((cargo) => (
                <TableRow key={cargo.id}>
                  <TableCell className="font-medium">{cargo.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {(cargo as any).departamento?.nome || "-"}
                  </TableCell>
                  <TableCell>{getNivelLabel(cargo.nivel)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cargo.faixa_salarial_min || cargo.faixa_salarial_max
                      ? `${formatCurrency(cargo.faixa_salarial_min)} - ${formatCurrency(cargo.faixa_salarial_max)}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cargo.ativo ? "default" : "secondary"}>
                      {cargo.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(cargo)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(cargo)}
                      >
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

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedCargo ? "Editar Cargo" : "Novo Cargo"}
            </DialogTitle>
            <DialogDescription>
              {selectedCargo
                ? "Edite as informações do cargo"
                : "Preencha os dados do novo cargo"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Analista de RH"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Select
                  value={formData.departamento_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      departamento_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {departamentos.map((dep) => (
                      <SelectItem key={dep.id} value={dep.id}>
                        {dep.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nivel">Nível</Label>
                <Select
                  value={formData.nivel || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      nivel: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {NIVEIS.map((nivel) => (
                      <SelectItem key={nivel.value} value={nivel.value}>
                        {nivel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="faixa_min">Salário Mínimo</Label>
                <Input
                  id="faixa_min"
                  type="number"
                  value={formData.faixa_salarial_min || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      faixa_salarial_min: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faixa_max">Salário Máximo</Label>
                <Input
                  id="faixa_max"
                  type="number"
                  value={formData.faixa_salarial_max || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      faixa_salarial_max: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva as responsabilidades do cargo..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createCargo.isPending || updateCargo.isPending}
              >
                {selectedCargo ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cargo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cargo "{selectedCargo?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
