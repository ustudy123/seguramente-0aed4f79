import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSyncCadastros } from "@/hooks/useSyncCadastros";

export default function Departamentos() {
  const { departamentos, isLoading, createDepartamento, updateDepartamento, deleteDepartamento } = useDepartamentos();
  const { filiais } = useFiliais();
  const { sincronizar } = useSyncCadastros();

  useEffect(() => {
    sincronizar();
  }, [sincronizar]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDepartamento, setSelectedDepartamento] = useState<Departamento | null>(null);
  const [formData, setFormData] = useState<{
    nome: string;
    descricao: string;
    ativo: boolean;
    filial_id: string | null;
  }>({
    nome: "",
    descricao: "",
    ativo: true,
    filial_id: null,
  });

  const filiaisAtivas = filiais.filter((f) => f.ativo);

  const filteredDepartamentos = departamentos.filter((dep) =>
    dep.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFilialNome = (filialId: string | null) => {
    if (!filialId) return "-";
    return filiais.find((f) => f.id === filialId)?.nome || "-";
  };

  const handleOpenCreate = () => {
    setSelectedDepartamento(null);
    setFormData({ nome: "", descricao: "", ativo: true, filial_id: null });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (departamento: Departamento) => {
    setSelectedDepartamento(departamento);
    setFormData({
      nome: departamento.nome,
      descricao: departamento.descricao || "",
      ativo: departamento.ativo,
      filial_id: departamento.filial_id ?? null,
    });
    setIsFormOpen(true);
  };

  const handleOpenDelete = (departamento: Departamento) => {
    setSelectedDepartamento(departamento);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedDepartamento) {
      await updateDepartamento.mutateAsync({
        id: selectedDepartamento.id,
        ...formData,
        responsavel_id: null,
      });
    } else {
      await createDepartamento.mutateAsync({ ...formData, responsavel_id: null });
    }
    
    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (selectedDepartamento) {
      await deleteDepartamento.mutateAsync(selectedDepartamento.id);
      setIsDeleteOpen(false);
    }
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
          <h1 className="text-2xl font-bold text-foreground">Departamentos</h1>
          <p className="text-muted-foreground">
            Gerencie os departamentos da sua empresa
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Departamento
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
          placeholder="Buscar departamentos..."
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
              <TableHead>Estabelecimento/Obra</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredDepartamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm
                        ? "Nenhum departamento encontrado"
                        : "Nenhum departamento cadastrado"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDepartamentos.map((departamento) => (
                <TableRow key={departamento.id}>
                  <TableCell className="font-medium">{departamento.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {departamento.descricao || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={departamento.ativo ? "default" : "secondary"}>
                      {departamento.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(departamento)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(departamento)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDepartamento ? "Editar Departamento" : "Novo Departamento"}
            </DialogTitle>
            <DialogDescription>
              {selectedDepartamento
                ? "Edite as informações do departamento"
                : "Preencha os dados do novo departamento"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Recursos Humanos"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva as responsabilidades do departamento..."
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
                disabled={createDepartamento.isPending || updateDepartamento.isPending}
              >
                {selectedDepartamento ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Departamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o departamento "{selectedDepartamento?.nome}"?
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
