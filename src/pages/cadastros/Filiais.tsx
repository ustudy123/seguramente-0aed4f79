import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, cleanPhone } from "@/components/ui/phone-input";
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
import { Switch } from "@/components/ui/switch";
import { useFiliais, Filial } from "@/hooks/useCadastros";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function Filiais() {
  const { filiais, isLoading, createFilial, updateFilial, deleteFilial } = useFiliais();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFilial, setSelectedFilial] = useState<Filial | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    email: "",
    ativo: true,
  });

  const filteredFiliais = filiais.filter((filial) =>
    filial.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    filial.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenCreate = () => {
    setSelectedFilial(null);
    setFormData({
      nome: "",
      cnpj: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      telefone: "",
      email: "",
      ativo: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (filial: Filial) => {
    setSelectedFilial(filial);
    setFormData({
      nome: filial.nome,
      cnpj: filial.cnpj || "",
      endereco: filial.endereco || "",
      cidade: filial.cidade || "",
      estado: filial.estado || "",
      cep: filial.cep || "",
      telefone: filial.telefone || "",
      email: filial.email || "",
      ativo: filial.ativo,
    });
    setIsFormOpen(true);
  };

  const handleOpenDelete = (filial: Filial) => {
    setSelectedFilial(filial);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      cnpj: formData.cnpj || null,
      endereco: formData.endereco || null,
      cidade: formData.cidade || null,
      estado: formData.estado || null,
      cep: formData.cep || null,
      telefone: formData.telefone || null,
      email: formData.email || null,
      responsavel_id: null,
    };

    if (selectedFilial) {
      await updateFilial.mutateAsync({
        id: selectedFilial.id,
        ...payload,
      });
    } else {
      await createFilial.mutateAsync(payload);
    }

    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (selectedFilial) {
      await deleteFilial.mutateAsync(selectedFilial.id);
      setIsDeleteOpen(false);
    }
  };

  const formatCnpj = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
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
          <h1 className="text-2xl font-bold text-foreground">Filiais</h1>
          <p className="text-muted-foreground">
            Gerencie as filiais da sua empresa
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Filial
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
          placeholder="Buscar filiais..."
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
              <TableHead>CNPJ</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Contato</TableHead>
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
            ) : filteredFiliais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <MapPin className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm
                        ? "Nenhuma filial encontrada"
                        : "Nenhuma filial cadastrada"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredFiliais.map((filial) => (
                <TableRow key={filial.id}>
                  <TableCell className="font-medium">{filial.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {filial.cnpj ? formatCnpj(filial.cnpj) : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {filial.cidade && filial.estado
                      ? `${filial.cidade} - ${filial.estado}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {filial.telefone || filial.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={filial.ativo ? "default" : "secondary"}>
                      {filial.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(filial)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDelete(filial)}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedFilial ? "Editar Filial" : "Nova Filial"}
            </DialogTitle>
            <DialogDescription>
              {selectedFilial
                ? "Edite as informações da filial"
                : "Preencha os dados da nova filial"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Matriz São Paulo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Selecione</option>
                  {ESTADOS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <PhoneInput
                  id="telefone"
                  value={formData.telefone}
                  onChange={(value) => setFormData({ ...formData, telefone: value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="filial@empresa.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ativo">Ativa</Label>
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
                disabled={createFilial.isPending || updateFilial.isPending}
              >
                {selectedFilial ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Filial</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a filial "{selectedFilial?.nome}"?
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
