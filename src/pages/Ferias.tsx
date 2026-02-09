import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Calendar, 
  Plus, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Sun,
  Plane
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FeriasItem {
  id: number;
  colaborador: string;
  departamento: string;
  dataInicio: string;
  dataFim: string;
  diasSolicitados: number;
  saldoDias: number;
  status: "pendente" | "aprovado" | "recusado";
  dataSolicitacao: string;
}

const initialFerias: FeriasItem[] = [
  {
    id: 1,
    colaborador: "Ana Carolina Silva",
    departamento: "Recursos Humanos",
    dataInicio: "2025-02-15",
    dataFim: "2025-03-01",
    diasSolicitados: 15,
    saldoDias: 30,
    status: "pendente",
    dataSolicitacao: "2025-01-10",
  },
  {
    id: 2,
    colaborador: "Carlos Eduardo Mendes",
    departamento: "Tecnologia",
    dataInicio: "2025-01-20",
    dataFim: "2025-02-04",
    diasSolicitados: 15,
    saldoDias: 15,
    status: "aprovado",
    dataSolicitacao: "2024-12-15",
  },
  {
    id: 3,
    colaborador: "Paula Santos Oliveira",
    departamento: "Projetos",
    dataInicio: "2025-03-10",
    dataFim: "2025-03-25",
    diasSolicitados: 15,
    saldoDias: 30,
    status: "pendente",
    dataSolicitacao: "2025-01-15",
  },
  {
    id: 4,
    colaborador: "João Pedro Almeida",
    departamento: "Financeiro",
    dataInicio: "2025-02-01",
    dataFim: "2025-02-10",
    diasSolicitados: 10,
    saldoDias: 20,
    status: "recusado",
    dataSolicitacao: "2025-01-05",
  },
  {
    id: 5,
    colaborador: "Maria Fernanda Costa",
    departamento: "Design",
    dataInicio: "2025-04-01",
    dataFim: "2025-04-20",
    diasSolicitados: 20,
    saldoDias: 30,
    status: "pendente",
    dataSolicitacao: "2025-01-16",
  },
];

