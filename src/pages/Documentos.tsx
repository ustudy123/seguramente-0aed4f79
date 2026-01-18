import { useState } from "react";
import { motion } from "framer-motion";
import { 
  FileText, 
  Upload, 
  Search,
  Folder,
  File,
  FileCheck,
  FileWarning,
  Download,
  MoreHorizontal,
  Eye,
  Trash2,
  Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Documento {
  id: number;
  nome: string;
  tipo: string;
  colaborador: string;
  dataUpload: string;
  dataValidade?: string;
  status: "valido" | "vencendo" | "vencido";
  tamanho: string;
}

const documentos: Documento[] = [
  {
    id: 1,
    nome: "Contrato_Ana_Silva.pdf",
    tipo: "Contrato",
    colaborador: "Ana Carolina Silva",
    dataUpload: "2024-01-15",
    status: "valido",
    tamanho: "245 KB",
  },
  {
    id: 2,
    nome: "ASO_Carlos_Mendes.pdf",
    tipo: "ASO",
    colaborador: "Carlos Eduardo Mendes",
    dataUpload: "2024-06-01",
    dataValidade: "2025-01-25",
    status: "vencendo",
    tamanho: "180 KB",
  },
  {
    id: 3,
    nome: "Certificado_NR35_Paula.pdf",
    tipo: "Certificado",
    colaborador: "Paula Santos Oliveira",
    dataUpload: "2023-03-10",
    dataValidade: "2025-03-10",
    status: "valido",
    tamanho: "512 KB",
  },
  {
    id: 4,
    nome: "ASO_Joao_Almeida.pdf",
    tipo: "ASO",
    colaborador: "João Pedro Almeida",
    dataUpload: "2023-09-20",
    dataValidade: "2024-12-20",
    status: "vencido",
    tamanho: "156 KB",
  },
  {
    id: 5,
    nome: "Ficha_Registro_Maria.pdf",
    tipo: "Ficha de Registro",
    colaborador: "Maria Fernanda Costa",
    dataUpload: "2024-02-01",
    status: "valido",
    tamanho: "320 KB",
  },
  {
    id: 6,
    nome: "CTPS_Roberto_Lima.pdf",
    tipo: "CTPS",
    colaborador: "Roberto Carlos Lima",
    dataUpload: "2021-11-15",
    status: "valido",
    tamanho: "890 KB",
  },
];

const categorias = [
  { nome: "Contratos", icon: FileText, count: 45 },
  { nome: "ASOs", icon: FileCheck, count: 198 },
  { nome: "Certificados", icon: File, count: 89 },
  { nome: "Fichas de Registro", icon: Folder, count: 198 },
  { nome: "CTPS", icon: FileText, count: 198 },
  { nome: "Outros", icon: Folder, count: 56 },
];

const statusConfig = {
  valido: {
    label: "Válido",
    icon: FileCheck,
    style: "bg-success/10 text-success border-success/20",
  },
  vencendo: {
    label: "Vencendo",
    icon: Clock,
    style: "bg-warning/10 text-warning border-warning/20",
  },
  vencido: {
    label: "Vencido",
    icon: FileWarning,
    style: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const Documentos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredDocs = documentos.filter((doc) => {
    const matchesSearch = 
      doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.colaborador.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === "all" || doc.tipo === tipoFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesTipo && matchesStatus;
  });

  const stats = {
    total: documentos.length,
    vencendo: documentos.filter((d) => d.status === "vencendo").length,
    vencidos: documentos.filter((d) => d.status === "vencido").length,
  };

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
          <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
          <p className="text-muted-foreground">Gestão de arquivos e documentos</p>
        </div>
        <Button className="gradient-primary shadow-glow">
          <Upload className="w-4 h-4 mr-2" />
          Upload de Documento
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total de Documentos</p>
          </div>
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.vencendo}</p>
            <p className="text-sm text-muted-foreground">Vencendo em 30 dias</p>
          </div>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-destructive/10">
            <FileWarning className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.vencidos}</p>
            <p className="text-sm text-muted-foreground">Documentos Vencidos</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="todos" className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="todos" className="space-y-4">
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-4 shadow-sm"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documento ou colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="Contrato">Contrato</SelectItem>
                  <SelectItem value="ASO">ASO</SelectItem>
                  <SelectItem value="Certificado">Certificado</SelectItem>
                  <SelectItem value="Ficha de Registro">Ficha de Registro</SelectItem>
                  <SelectItem value="CTPS">CTPS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="valido">Válido</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Documents List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
          >
            <div className="divide-y divide-border">
              {filteredDocs.map((doc, index) => {
                const config = statusConfig[doc.status];
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-lg", config.style)}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{doc.nome}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{doc.colaborador}</span>
                          <span>•</span>
                          <span>{doc.tipo}</span>
                          <span>•</span>
                          <span>{doc.tamanho}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.dataValidade && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-muted-foreground">Validade</p>
                          <p className="text-sm font-medium">
                            {new Date(doc.dataValidade).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      )}
                      <Badge className={cn("text-xs hidden sm:flex", config.style)}>
                        {config.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="categorias">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {categorias.map((cat, index) => (
              <motion.div
                key={cat.nome}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <cat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {cat.nome}
                    </h3>
                    <p className="text-sm text-muted-foreground">{cat.count} documentos</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Documentos;
