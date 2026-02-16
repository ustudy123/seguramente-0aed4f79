import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FeriasCalendario } from "@/components/ferias/FeriasCalendario";
import { FeriasSaldos } from "@/components/ferias/FeriasSaldos";
import { FeriasInteligencia } from "@/components/ferias/FeriasInteligencia";
import { FeriasCultura } from "@/components/ferias/FeriasCultura";
import { useINR } from "@/hooks/useINR";
import { calcularPeriodoFerias } from "@/lib/feriasPeriodo";
import { 
  Calendar, 
  Plus, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Sun,
  Plane,
  ChevronsUpDown,
  Check,
  DollarSign,
  Info,
  Banknote,
  AlertTriangle,
  FileText,
  Send,
  TrendingUp,
  Brain,
  Heart,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useAuth } from "@/hooks/useAuth";
import { validarFracionamentoCLT } from "@/lib/feriasPeriodo";
import { gerarAvisoFeriasPDF, gerarReciboFeriasPDF } from "@/lib/feriasDocumentos";
import { supabase } from "@/integrations/supabase/client";

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
  abonoPecuniario: boolean;
  diasAbono: number;
  salarioBase?: number;
}

const initialFerias: FeriasItem[] = [
  {
    id: 1, colaborador: "Ana Carolina Silva", departamento: "Recursos Humanos",
    dataInicio: "2025-02-15", dataFim: "2025-03-01", diasSolicitados: 15,
    saldoDias: 30, status: "pendente", dataSolicitacao: "2025-01-10",
    abonoPecuniario: true, diasAbono: 10, salarioBase: 5500,
  },
  {
    id: 2, colaborador: "Carlos Eduardo Mendes", departamento: "Tecnologia",
    dataInicio: "2025-01-20", dataFim: "2025-02-04", diasSolicitados: 15,
    saldoDias: 15, status: "aprovado", dataSolicitacao: "2024-12-15",
    abonoPecuniario: false, diasAbono: 0, salarioBase: 7200,
  },
  {
    id: 3, colaborador: "Paula Santos Oliveira", departamento: "Projetos",
    dataInicio: "2025-03-10", dataFim: "2025-03-25", diasSolicitados: 15,
    saldoDias: 30, status: "pendente", dataSolicitacao: "2025-01-15",
    abonoPecuniario: false, diasAbono: 0, salarioBase: 4800,
  },
  {
    id: 4, colaborador: "João Pedro Almeida", departamento: "Financeiro",
    dataInicio: "2025-02-01", dataFim: "2025-02-10", diasSolicitados: 10,
    saldoDias: 20, status: "recusado", dataSolicitacao: "2025-01-05",
    abonoPecuniario: false, diasAbono: 0, salarioBase: 6000,
  },
  {
    id: 5, colaborador: "Maria Fernanda Costa", departamento: "Design",
    dataInicio: "2025-04-01", dataFim: "2025-04-20", diasSolicitados: 20,
    saldoDias: 30, status: "pendente", dataSolicitacao: "2025-01-16",
    abonoPecuniario: true, diasAbono: 10, salarioBase: 5000,
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

        {item.abonoPecuniario && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <Banknote className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-700">Abono Pecuniário</p>
              <p className="text-xs text-emerald-600/80">{item.diasAbono} dias vendidos</p>
            </div>
          </div>
        )}

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
  const [comboOpen, setComboOpen] = useState(false);
  const [newSolicitacao, setNewSolicitacao] = useState({
    colaborador: "",
    departamento: "",
    dataInicio: "",
    dataFim: "",
    abonoPecuniario: false,
    diasAbono: 10,
    salarioBase: 0,
  });
  const { colaboradores, isLoading: loadingColabs } = useColaboradores();

  const { criarPeriodo, criarFolhaItem, useFolhaPeriodos } = useFinanceiro();
  const { data: periodos } = useFolhaPeriodos();
  const { tenantId, user, profile } = useAuth();

  // ========== INR™ ==========
  const { ranking: inrRanking, criticos: inrCriticos, altos: inrAltos } = useINR(
    colaboradores,
    ferias,
    [], // humores — populated when real data is available
    []  // acoes — populated when real data is available
  );

  const colaboradoresPorSetor = useMemo(() => {
    const map: Record<string, { total: number; vencidos: number; alerta: number }> = {};
    colaboradores.forEach((c) => {
      const dept = c.departamento || "Sem Departamento";
      if (!map[dept]) map[dept] = { total: 0, vencidos: 0, alerta: 0 };
      map[dept].total++;
      const diasUsados = ferias
        .filter((f) => f.colaborador === c.nome_completo && f.status === "aprovado")
        .reduce((sum, f) => sum + f.diasSolicitados, 0);
      const periodo = calcularPeriodoFerias(c.data_admissao || null, diasUsados);
      if (periodo?.statusVencimento === "vencido") map[dept].vencidos++;
      else if (periodo?.statusVencimento === "alerta") map[dept].alerta++;
    });
    return map;
  }, [colaboradores, ferias]);

  const handleCriarAcaoPreventiva = (colab: any) => {
    toast.success(
      `Ação preventiva criada: "Antecipar férias — ${colab.nome}" no Plano de Ação`,
      { duration: 5000 }
    );
  };

  // ========== PROVISÃO FINANCEIRA ==========
  const provisaoTotal = useMemo(() => {
    return colaboradores.reduce((sum, c) => {
      // Each active employee accrues 30 days + 1/3 per year
      // Simplified: assume full 30-day provision per employee
      const salario = ferias.find(f => f.colaborador === c.nome_completo)?.salarioBase || 0;
      return sum + salario + (salario / 3);
    }, 0);
  }, [colaboradores, ferias]);

  // ========== SOBREPOSIÇÃO ==========
  const verificarSobreposicao = (item: FeriasItem): string[] => {
    const inicio = new Date(item.dataInicio);
    const fim = new Date(item.dataFim);
    const sobrepostos = ferias.filter(f => 
      f.id !== item.id &&
      f.departamento === item.departamento &&
      f.status === "aprovado" &&
      new Date(f.dataInicio) <= fim &&
      new Date(f.dataFim) >= inicio
    );
    return sobrepostos.map(f => f.colaborador);
  };

  // Calcula 2 dias úteis antes de uma data
  const calcularVencimento2DiasUteis = (dataInicio: string): string => {
    const date = new Date(dataInicio + "T12:00:00");
    let diasUteis = 0;
    while (diasUteis < 2) {
      date.setDate(date.getDate() - 1);
      const dow = date.getDay();
      if (dow !== 0 && dow !== 6) diasUteis++;
    }
    return date.toISOString().split("T")[0];
  };

  // ========== GERAR DOCUMENTOS + ARQUIVAR ==========
  const gerarDocumentosFerias = async (item: FeriasItem) => {
    if (!tenantId || !user) return;
    try {
      const docData = {
        colaboradorNome: item.colaborador,
        colaboradorCpf: undefined,
        departamento: item.departamento,
        dataInicio: item.dataInicio,
        dataFim: item.dataFim,
        diasSolicitados: item.diasSolicitados,
        abonoPecuniario: item.abonoPecuniario,
        diasAbono: item.diasAbono,
        salarioBase: item.salarioBase || 0,
      };

      // Gerar Aviso de Férias PDF
      const avisoPdf = gerarAvisoFeriasPDF(docData);
      const avisoBlob = avisoPdf.output("blob");
      const avisoFileName = `${tenantId}/ferias/${Date.now()}_aviso_ferias_${item.colaborador.replace(/\s/g, "_")}.pdf`;

      await supabase.storage
        .from("documentos")
        .upload(avisoFileName, avisoBlob, { contentType: "application/pdf", upsert: false });

      // Gerar Recibo de Férias PDF
      const reciboPdf = gerarReciboFeriasPDF(docData);
      const reciboBlob = reciboPdf.output("blob");
      const reciboFileName = `${tenantId}/ferias/${Date.now()}_recibo_ferias_${item.colaborador.replace(/\s/g, "_")}.pdf`;

      await supabase.storage
        .from("documentos")
        .upload(reciboFileName, reciboBlob, { contentType: "application/pdf", upsert: false });

      // Arquivar no módulo de documentos
      const docsToArchive = [
        { path: avisoFileName, nome: `Aviso de Férias - ${new Date(item.dataInicio).toLocaleDateString("pt-BR")}`, tipo: "Aviso de Férias" },
        { path: reciboFileName, nome: `Recibo de Férias - ${new Date(item.dataInicio).toLocaleDateString("pt-BR")}`, tipo: "Recibo de Férias" },
      ];

      for (const doc of docsToArchive) {
        await supabase.from("documentos" as never).insert({
          tenant_id: tenantId,
          colaborador_nome: item.colaborador,
          colaborador_cpf: null,
          nome_arquivo: doc.path,
          nome_original: doc.nome + ".pdf",
          tipo: doc.tipo,
          tamanho: 0,
          mime_type: "application/pdf",
          storage_path: doc.path,
          status: "valido",
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
        } as never);
      }

      toast.success("Documentos de férias gerados e arquivados!");
      return avisoFileName;
    } catch (err) {
      console.error("Erro ao gerar documentos:", err);
      toast.error("Erro ao gerar documentos de férias");
      return null;
    }
  };

  // ========== ASSINATURA DIGITAL ==========
  const criarLinkAssinatura = async (item: FeriasItem, documentoPath?: string) => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from("ferias_assinatura_links" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_nome: item.colaborador,
          departamento: item.departamento,
          data_inicio_ferias: item.dataInicio,
          data_fim_ferias: item.dataFim,
          dias_ferias: item.diasSolicitados,
          abono_pecuniario: item.abonoPecuniario,
          dias_abono: item.diasAbono,
          salario_base: item.salarioBase || 0,
          documento_storage_path: documentoPath || null,
        } as never)
        .select("token")
        .single();

      if (error) throw error;

      const token = (data as any)?.token;
      if (token) {
        const url = `https://diayjpsrcerycycyaxst.supabase.co/functions/v1/ferias-assinatura?token=${token}`;
        await navigator.clipboard.writeText(url);
        toast.success("Link de assinatura copiado! Envie ao colaborador.", { duration: 5000 });
      }
    } catch (err) {
      console.error("Erro ao criar link de assinatura:", err);
    }
  };

  // ========== REGISTRO FINANCEIRO ==========
  const gerarRegistroFinanceiro = async (item: FeriasItem) => {
    if (!tenantId) return;
    try {
      const competencia = item.dataInicio.slice(0, 7);
      let periodoId: string | undefined;
      const periodoExistente = periodos?.find(p => p.competencia === competencia);
      if (periodoExistente) {
        periodoId = periodoExistente.id;
      } else {
        const novoPeriodo = await criarPeriodo({ competencia, observacoes: "Criado automaticamente - férias" });
        periodoId = (novoPeriodo as any)?.id;
      }
      if (!periodoId) return;

      const salarioBase = item.salarioBase || 0;
      const salarioDia = salarioBase / 30;
      const valorFerias = salarioDia * item.diasSolicitados;
      const tercoConstitucional = valorFerias / 3;
      const valorAbono = item.abonoPecuniario ? salarioDia * item.diasAbono : 0;
      const totalBruto = valorFerias + tercoConstitucional + valorAbono;
      const vencimento = calcularVencimento2DiasUteis(item.dataInicio);

      await criarFolhaItem({
        periodo_id: periodoId,
        colaborador_id: item.id.toString(),
        colaborador_nome: item.colaborador,
        colaborador_cpf: null,
        cargo: null,
        departamento: item.departamento,
        salario_base: salarioBase,
        total_proventos: totalBruto,
        total_descontos: 0,
        total_liquido: totalBruto,
        status: "pendente",
        observacoes: `Férias ${item.diasSolicitados}d (${new Date(item.dataInicio).toLocaleDateString("pt-BR")} a ${new Date(item.dataFim).toLocaleDateString("pt-BR")})${item.abonoPecuniario ? ` + Abono ${item.diasAbono}d` : ""} | Vencimento: ${new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR")}`,
      });

      toast.success(`Registro financeiro gerado — vencimento ${new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR")}`);
    } catch (err) {
      console.error("Erro ao gerar registro financeiro:", err);
      toast.error("Erro ao gerar registro financeiro");
    }
  };

  // ========== APROVAR COM TODOS OS FLUXOS ==========
  const handleAprovar = async (id: number) => {
    const item = ferias.find(f => f.id === id);
    if (!item) return;

    // 1. Verificar sobreposição
    const sobrepostos = verificarSobreposicao(item);
    if (sobrepostos.length > 0) {
      toast.warning(
        `⚠ Sobreposição no setor "${item.departamento}": ${sobrepostos.join(", ")} já está(ão) de férias no mesmo período.`,
        { duration: 6000 }
      );
    }

    // 2. Aprovar
    setFerias(prev => prev.map(f => 
      f.id === id ? { ...f, status: "aprovado" as const } : f
    ));
    toast.success(`Férias aprovadas para ${item.colaborador}`);

    // 3. Gerar documentos PDF + arquivar
    const avisoPath = await gerarDocumentosFerias(item);

    // 4. Gerar registro financeiro
    await gerarRegistroFinanceiro({ ...item, status: "aprovado" });

    // 5. Criar link de assinatura
    await criarLinkAssinatura(item, avisoPath || undefined);
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

    if (newSolicitacao.abonoPecuniario && newSolicitacao.diasAbono > 10) {
      toast.error("O abono pecuniário não pode exceder 10 dias (1/3 das férias)");
      return;
    }

    const dataInicio = new Date(newSolicitacao.dataInicio);
    const dataFim = new Date(newSolicitacao.dataFim);
    const diasSolicitados = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Validação de fracionamento CLT
    const fracionamentosAnteriores = ferias
      .filter((f) => f.colaborador === newSolicitacao.colaborador && f.status !== "recusado")
      .map((f) => f.diasSolicitados);

    const validacao = validarFracionamentoCLT(diasSolicitados, fracionamentosAnteriores);
    if (!validacao.valido) {
      toast.error(validacao.erro || "Fracionamento inválido");
      return;
    }

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
      abonoPecuniario: newSolicitacao.abonoPecuniario,
      diasAbono: newSolicitacao.abonoPecuniario ? newSolicitacao.diasAbono : 0,
      salarioBase: newSolicitacao.salarioBase,
    };

    setFerias(prev => [novaSolicitacao, ...prev]);
    setNewSolicitacao({ colaborador: "", departamento: "", dataInicio: "", dataFim: "", abonoPecuniario: false, diasAbono: 10, salarioBase: 0 });
    setIsModalOpen(false);
    toast.success(
      newSolicitacao.abonoPecuniario
        ? `Solicitação com abono pecuniário de ${newSolicitacao.diasAbono} dias criada!`
        : "Solicitação de férias criada com sucesso!"
    );
  };

  const filteredFerias = ferias.filter(
    (f) => statusFilter === "all" || f.status === statusFilter
  );

  const [statsDetail, setStatsDetail] = useState<{ title: string; items: FeriasItem[] } | null>(null);

  const stats = {
    pendentes: ferias.filter((f) => f.status === "pendente").length,
    aprovados: ferias.filter((f) => f.status === "aprovado").length,
    emFerias: 3,
    comAbono: ferias.filter((f) => f.abonoPecuniario && f.status !== "recusado").length,
  };

  const handleStatClick = (type: string) => {
    let title = "";
    let items: FeriasItem[] = [];
    switch (type) {
      case "pendentes":
        title = "Solicitações Pendentes";
        items = ferias.filter((f) => f.status === "pendente");
        break;
      case "aprovados":
        title = "Férias Aprovadas";
        items = ferias.filter((f) => f.status === "aprovado");
        break;
      case "emFerias":
        title = "Colaboradores em Férias";
        items = ferias.filter((f) => {
          if (f.status !== "aprovado") return false;
          const hoje = new Date();
          return new Date(f.dataInicio) <= hoje && new Date(f.dataFim) >= hoje;
        });
        break;
      case "comAbono":
        title = "Férias com Abono Pecuniário";
        items = ferias.filter((f) => f.abonoPecuniario && f.status !== "recusado");
        break;
      case "provisao":
        title = "Provisão Estimada por Colaborador";
        items = ferias.filter((f) => f.salarioBase && f.salarioBase > 0);
        break;
    }
    setStatsDetail({ title, items });
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
        className="grid grid-cols-1 md:grid-cols-5 gap-4"
      >
        <div
          onClick={() => handleStatClick("pendentes")}
          className="bg-warning/5 border border-warning/20 rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-warning/40 transition-all"
        >
          <div className="p-3 rounded-xl bg-warning/10">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.pendentes}</p>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </div>
        </div>
        <div
          onClick={() => handleStatClick("aprovados")}
          className="bg-success/5 border border-success/20 rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-success/40 transition-all"
        >
          <div className="p-3 rounded-xl bg-success/10">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.aprovados}</p>
            <p className="text-sm text-muted-foreground">Aprovados</p>
          </div>
        </div>
        <div
          onClick={() => handleStatClick("emFerias")}
          className="bg-info/5 border border-info/20 rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-info/40 transition-all"
        >
          <div className="p-3 rounded-xl bg-info/10">
            <Plane className="w-6 h-6 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.emFerias}</p>
            <p className="text-sm text-muted-foreground">Em Férias</p>
          </div>
        </div>
        <div
          onClick={() => handleStatClick("comAbono")}
          className="bg-accent/50 border border-accent rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="p-3 rounded-xl bg-primary/10">
            <Banknote className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.comAbono}</p>
            <p className="text-sm text-muted-foreground">Com Abono</p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={() => handleStatClick("provisao")}
              className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-destructive/40 transition-all"
            >
              <div className="p-3 rounded-xl bg-destructive/10">
                <TrendingUp className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {provisaoTotal > 0 ? `R$ ${(provisaoTotal / 1000).toFixed(0)}k` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Provisão Estimada</p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
            Passivo total estimado de férias (salários + 1/3 constitucional) de todos os colaboradores ativos.
          </TooltipContent>
        </Tooltip>
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
            <TabsTrigger value="inteligencia" className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              Inteligência
              {inrCriticos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-destructive text-destructive-foreground rounded-full">
                  {inrCriticos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cultura" className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              Cultura
            </TabsTrigger>
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
          <FeriasCalendario
            ferias={ferias}
            onNewSolicitacao={(date) => {
              setNewSolicitacao((prev) => ({ ...prev, dataInicio: date }));
              setIsModalOpen(true);
            }}
          />
        </TabsContent>

        <TabsContent value="saldos">
          <FeriasSaldos ferias={ferias} />
        </TabsContent>

        <TabsContent value="inteligencia">
          <FeriasInteligencia
            ranking={inrRanking}
            criticos={inrCriticos}
            altos={inrAltos}
            onCriarAcaoPreventiva={handleCriarAcaoPreventiva}
            colaboradoresPorSetor={colaboradoresPorSetor}
          />
        </TabsContent>
        <TabsContent value="cultura">
          <FeriasCultura ferias={ferias} />
        </TabsContent>
      </Tabs>

      {/* Modal Nova Solicitação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Férias</DialogTitle>
            <DialogDescription>
              Preencha os dados para solicitar férias
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {newSolicitacao.colaborador || "Selecione o colaborador..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar colaborador..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {colaboradores.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.nome_completo}
                            onSelect={() => {
                              setNewSolicitacao(prev => ({
                                ...prev,
                                colaborador: c.nome_completo,
                                departamento: c.departamento || "",
                              }));
                              setComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", newSolicitacao.colaborador === c.nome_completo ? "opacity-100" : "opacity-0")} />
                            <div>
                              <p className="text-sm">{c.nome_completo}</p>
                              {c.departamento && <p className="text-xs text-muted-foreground">{c.departamento}</p>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                placeholder="Preenchido automaticamente"
                value={newSolicitacao.departamento}
                readOnly
                className="bg-muted/50"
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

            {/* Abono Pecuniário Section */}
            <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <Label htmlFor="abono" className="text-sm font-medium cursor-pointer">
                    Abono Pecuniário (Venda de Férias)
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-xs">
                      <p className="font-semibold mb-1">Art. 143, CLT</p>
                      <p>O empregado pode converter até 1/3 do período de férias (10 dias) em abono pecuniário. O pedido deve ser feito até 15 dias antes do término do período aquisitivo.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="abono"
                  checked={newSolicitacao.abonoPecuniario}
                  onCheckedChange={(checked) => setNewSolicitacao(prev => ({ ...prev, abonoPecuniario: checked }))}
                />
              </div>

              {newSolicitacao.abonoPecuniario && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="diasAbono" className="text-xs">Dias a vender (máx. 10)</Label>
                      <Input
                        id="diasAbono"
                        type="number"
                        min={1}
                        max={10}
                        value={newSolicitacao.diasAbono}
                        onChange={(e) => setNewSolicitacao(prev => ({
                          ...prev,
                          diasAbono: Math.min(10, Math.max(1, parseInt(e.target.value) || 0))
                        }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="salarioBase" className="text-xs">Salário Base (R$)</Label>
                      <Input
                        id="salarioBase"
                        type="number"
                        min={0}
                        step={100}
                        placeholder="0,00"
                        value={newSolicitacao.salarioBase || ""}
                        onChange={(e) => setNewSolicitacao(prev => ({ ...prev, salarioBase: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  {/* Financial simulation */}
                  {newSolicitacao.salarioBase > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        Simulação Financeira
                      </p>
                      {(() => {
                        const salarioDia = newSolicitacao.salarioBase / 30;
                        const valorFerias = newSolicitacao.salarioBase;
                        const tercoConstitucional = valorFerias / 3;
                        const valorAbono = salarioDia * newSolicitacao.diasAbono;
                        const total = valorFerias + tercoConstitucional + valorAbono;
                        return (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Férias (30 dias)</span>
                              <span className="font-medium">R$ {valorFerias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">1/3 Constitucional</span>
                              <span className="font-medium">R$ {tercoConstitucional.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-emerald-700">
                              <span>Abono ({newSolicitacao.diasAbono} dias)</span>
                              <span className="font-semibold">R$ {valorAbono.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="border-t border-emerald-500/20 pt-1 flex justify-between font-bold text-foreground">
                              <span>Total Bruto</span>
                              <span>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              ⚠ O abono pecuniário não integra salário para fins de FGTS e INSS.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <p>• Direito do empregado (Art. 143, CLT)</p>
                    <p>• Máximo 1/3 das férias (10 dias)</p>
                    <p>• Solicitar até 15 dias antes do fim do período aquisitivo</p>
                    <p>• Pagamento junto com as férias (até 2 dias antes)</p>
                  </div>
                </motion.div>
              )}
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

      {/* Stats Detail Dialog */}
      <Dialog open={!!statsDetail} onOpenChange={(open) => !open && setStatsDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{statsDetail?.title}</DialogTitle>
            <DialogDescription>
              {statsDetail?.items.length === 0
                ? "Nenhum registro encontrado nesta categoria."
                : `${statsDetail?.items.length} registro(s)`}
            </DialogDescription>
          </DialogHeader>

          {statsDetail?.title === "Provisão Estimada por Colaborador" ? (
            <div className="space-y-2">
              {colaboradores.map((c) => {
                const sal = ferias.find((f) => f.colaborador === c.nome_completo)?.salarioBase || 0;
                if (!sal) return null;
                const prov = sal + sal / 3;
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {c.nome_completo.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{c.departamento || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">R$ {prov.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-muted-foreground">Base: R$ {sal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">Total Provisão</span>
                <span className="text-lg font-bold text-foreground">
                  R$ {provisaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {statsDetail?.items.map((item) => {
                const config = statusConfig[item.status];
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {item.colaborador.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.colaborador}</p>
                        <p className="text-xs text-muted-foreground">{item.departamento}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge className={cn("text-[10px]", config.style)}>
                        <config.icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.dataInicio).toLocaleDateString("pt-BR")} — {new Date(item.dataFim).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.diasSolicitados} dias</p>
                      {item.abonoPecuniario && (
                        <p className="text-[10px] text-success">+ Abono {item.diasAbono}d</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ferias;
