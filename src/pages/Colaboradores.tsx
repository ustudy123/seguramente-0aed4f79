import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight
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
import { cn } from "@/lib/utils";

interface Colaborador {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  departamento: string;
  dataAdmissao: string;
  status: "ativo" | "ferias" | "afastado" | "desligado";
  avatar?: string;
}

const colaboradores: Colaborador[] = [
  {
    id: 1,
    nome: "Ana Carolina Silva",
    email: "ana.silva@empresa.com",
    telefone: "(11) 99999-1111",
    cargo: "Analista de RH",
    departamento: "Recursos Humanos",
    dataAdmissao: "2024-01-15",
    status: "ativo",
  },
  {
    id: 2,
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@empresa.com",
    telefone: "(11) 99999-2222",
    cargo: "Desenvolvedor Full Stack",
    departamento: "Tecnologia",
    dataAdmissao: "2023-06-01",
    status: "ferias",
  },
  {
    id: 3,
    nome: "Paula Santos Oliveira",
    email: "paula.oliveira@empresa.com",
    telefone: "(11) 99999-3333",
    cargo: "Gerente de Projetos",
    departamento: "Projetos",
    dataAdmissao: "2022-03-10",
    status: "ativo",
  },
  {
    id: 4,
    nome: "João Pedro Almeida",
    email: "joao.almeida@empresa.com",
    telefone: "(11) 99999-4444",
    cargo: "Analista Financeiro",
    departamento: "Financeiro",
    dataAdmissao: "2023-09-20",
    status: "ativo",
  },
  {
    id: 5,
    nome: "Maria Fernanda Costa",
    email: "maria.costa@empresa.com",
    telefone: "(11) 99999-5555",
    cargo: "Designer UX/UI",
    departamento: "Design",
    dataAdmissao: "2024-02-01",
    status: "ativo",
  },
  {
    id: 6,
    nome: "Roberto Carlos Lima",
    email: "roberto.lima@empresa.com",
    telefone: "(11) 99999-6666",
    cargo: "Coordenador de Vendas",
    departamento: "Comercial",
    dataAdmissao: "2021-11-15",
    status: "afastado",
  },
  {
    id: 7,
    nome: "Fernanda Rodrigues",
    email: "fernanda.rodrigues@empresa.com",
    telefone: "(11) 99999-7777",
    cargo: "Analista de Marketing",
    departamento: "Marketing",
    dataAdmissao: "2023-04-10",
    status: "ativo",
  },
  {
    id: 8,
    nome: "Lucas Martins",
    email: "lucas.martins@empresa.com",
    telefone: "(11) 99999-8888",
    cargo: "Desenvolvedor Backend",
    departamento: "Tecnologia",
    dataAdmissao: "2022-08-22",
    status: "ativo",
  },
];

const statusStyles = {
  ativo: "bg-success/10 text-success border-success/20",
  ferias: "bg-info/10 text-info border-info/20",
  afastado: "bg-warning/10 text-warning border-warning/20",
  desligado: "bg-muted text-muted-foreground border-muted",
};

const statusLabels = {
  ativo: "Ativo",
  ferias: "Férias",
  afastado: "Afastado",
  desligado: "Desligado",
};

const Colaboradores = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredColaboradores = colaboradores.filter((colab) => {
    const matchesSearch = 
      colab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      colab.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      departmentFilter === "all" || colab.departamento === departmentFilter;
    
    const matchesStatus = 
      statusFilter === "all" || colab.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const departments = [...new Set(colaboradores.map((c) => c.departamento))];

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
        <Button className="gradient-primary shadow-glow">
          <Plus className="w-4 h-4 mr-2" />
          Novo Colaborador
        </Button>
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
              placeholder="Buscar por nome, email ou cargo..."
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
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
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

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{filteredColaboradores.length}</span> de{" "}
          <span className="font-medium text-foreground">{colaboradores.length}</span> colaboradores
        </p>
      </div>

      {/* Colaboradores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredColaboradores.map((colab, index) => (
          <motion.div
            key={colab.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
            className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={colab.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {colab.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {colab.nome}
                  </h3>
                  <p className="text-sm text-muted-foreground">{colab.cargo}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                  <DropdownMenuItem>Editar</DropdownMenuItem>
                  <DropdownMenuItem>Documentos</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">Desligar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="truncate">{colab.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{colab.telefone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span>{colab.departamento}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Desde {new Date(colab.dataAdmissao).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <Badge className={cn("text-xs", statusStyles[colab.status])}>
                {statusLabels[colab.status]}
              </Badge>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
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
        <Button variant="outline" size="sm">2</Button>
        <Button variant="outline" size="sm">3</Button>
        <Button variant="outline" size="icon">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
  );
};

export default Colaboradores;
