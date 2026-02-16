import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Search, 
  Plus, 
  Download, 
  Upload,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Briefcase,
  MapPin,
  X,
  LayoutGrid,
  List,
  FolderOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useColaboradores } from "@/hooks/useColaboradores";
import { ColaboradorForm, ColaboradorEditData } from "@/components/colaboradores/ColaboradorForm";
import { ImportPlanilhaModal } from "@/components/import/ImportPlanilhaModal";
import { DesligamentoForm } from "@/components/admissao/DesligamentoForm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ColaboradorExtendido {
  id: string;
  nome_completo: string;
  email: string;
  celular: string | null;
  cargo: string;
  departamento: string | null;
  data_admissao: string | null;
  status: string;
  cpf: string;
  filial: string | null;
  tipo_contrato: string | null;
}

const statusStyles: Record<string, string> = {
  concluido: "bg-success/10 text-success border-success/20",
  ativo: "bg-success/10 text-success border-success/20",
  ferias: "bg-info/10 text-info border-info/20",
  afastado: "bg-warning/10 text-warning border-warning/20",
  desligado: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<string, string> = {
  concluido: "Ativo",
  ativo: "Ativo",
  ferias: "Férias",
  afastado: "Afastado",
  desligado: "Desligado",
};

const Colaboradores = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState<ColaboradorExtendido | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<ColaboradorEditData | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [desligarColab, setDesligarColab] = useState<ColaboradorExtendido | null>(null);

  const handleEditColaborador = (colab: ColaboradorExtendido) => {
    setEditingColaborador({
      id: colab.id,
      nome_completo: colab.nome_completo,
      cpf: colab.cpf,
      email: colab.email,
      celular: colab.celular,
      tipo_contrato: colab.tipo_contrato,
      cargo: colab.cargo,
      departamento: colab.departamento,
      filial: colab.filial,
      data_admissao: colab.data_admissao,
    });
    setShowForm(true);
  };

  const handleCloseForm = (open: boolean) => {
    setShowForm(open);
    if (!open) {
      setEditingColaborador(null);
    }
  };

  const handleViewProfile = (colab: ColaboradorExtendido) => {
    setSelectedColaborador(colab);
    setShowDetail(true);
  };

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["colaboradores-list"] });
    queryClient.invalidateQueries({ queryKey: ["cargos"] });
    queryClient.invalidateQueries({ queryKey: ["departamentos"] });
  };

  // Buscar colaboradores do banco
  const { data: colaboradores = [], isLoading, refetch } = useQuery({
    queryKey: ["colaboradores-list", tenantId],
    queryFn: async (): Promise<ColaboradorExtendido[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("admissoes")
        .select("id, nome_completo, cpf, cargo, departamento, email, celular, filial, data_admissao, status, tipo_contrato")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido")
        .order("nome_completo");

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filteredColaboradores = colaboradores.filter((colab) => {
    const matchesSearch = 
      colab.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      departmentFilter === "all" || colab.departamento === departmentFilter;
    
    const matchesStatus = 
      statusFilter === "all" || colab.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const departments = [
    ...new Set(
      colaboradores
        .map((c) => c.departamento)
        .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
        .map((d) => d.trim()),
    ),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground">Gerencie sua equipe</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Planilha
          </Button>
          <Button className="gradient-primary shadow-glow" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Colaborador
          </Button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-card rounded-xl border border-border p-4 shadow-sm"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Departamentos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="concluido">Ativo</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Results Count & View Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{filteredColaboradores.length}</span> de{" "}
          <span className="font-medium text-foreground">{colaboradores.length}</span> colaboradores
        </p>
        <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "cards" | "list")}>
          <ToggleGroupItem value="cards" aria-label="Visualização em cards" className="h-9 px-3">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Visualização em lista" className="h-9 px-3">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : colaboradores.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-card rounded-xl border border-border"
        >
          <p className="text-muted-foreground mb-4">Nenhum colaborador cadastrado ainda.</p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Primeiro Colaborador
          </Button>
        </motion.div>
      ) : viewMode === "cards" ? (
        /* Colaboradores Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredColaboradores.map((colab, index) => (
            <motion.div
              key={colab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
              className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer"
              onClick={() => handleViewProfile(colab)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {colab.nome_completo.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {colab.nome_completo}
                    </h3>
                    <p className="text-sm text-muted-foreground">{colab.cargo}</p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewProfile(colab)}>
                        Ver perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditColaborador(colab)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/documentos?colaborador=${colab.id}`)}>
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Documentos
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDesligarColab(colab)}
                      >
                        Desligar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{colab.email}</span>
                </div>
                {colab.celular && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{colab.celular}</span>
                  </div>
                )}
                {colab.departamento && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span>{colab.departamento}</span>
                  </div>
                )}
                {colab.data_admissao && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Desde {new Date(colab.data_admissao).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <Badge className={cn("text-xs", statusStyles[colab.status] || statusStyles.concluido)}>
                  {statusLabels[colab.status] || "Ativo"}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Colaboradores List/Table */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Colaborador</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="hidden md:table-cell">Departamento</TableHead>
                <TableHead className="hidden lg:table-cell">Contato</TableHead>
                <TableHead className="hidden xl:table-cell">Admissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredColaboradores.map((colab) => (
                <TableRow 
                  key={colab.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleViewProfile(colab)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {colab.nome_completo.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{colab.nome_completo}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{colab.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{colab.cargo}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {colab.departamento || "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {colab.celular || "-"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {colab.data_admissao 
                      ? new Date(colab.data_admissao).toLocaleDateString("pt-BR") 
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", statusStyles[colab.status] || statusStyles.concluido)}>
                      {statusLabels[colab.status] || "Ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewProfile(colab)}>
                          Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditColaborador(colab)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/documentos?colaborador=${colab.id}`)}>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Documentos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDesligarColab(colab)}
                        >
                          Desligar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Pagination - only show if we have colaboradores */}
      {colaboradores.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="flex items-center justify-center gap-2"
        >
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
            1
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {/* Form Modal */}
      <ColaboradorForm
        open={showForm}
        onOpenChange={handleCloseForm}
        onSuccess={() => refetch()}
        colaborador={editingColaborador}
      />

      {/* Import Modal */}
      <ImportPlanilhaModal
        open={showImport}
        onOpenChange={setShowImport}
        onSuccess={handleImportSuccess}
        titulo="Importar Colaboradores"
        descricao="Importe uma planilha para criar colaboradores, funções e departamentos automaticamente"
      />

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {selectedColaborador?.nome_completo.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">{selectedColaborador?.nome_completo}</p>
                <p className="text-sm text-muted-foreground font-normal">{selectedColaborador?.cargo}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedColaborador && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> CPF
                  </p>
                  <p className="text-sm font-medium">
                    {selectedColaborador.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </p>
                  <p className="text-sm font-medium truncate">{selectedColaborador.email}</p>
                </div>
                {selectedColaborador.celular && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Celular
                    </p>
                    <p className="text-sm font-medium">{selectedColaborador.celular}</p>
                  </div>
                )}
                {selectedColaborador.departamento && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Departamento
                    </p>
                    <p className="text-sm font-medium">{selectedColaborador.departamento}</p>
                  </div>
                )}
                {selectedColaborador.filial && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Filial
                    </p>
                    <p className="text-sm font-medium">{selectedColaborador.filial}</p>
                  </div>
                )}
                {selectedColaborador.data_admissao && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Data de Admissão
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(selectedColaborador.data_admissao).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <Badge className={cn("text-xs", statusStyles[selectedColaborador.status] || statusStyles.concluido)}>
                  {statusLabels[selectedColaborador.status] || "Ativo"}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setShowDetail(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Desligamento Form */}
      {desligarColab && (
        <DesligamentoForm
          open={!!desligarColab}
          onOpenChange={(open) => { if (!open) setDesligarColab(null); }}
          admissao={{
            id: desligarColab.id,
            nome_completo: desligarColab.nome_completo,
            cargo: desligarColab.cargo,
            data_admissao: desligarColab.data_admissao,
            tipo_contrato: desligarColab.tipo_contrato,
          }}
          onConfirmar={async (id, dados) => {
            const { error } = await supabase
              .from("admissoes")
              .update({ ...dados, status: "desligado" } as any)
              .eq("id", id);
            if (error) throw error;
            toast.success("Desligamento registrado com sucesso");
            setDesligarColab(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default Colaboradores;