const statusConfig = {
  pendente: {
    label: "Pendente",
    icon: Clock,
    style: "bg-warning/10 text-warning border-warning/20",
  },
  aprovado: {
    label: "Aprovado",
    icon: CheckCircle,
    style: "bg-success/10 text-success border-success/20",
  },
  recusado: {
    label: "Recusado",
    icon: XCircle,
    style: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

interface FeriasCardProps {
  item: FeriasItem;
  index: number;
  onAprovar: (id: number) => void;
  onRecusar: (id: number) => void;
}

const FeriasCard = ({ item, index, onAprovar, onRecusar }: FeriasCardProps) => {
  const config = statusConfig[item.status];
  const startDate = new Date(item.dataInicio).toLocaleDateString("pt-BR");
  const endDate = new Date(item.dataFim).toLocaleDateString("pt-BR");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
      className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {item.colaborador.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground">{item.colaborador}</h3>
            <p className="text-sm text-muted-foreground">{item.departamento}</p>
          </div>
        </div>
        <Badge className={cn("text-xs", config.style)}>
          <config.icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Calendar className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">{startDate} - {endDate}</p>
            <p className="text-xs text-muted-foreground">{item.diasSolicitados} dias solicitados</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Saldo disponível:</span>
          <span className="font-medium text-foreground">{item.saldoDias} dias</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Solicitado em:</span>
          <span className="font-medium text-foreground">
            {new Date(item.dataSolicitacao).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>

      {item.status === "pendente" && (
        <div className="mt-4 pt-4 border-t border-border flex gap-2">
          <Button 
            size="sm" 
            className="flex-1 gradient-primary"
            onClick={() => onAprovar(item.id)}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Aprovar
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => onRecusar(item.id)}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Recusar
          </Button>
        </div>
      )}
    </motion.div>
  );
};

const Ferias = () => {
  const [ferias, setFerias] = useState<FeriasItem[]>(initialFerias);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("solicitacoes");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSolicitacao, setNewSolicitacao] = useState({
    colaborador: "",
    departamento: "",
    dataInicio: "",
    dataFim: "",
  });

  const handleAprovar = (id: number) => {
    setFerias(prev => prev.map(f => 
      f.id === id ? { ...f, status: "aprovado" as const } : f
    ));
    const item = ferias.find(f => f.id === id);
    toast.success(`Férias aprovadas para ${item?.colaborador}`);
  };

  const handleRecusar = (id: number) => {
    setFerias(prev => prev.map(f => 
      f.id === id ? { ...f, status: "recusado" as const } : f
    ));
    const item = ferias.find(f => f.id === id);
    toast.error(`Férias recusadas para ${item?.colaborador}`);
  };

  const handleNovaSolicitacao = () => {
    if (!newSolicitacao.colaborador || !newSolicitacao.dataInicio || !newSolicitacao.dataFim) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const dataInicio = new Date(newSolicitacao.dataInicio);
    const dataFim = new Date(newSolicitacao.dataFim);
    const diasSolicitados = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const novaSolicitacao: FeriasItem = {
      id: Math.max(...ferias.map(f => f.id)) + 1,
      colaborador: newSolicitacao.colaborador,
      departamento: newSolicitacao.departamento || "Não informado",
      dataInicio: newSolicitacao.dataInicio,
      dataFim: newSolicitacao.dataFim,
      diasSolicitados,
      saldoDias: 30,
      status: "pendente",
      dataSolicitacao: new Date().toISOString().split("T")[0],
    };

    setFerias(prev => [novaSolicitacao, ...prev]);
    setNewSolicitacao({ colaborador: "", departamento: "", dataInicio: "", dataFim: "" });
    setIsModalOpen(false);
    toast.success("Solicitação de férias criada com sucesso!");
  };

  const filteredFerias = ferias.filter(
    (f) => statusFilter === "all" || f.status === statusFilter
  );

  const stats = {
    pendentes: ferias.filter((f) => f.status === "pendente").length,
    aprovados: ferias.filter((f) => f.status === "aprovado").length,
    emFerias: 3,
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
          <h1 className="text-2xl font-bold text-foreground">Gestão de Férias</h1>
          <p className="text-muted-foreground">Solicitações e aprovações</p>
        </div>
        <Button className="gradient-primary shadow-glow" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.pendentes}</p>
            <p className="text-sm text-muted-foreground">Pendentes de Aprovação</p>
          </div>
        </div>
        <div className="bg-success/5 border border-success/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-success/10">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.aprovados}</p>
            <p className="text-sm text-muted-foreground">Aprovados (Mês)</p>
          </div>
        </div>
        <div className="bg-info/5 border border-info/20 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-info/10">
            <Plane className="w-6 h-6 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.emFerias}</p>
            <p className="text-sm text-muted-foreground">Em Férias Agora</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
            <TabsTrigger value="saldos">Saldos</TabsTrigger>
          </TabsList>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="recusado">Recusado</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        <TabsContent value="solicitacoes" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFerias.map((item, index) => (
              <FeriasCard 
                key={item.id} 
                item={item} 
                index={index}
                onAprovar={handleAprovar}
                onRecusar={handleRecusar}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendario">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-8 shadow-sm text-center"
          >
            <Sun className="w-16 h-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Calendário de Férias</h3>
            <p className="text-muted-foreground">
              Visualização em calendário será implementada em breve.
            </p>
          </motion.div>
        </TabsContent>

        <TabsContent value="saldos">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-8 shadow-sm text-center"
          >
            <Calendar className="w-16 h-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Saldos de Férias</h3>
            <p className="text-muted-foreground">
              Consulta de saldos por colaborador será implementada em breve.
            </p>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Modal Nova Solicitação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Férias</DialogTitle>
            <DialogDescription>
              Preencha os dados para solicitar férias
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="colaborador">Nome do Colaborador *</Label>
              <Input
                id="colaborador"
                placeholder="Nome completo"
                value={newSolicitacao.colaborador}
                onChange={(e) => setNewSolicitacao(prev => ({ ...prev, colaborador: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                placeholder="Ex: Tecnologia"
                value={newSolicitacao.departamento}
                onChange={(e) => setNewSolicitacao(prev => ({ ...prev, departamento: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data Início *</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={newSolicitacao.dataInicio}
                  onChange={(e) => setNewSolicitacao(prev => ({ ...prev, dataInicio: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dataFim">Data Fim *</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={newSolicitacao.dataFim}
                  onChange={(e) => setNewSolicitacao(prev => ({ ...prev, dataFim: e.target.value }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleNovaSolicitacao} className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Criar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ferias;
