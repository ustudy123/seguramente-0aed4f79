import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, MapPin, Search, Building2, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useFiliais, Filial } from "@/hooks/useCadastros";
import { buscarEnderecoPorCep, formatCep, cleanCep, validateCep } from "@/lib/viacep";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { formatPhone } from "@/lib/brasilapi";
import type { EmpresaCadastro } from "@/types/empresa";

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
];

export default function Filiais() {
  const { filiais, isLoading, createFilial, updateFilial, deleteFilial } = useFiliais();
  const { empresaAtiva, empresas, isLoading: isLoadingEmpresas } = useEmpresaAtiva();

  // State: company search & selection
  const [cnpjSearch, setCnpjSearch] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaCadastro | null>(null);

  const currentEmpresa = useMemo(() => empresaAtiva || selectedEmpresa, [empresaAtiva, selectedEmpresa]);

  // State: establishment form
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFilial, setSelectedFilial] = useState<Filial | null>(null);
  const [formData, setFormData] = useState({
    nome: "", endereco: "", cidade: "", estado: "", cep: "",
    telefone: "", email: "", ativo: true, tipo: "estabelecimento" as string, cno: "",
  });

  // Filter only companies (Matriz) and search by CNPJ
  const filteredEmpresas = useMemo(() => {
    // We only want to show companies (Matriz), never branches (Filiais)
    const baseEmpresas = empresas.filter(e => e.ativo && (e.tipo_unidade === 'matriz' || !e.tipo_unidade));
    
    if (!cnpjSearch.trim()) return baseEmpresas;
    
    const term = cnpjSearch.toLowerCase().replace(/\D/g, "");
    return baseEmpresas.filter(e => 
      e.cnpj?.replace(/\D/g, "").includes(term)
    );
  }, [empresas, cnpjSearch]);

  // Filter establishments by selected company
  const estabelecimentos = useMemo(() => {
    if (!currentEmpresa) return [];
    return filiais.filter(f => f.empresa_id === currentEmpresa.id);
  }, [filiais, currentEmpresa]);

  const filteredEstabelecimentos = useMemo(() => {
    if (!searchTerm) return estabelecimentos;
    const s = searchTerm.toLowerCase();
    return estabelecimentos.filter(f =>
      f.nome.toLowerCase().includes(s) || f.cidade?.toLowerCase().includes(s)
    );
  }, [estabelecimentos, searchTerm]);

  const handleSelectEmpresa = (empresa: EmpresaCadastro) => {
    setSelectedEmpresa(empresa);
    setSearchTerm("");
  };

  const handleBack = () => {
    setSelectedEmpresa(null);
    setSearchTerm("");
  };

  const handleOpenCreate = () => {
    setSelectedFilial(null);
    setFormData({ nome: "", endereco: "", cidade: "", estado: "", cep: "", telefone: "", email: "", ativo: true, tipo: "estabelecimento", cno: "" });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (filial: Filial) => {
    setSelectedFilial(filial);
    setFormData({
      nome: filial.nome,
      endereco: filial.endereco || "",
      cidade: filial.cidade || "",
      estado: filial.estado || "",
      cep: filial.cep || "",
      telefone: filial.telefone || "",
      email: filial.email || "",
      ativo: filial.ativo,
      tipo: filial.tipo || "estabelecimento",
      cno: filial.cno || "",
    });
    setIsFormOpen(true);
  };

  const handleOpenDelete = (filial: Filial) => {
    setSelectedFilial(filial);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmpresa) return;

    const payload = {
      ...formData,
      cnpj: currentEmpresa.cnpj || null,
      endereco: formData.endereco || null,
      cidade: formData.cidade || null,
      estado: formData.estado || null,
      cep: formData.cep || null,
      telefone: formData.telefone || null,
      email: formData.email || null,
      cno: formData.tipo === "obra" ? (formData.cno || null) : null,
      responsavel_id: null,
      empresa_id: currentEmpresa.id,
    };

    if (selectedFilial) {
      await updateFilial.mutateAsync({ id: selectedFilial.id, ...payload });
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
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  // ── STEP 1: Company selection ──
  if (!currentEmpresa) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Estabelecimento ou Obra</h1>
          <p className="text-muted-foreground">Selecione a empresa para gerenciar seus estabelecimentos ou obras</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="w-4 h-4 text-primary" />
            <AlertTitle className="text-primary font-semibold">O que é Estabelecimento ou Obra?</AlertTitle>
            <AlertDescription className="text-muted-foreground space-y-4 pt-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Estabelecimento
                  </p>
                  <p className="text-sm">Locais fixos da empresa como sedes, unidades, escritórios ou armazéns.</p>
                  <p className="text-xs italic text-primary/70">Ex: Escritório Central, Unidade Operacional, Galpão Logístico.</p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Obra
                  </p>
                  <p className="text-sm">Locais temporários de prestação de serviços, construções ou reformas.</p>
                  <p className="text-xs italic text-primary/70">Ex: Canteiro de Obras Residencial, Reforma Unidade X.</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por CNPJ da empresa..."
            value={cnpjSearch}
            onChange={(e) => setCnpjSearch(e.target.value)}
            className="pl-10 max-w-lg"
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid gap-3">
          {isLoadingEmpresas ? (
            <p className="text-muted-foreground text-center py-8">Carregando empresas...</p>
          ) : filteredEmpresas.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {cnpjSearch ? "Nenhuma empresa (Matriz) encontrada com este CNPJ" : "Nenhuma empresa (Matriz) cadastrada"}
              </p>
            </div>
          ) : (
            filteredEmpresas.map(empresa => {
              const qtdEstabelecimentos = filiais.filter(f => f.empresa_id === empresa.id).length;
              return (
                <Card
                  key={empresa.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleSelectEmpresa(empresa)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {empresa.razao_social || empresa.nome_fantasia || "Sem nome"}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {empresa.cnpj && <span>CNPJ: {formatCnpj(empresa.cnpj)}</span>}
                          {empresa.cidade && empresa.estado && (
                            <span>{empresa.cidade} - {empresa.estado}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{qtdEstabelecimentos} registro{qtdEstabelecimentos !== 1 ? "s" : ""}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </motion.div>
      </div>
    );
  }

  // ── STEP 2: Establishment management for selected company ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        {!empresaAtiva && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 text-muted-foreground -ml-2">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Voltar para seleção de empresa
          </Button>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Estabelecimento ou Obra
            </h1>
            <p className="text-muted-foreground">
              {currentEmpresa.razao_social || currentEmpresa.nome_fantasia}
              {currentEmpresa.cnpj && ` · CNPJ: ${formatCnpj(currentEmpresa.cnpj)}`}
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Registro
          </Button>
        </div>

        <Alert className="bg-primary/5 border-primary/20 py-3">
          <Info className="w-4 h-4 text-primary mt-1" />
          <AlertTitle className="text-primary font-semibold text-sm">Entenda os tipos de registro</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div>
              <span className="font-bold text-foreground">Estabelecimento:</span> Locais fixos (Sede, Unidade, Depósito).
            </div>
            <div>
              <span className="font-bold text-foreground">Obra:</span> Locais temporários (Canteiros, Reformas, Prestação de serviços).
            </div>
          </AlertDescription>
        </Alert>
      </motion.div>

      {/* Search */}
      {estabelecimentos.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estabelecimentos ou obras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-sm"
          />
        </motion.div>
      )}

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell>
              </TableRow>
            ) : filteredEstabelecimentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <MapPin className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchTerm ? "Nenhum registro encontrado" : "Nenhum registro cadastrado para esta empresa"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEstabelecimentos.map((filial) => (
                <TableRow key={filial.id}>
                  <TableCell className="font-medium">{filial.nome}</TableCell>
                  <TableCell>
                    <Badge variant={filial.tipo === "obra" ? "outline" : "secondary"}>
                      {filial.tipo === "obra" ? "Obra" : "Estabelecimento"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {filial.cidade && filial.estado ? `${filial.cidade} - ${filial.estado}` : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {filial.telefone ? formatPhone(filial.telefone) : filial.email || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={filial.ativo ? "default" : "secondary"}>
                      {filial.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(filial)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(filial)}>
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
            <DialogTitle>{selectedFilial ? "Editar Registro" : "Novo Registro"}</DialogTitle>
            <DialogDescription>
              {selectedFilial ? "Edite as informações" : "Preencha os dados do novo estabelecimento ou obra"}
              {" · "}
              {currentEmpresa.razao_social || currentEmpresa.nome_fantasia}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <select
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value, cno: e.target.value === "estabelecimento" ? "" : formData.cno })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="estabelecimento">Estabelecimento</option>
                  <option value="obra">Obra</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  {formData.tipo === "estabelecimento" 
                    ? "Locais fixos como sedes, filiais e escritórios." 
                    : "Locais temporários como canteiros de obras e reformas."}
                </p>
              </div>
              {formData.tipo === "obra" && (
                <div className="space-y-2">
                  <Label htmlFor="cno">CNO</Label>
                  <Input
                    id="cno"
                    value={formData.cno}
                    onChange={(e) => setFormData({ ...formData, cno: e.target.value })}
                    placeholder="Cadastro Nacional de Obras"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Unidade Centro, Galpão Industrial"
                required
              />
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
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={(e) => {
                    const formatted = formatCep(e.target.value);
                    setFormData({ ...formData, cep: formatted });
                    const cleaned = cleanCep(formatted);
                    if (cleaned.length === 8) {
                      buscarEnderecoPorCep(cleaned).then(endereco => {
                        if (endereco) {
                          setFormData(prev => ({
                            ...prev,
                            cidade: endereco.cidade,
                            estado: endereco.estado,
                            endereco: endereco.logradouro ? (prev.endereco || endereco.logradouro) : prev.endereco,
                          }));
                        }
                      });
                    }
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>
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
                  <option value="">UF</option>
                  {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
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
                  placeholder="unidade@empresa.com"
                />
              </div>
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
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createFilial.isPending || updateFilial.isPending}>
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
            <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedFilial?.nome}"? Esta ação não pode ser desfeita.
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
