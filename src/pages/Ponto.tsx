import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, Calendar, Download, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, LogIn, LogOut, Coffee, Utensils,
  History, FileText, Shield, UserCheck, Wallet, BarChart3,
  Bell, Lock, FileDown, Settings, HardDrive, FileSpreadsheet, Scale,
  MapPin, Loader2, Link2, HelpCircle, Search, Paperclip, Eye, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { GuiaRapidoPonto } from "@/components/ponto/GuiaRapidoPonto";
import { AnexosAjusteModal } from "@/components/ponto/AnexosAjusteModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AnexoUpload } from "@/components/ouvidoria/AnexoUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePonto, TIPO_MARCACAO_LABELS, STATUS_PONTO_CONFIG, type PontoDiario, type PontoAjuste } from "@/hooks/usePonto";
import { useColaboradores, type Colaborador } from "@/hooks/useColaboradores";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { PontoSelfieCapture } from "@/components/ponto/PontoSelfieCapture";
import { supabase } from "@/integrations/supabase/client";

// New tab components
import { PontoDashboardTab } from "@/components/ponto/PontoDashboardTab";
import { PontoEscalasTab } from "@/components/ponto/PontoEscalasTab";
import { PontoBancoHorasTab } from "@/components/ponto/PontoBancoHorasTab";
import { PontoFechamentoTab } from "@/components/ponto/PontoFechamentoTab";
import { PontoAlertasTab } from "@/components/ponto/PontoAlertasTab";
import { PontoRelatoriosTab } from "@/components/ponto/PontoRelatoriosTab";
import { PontoRepCTab } from "@/components/ponto/PontoRepCTab";
import { PontoFolhaTab } from "@/components/ponto/PontoFolhaTab";
import { PontoCCTTab } from "@/components/ponto/PontoCCTTab";
import { PontoLinksTab } from "@/components/ponto/PontoLinksTab";
import { PontoConfigTab } from "@/components/ponto/PontoConfigTab";

const Ponto = () => {
  const { profile } = useAuth();
  // Ponto eletrônico é exclusivo para vínculos CLT — exclui PJ/Pró-labore/Terceiros.
  const { colaboradores } = useColaboradores({ excluirPJ: true });
  const {
    usePontoDiario, useMarcacoesHoje, useAjustesPendentes,
    registrarPonto, registrandoPonto,
    solicitarAjuste, solicitandoAjuste,
    processarAjuste, processandoAjuste,
  } = usePonto();

  const geo = useGeolocation();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Modals
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [anexosModalAjuste, setAnexosModalAjuste] = useState<PontoAjuste | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [tipoMarcacao, setTipoMarcacao] = useState<"entrada" | "saida_almoco" | "retorno_almoco" | "saida">("entrada");
  
  // Selfie state
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Ajuste form
  const [ajusteColaborador, setAjusteColaborador] = useState<string>("");
  const [ajusteData, setAjusteData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ajusteTipo, setAjusteTipo] = useState<"inclusao" | "correcao" | "justificativa">("inclusao");
  const [ajusteMarcacao, setAjusteMarcacao] = useState<"entrada" | "saida_almoco" | "retorno_almoco" | "saida">("entrada");
  const [ajusteHora, setAjusteHora] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteAnexos, setAjusteAnexos] = useState<File[]>([]);

  // Queries
  const { data: pontosDiarios = [], isLoading: loadingPontos } = usePontoDiario(selectedDate);
  const { data: marcacoesHoje = [] } = useMarcacoesHoje();
  
  // Determine which markings the selected collaborator already has today
  const marcacoesColaboradorHoje = marcacoesHoje.filter(
    (m: any) => selectedColaborador && m.colaborador_cpf === selectedColaborador.cpf
  );
  const tiposJaRegistrados = marcacoesColaboradorHoje.map((m: any) => m.tipo_marcacao);
  
  // Auto-detect next tipo_marcacao when collaborator changes
  useEffect(() => {
    if (!selectedColaborador) return;
    const ordem: Array<"entrada" | "saida_almoco" | "retorno_almoco" | "saida"> = ["entrada", "saida_almoco", "retorno_almoco", "saida"];
    const proximo = ordem.find((t) => !tiposJaRegistrados.includes(t));
    if (proximo) setTipoMarcacao(proximo);
  }, [selectedColaborador, tiposJaRegistrados.join(",")]);
  const { data: ajustesPendentesRaw = [] } = useAjustesPendentes();
  // Filtra ajustes pela empresa ativa cruzando pelo CPF dos colaboradores carregados
  const ajustesPendentes = useMemo(() => {
    const cpfsEmpresa = new Set(
      colaboradores.map((c) => (c.cpf || "").replace(/\D/g, "")).filter(Boolean)
    );
    if (cpfsEmpresa.size === 0) return [];
    return ajustesPendentesRaw.filter((a: any) =>
      cpfsEmpresa.has((a.colaborador_cpf || "").replace(/\D/g, ""))
    );
  }, [ajustesPendentesRaw, colaboradores]);

  // Auto-capture geolocation when modal opens
  useEffect(() => {
    if (showRegistrarModal) {
      geo.capturarLocalizacao();
    } else {
      geo.limpar();
      setSelfieFile(null);
      setSelfiePreview(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRegistrarModal]);

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  const filteredPontos = pontosDiarios.filter((ponto) => {
    const matchesStatus = statusFilter === "all" || ponto.status === statusFilter;
    const matchesSearch = ponto.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         ponto.colaborador_cpf.includes(searchTerm);
    
    // Para filtrar por departamento, precisamos cruzar com a lista de colaboradores
    const colab = colaboradores.find(c => c.id === ponto.colaborador_id);
    const matchesDept = deptFilter === "all" || (colab && colab.departamento === deptFilter);

    return matchesStatus && matchesSearch && matchesDept;
  });

  // Extrair lista única de departamentos dos colaboradores ativos
  const departamentos = Array.from(new Set(colaboradores.map(c => c.departamento).filter(Boolean))) as string[];

  const handleRegistrarPonto = async () => {
    if (!selectedColaborador) return;
    try {
      // Upload selfie if captured
      let selfieUrl: string | null = null;
      let selfieNome: string | null = null;
      if (selfieFile) {
        const fileName = `${selectedColaborador.cpf}/${format(new Date(), "yyyy-MM-dd")}_${tipoMarcacao}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("ponto-selfies")
          .upload(fileName, selfieFile, { contentType: "image/jpeg" });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from("ponto-selfies").getPublicUrl(uploadData.path);
          selfieUrl = urlData.publicUrl;
          selfieNome = selfieFile.name;
        }
      }

      await registrarPonto({
        colaboradorId: selectedColaborador.id,
        colaboradorNome: selectedColaborador.nome_completo,
        colaboradorCpf: selectedColaborador.cpf,
        tipoMarcacao,
        latitude: geo.latitude ?? undefined,
        longitude: geo.longitude ?? undefined,
        enderecoGeolocalizacao: geo.endereco ?? undefined,
        selfieUrl: selfieUrl ?? undefined,
        selfieNome: selfieNome ?? undefined,
      });
      setShowRegistrarModal(false);
      setSelectedColaborador(null);
    } catch {}
  };

  const resetAjusteForm = () => {
    setAjusteColaborador("");
    setAjusteData(format(new Date(), "yyyy-MM-dd"));
    setAjusteTipo("inclusao");
    setAjusteMarcacao("entrada");
    setAjusteHora("");
    setAjusteMotivo("");
    setAjusteAnexos([]);
  };

  const handleCloseAjusteModal = (open: boolean) => {
    setShowAjusteModal(open);
    if (!open) resetAjusteForm();
  };

  const handleSolicitarAjuste = async () => {
    const colab = colaboradores.find(c => c.id === ajusteColaborador);
    if (!colab) return;
    try {
      await solicitarAjuste({
        colaboradorId: colab.id,
        colaboradorNome: colab.nome_completo,
        colaboradorCpf: colab.cpf,
        dataReferencia: ajusteData,
        tipoAjuste: ajusteTipo,
        tipoMarcacao: ajusteTipo !== "justificativa" ? ajusteMarcacao : undefined,
        horaSolicitada: ajusteTipo !== "justificativa" ? ajusteHora : undefined,
        motivo: ajusteMotivo,
        anexos: ajusteAnexos,
      });
      setShowAjusteModal(false);
      resetAjusteForm();
    } catch {}
  };

  const handleProcessarAjuste = async (ajusteId: string, aprovado: boolean, observacao?: string) => {
    await processarAjuste({ ajusteId, aprovado, observacao });
  };

  const formatHora = (hora: string | null) => hora ? hora.substring(0, 5) : "--:--";
  const formatInterval = (interval: string | null) => {
    if (!interval) return "0h 00min";
    const parts = interval.split(":");
    return parts.length >= 2 ? `${parts[0]}h ${parts[1]}min` : interval;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 sm:w-7 sm:h-7 text-primary" /> Controle de Ponto
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Registro fiel e auditável da jornada
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          <Button
            id="btn-guia-rapido-ponto"
            variant="outline"
            size="sm"
            onClick={() => setShowGuia(true)}
            className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
          >
            <HelpCircle className="h-4 w-4" />
            Guia Rápido
          </Button>
          <Button id="btn-solicitar-ajuste" size="sm" onClick={() => setShowAjusteModal(true)}>
            <FileText className="h-4 w-4 mr-2" /> Solicitar Ajuste
          </Button>
        </div>
      </motion.div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max min-w-full h-auto gap-0.5 p-1">
            <TabsTrigger id="tab-ponto-dashboard" value="dashboard" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Dash</span>
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-registros" value="registros" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Clock className="h-3.5 w-3.5" /> Registros
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-ajustes" value="ajustes" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <FileText className="h-3.5 w-3.5" /> Ajustes
              {ajustesPendentes.filter(a => a.status === "pendente").length > 0 && (
                <Badge variant="destructive" className="ml-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {ajustesPendentes.filter(a => a.status === "pendente").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-escalas" value="escalas" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Settings className="h-3.5 w-3.5" /> Escalas
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-banco" value="banco" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Wallet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Banco Horas</span><span className="sm:hidden">BH</span>
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-fechamento" value="fechamento" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Lock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Fechamento</span><span className="sm:hidden">Fech.</span>
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-alertas" value="alertas" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Bell className="h-3.5 w-3.5" /> Alertas
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-links" value="links" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Link2 className="h-3.5 w-3.5" /> Links
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-repc" value="repc" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <HardDrive className="h-3.5 w-3.5" /> REP-C
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-cct" value="cct" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Scale className="h-3.5 w-3.5" /> CCT
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-folha" value="folha" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Folha
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-relatorios" value="relatorios" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <FileDown className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Relatórios</span><span className="sm:hidden">Relat.</span>
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-config" value="config" className="flex items-center gap-1 text-xs py-2 px-2 sm:px-3">
              <Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Configuração</span><span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Dashboard */}
        <TabsContent value="dashboard"><PontoDashboardTab /></TabsContent>

        {/* Registros */}
        <TabsContent value="registros" className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button id="btn-ponto-prev-dia" variant="outline" size="icon" onClick={handlePrevDay}><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="px-4 py-2 bg-muted rounded-lg min-w-[180px] text-center">
                    <span className="font-medium">{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>
                  <Button id="btn-ponto-next-dia" variant="outline" size="icon" onClick={handleNextDay}><ChevronRight className="w-4 h-4" /></Button>
                  <Button id="btn-ponto-hoje" variant="outline" size="sm" onClick={handleToday}>Hoje</Button>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar colaborador ou CPF..." 
                      className="pl-9" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="atraso">Atraso</SelectItem>
                      <SelectItem value="falta">Falta</SelectItem>
                      <SelectItem value="incompleto">Incompleto</SelectItem>
                      <SelectItem value="justificado">Justificado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Departamento</Label>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Departamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Departamentos</SelectItem>
                      {departamentos.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><LogIn className="w-4 h-4" />Entrada</div></TableHead>
                  <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><Utensils className="w-4 h-4" />Saída Almoço</div></TableHead>
                  <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><Coffee className="w-4 h-4" />Retorno</div></TableHead>
                  <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><LogOut className="w-4 h-4" />Saída</div></TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPontos ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : filteredPontos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
                ) : filteredPontos.map((ponto) => {
                  const statusConfig = STATUS_PONTO_CONFIG[ponto.status] || STATUS_PONTO_CONFIG.pendente;
                  return (
                    <TableRow key={ponto.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {ponto.colaborador_nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">{ponto.colaborador_nome}</span>
                            <p className="text-xs text-muted-foreground">{ponto.colaborador_cpf}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{formatHora(ponto.entrada)}</TableCell>
                      <TableCell className="text-center font-mono">{formatHora(ponto.saida_almoco)}</TableCell>
                      <TableCell className="text-center font-mono">{formatHora(ponto.retorno_almoco)}</TableCell>
                      <TableCell className="text-center font-mono">{formatHora(ponto.saida)}</TableCell>
                      <TableCell className="text-center font-medium">{formatInterval(ponto.horas_trabalhadas)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("text-xs", statusConfig.color)}>{statusConfig.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        {/* Ajustes */}
        <TabsContent value="ajustes" className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold">Solicitações de Ajuste</h3>
                <p className="text-xs text-muted-foreground">
                  Histórico dos últimos 90 dias — pendentes, aprovadas e rejeitadas para conferência.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Pendentes: {ajustesPendentes.filter(a => a.status === "pendente").length}
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Aprovadas: {ajustesPendentes.filter(a => a.status === "aprovado").length}
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Rejeitadas: {ajustesPendentes.filter(a => a.status === "rejeitado").length}
                </Badge>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marcação</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-center">Anexos</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ajustesPendentes.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma solicitação de ajuste registrada.</TableCell></TableRow>
                ) : ajustesPendentes.map((ajuste) => {
                  const qtdAnexos = ajuste.anexos?.length ?? 0;
                  const isPendente = ajuste.status === "pendente";
                  const isAprovado = ajuste.status === "aprovado";
                  const isRejeitado = ajuste.status === "rejeitado";
                  return (
                  <TableRow key={ajuste.id} className={!isPendente ? "opacity-80" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {ajuste.colaborador_nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{ajuste.colaborador_nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>{(() => {
                      const raw = (ajuste.data_referencia || "").toString().slice(0, 10);
                      const [y, m, d] = raw.split("-");
                      return d && m && y ? `${d}/${m}/${y}` : (ajuste.data_referencia || "-");
                    })()}</TableCell>
                    <TableCell><Badge variant="outline">{ajuste.tipo_ajuste}</Badge></TableCell>
                    <TableCell>{ajuste.tipo_marcacao ? TIPO_MARCACAO_LABELS[ajuste.tipo_marcacao] : "-"}</TableCell>
                    <TableCell className="font-mono">{ajuste.hora_solicitada || "-"}</TableCell>
                    <TableCell className="max-w-[260px] align-top">
                      <p className="text-sm whitespace-pre-wrap break-words leading-snug">
                        {ajuste.motivo}
                      </p>
                      {ajuste.observacao_aprovador && (
                        <p className="mt-1 text-[11px] text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2">
                          Resposta: {ajuste.observacao_aprovador}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {qtdAnexos > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnexosModalAjuste(ajuste)}
                          className="gap-1"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="text-xs">{qtdAnexos}</span>
                          <Eye className="w-3.5 h-3.5 ml-0.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{ajuste.created_by_nome}</TableCell>
                    <TableCell className="text-center">
                      {isPendente && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>}
                      {isAprovado && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprovado</Badge>}
                      {isRejeitado && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejeitado</Badge>}
                      {!isPendente && ajuste.aprovado_por_nome && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          por {ajuste.aprovado_por_nome}
                        </p>
                      )}
                      {!isPendente && ajuste.data_aprovacao && (
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(ajuste.data_aprovacao), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPendente ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button id={`btn-aprovar-ajuste-${ajuste.id}`} size="sm" variant="outline" className="text-green-600 hover:text-green-600 hover:bg-green-50"
                            onClick={() => handleProcessarAjuste(ajuste.id, true)} disabled={processandoAjuste}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                          <Button id={`btn-rejeitar-ajuste-${ajuste.id}`} size="sm" variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleProcessarAjuste(ajuste.id, false)} disabled={processandoAjuste}>
                            <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center justify-center">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        {/* Escalas */}
        <TabsContent value="escalas"><PontoEscalasTab /></TabsContent>

        {/* Banco de Horas */}
        <TabsContent value="banco"><PontoBancoHorasTab /></TabsContent>

        {/* Fechamento */}
        <TabsContent value="fechamento"><PontoFechamentoTab /></TabsContent>

        {/* Alertas */}
        <TabsContent value="alertas"><PontoAlertasTab /></TabsContent>

        {/* Links WhatsApp */}
        <TabsContent value="links"><PontoLinksTab /></TabsContent>

        {/* REP-C */}
        <TabsContent value="repc"><PontoRepCTab /></TabsContent>

        {/* CCT */}
        <TabsContent value="cct"><PontoCCTTab /></TabsContent>

        {/* Folha */}
        <TabsContent value="folha"><PontoFolhaTab /></TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios"><PontoRelatoriosTab /></TabsContent>

        {/* Configuração */}
        <TabsContent value="config"><PontoConfigTab /></TabsContent>
      </Tabs>

      {/* Modal: Registrar Ponto */}
      <Dialog open={showRegistrarModal} onOpenChange={setShowRegistrarModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Ponto</DialogTitle>
            <DialogDescription>Selecione o colaborador, tipo de marcação, e capture selfie e localização.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={selectedColaborador?.id || ""} onValueChange={(id) => setSelectedColaborador(colaboradores.find(c => c.id === id) || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colab) => (
                    <SelectItem key={colab.id} value={colab.id}>
                      <div className="flex items-center gap-2"><UserCheck className="w-4 h-4" />{colab.nome_completo}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Marcação</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["entrada", "saida"] as const).map((tipo) => {
                  const jaRegistrado = tiposJaRegistrados.includes(tipo);
                  const ordemRequisitos: Record<string, string[]> = {
                    entrada: [],
                    saida: ["entrada"],
                  };
                  const requisitosAtendidos = ordemRequisitos[tipo].every(req => tiposJaRegistrados.includes(req));
                  const desabilitado = jaRegistrado || !requisitosAtendidos;
                  
                  return (
                    <Button
                      key={tipo}
                      type="button"
                      variant={tipoMarcacao === tipo ? "default" : "outline"}
                      className={cn("justify-start", desabilitado && tipoMarcacao !== tipo && "opacity-50")}
                      onClick={() => setTipoMarcacao(tipo)}
                      disabled={desabilitado}
                    >
                      {tipo === "entrada" && <LogIn className="w-4 h-4 mr-2" />}
                      {tipo === "saida" && <LogOut className="w-4 h-4 mr-2" />}
                      {TIPO_MARCACAO_LABELS[tipo]}
                      {jaRegistrado && <CheckCircle className="w-3.5 h-3.5 ml-auto text-green-500" />}
                      {!jaRegistrado && !requisitosAtendidos && <Lock className="w-3.5 h-3.5 ml-auto text-muted-foreground" />}
                    </Button>
                  );
                })}
              </div>
              {tiposJaRegistrados.includes("entrada") && tiposJaRegistrados.includes("saida") && (
                <p className="text-sm text-muted-foreground text-center py-1">
                  ✅ Todas as marcações do dia já foram registradas.
                </p>
              )}
            </div>

            {/* Geolocalização */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Localização
                </Label>
                {geo.loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              {geo.error && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {geo.error}
                  <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs h-6 px-2" onClick={() => geo.capturarLocalizacao()}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {geo.latitude && geo.longitude && (
                <div className="p-2 bg-muted rounded-lg text-xs space-y-1">
                  <p className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    <strong>Coordenadas:</strong> {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}
                  </p>
                  {geo.endereco && (
                    <p className="text-muted-foreground truncate" title={geo.endereco}>
                      📍 {geo.endereco}
                    </p>
                  )}
                </div>
              )}
              {!geo.latitude && !geo.loading && !geo.error && (
                <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={() => geo.capturarLocalizacao()}>
                  <MapPin className="w-3.5 h-3.5 mr-1.5" /> Capturar localização
                </Button>
              )}
            </div>

            {/* Selfie */}
            <PontoSelfieCapture
              selfieFile={selfieFile}
              selfiePreview={selfiePreview}
              onChange={(file, preview) => { setSelfieFile(file); setSelfiePreview(preview); }}
            />

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Data:</strong> {format(new Date(), "dd/MM/yyyy")}</p>
              <p><strong>Hora:</strong> {format(new Date(), "HH:mm:ss")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegistrarModal(false)}>Cancelar</Button>
            <Button onClick={handleRegistrarPonto} disabled={!selectedColaborador || registrandoPonto || tiposJaRegistrados.includes(tipoMarcacao)}>
              {registrandoPonto ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitar Ajuste */}
      <Dialog open={showAjusteModal} onOpenChange={handleCloseAjusteModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Ajuste de Ponto</DialogTitle>
            <DialogDescription>
              Use este formulário quando não conseguir registrar o ponto (sem internet, app indisponível, esquecimento, atendimento médico etc.). A justificativa é obrigatória e você pode anexar comprovantes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={ajusteColaborador} onValueChange={setAjusteColaborador}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colab) => <SelectItem key={colab.id} value={colab.id}>{colab.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Referência *</Label>
                <Input
                  type="date"
                  value={ajusteData}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setAjusteData(e.target.value)}
                />
                {ajusteData && (() => {
                  const [y, m, d] = ajusteData.split("-");
                  if (!y || !m || !d) return null;
                  const dt = new Date(Number(y), Number(m) - 1, Number(d));
                  return (
                    <p className="text-[11px] text-muted-foreground">
                      📅 {format(dt, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>Tipo de Ajuste *</Label>
                <Select value={ajusteTipo} onValueChange={(v) => setAjusteTipo(v as typeof ajusteTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusao">Inclusão (não registrei)</SelectItem>
                    <SelectItem value="correcao">Correção (registrei errado)</SelectItem>
                    <SelectItem value="justificativa">Justificativa (atestado/falta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {ajusteTipo !== "justificativa" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marcação *</Label>
                  <Select value={ajusteMarcacao} onValueChange={(v) => setAjusteMarcacao(v as typeof ajusteMarcacao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hora Correta *</Label>
                  <Input type="time" value={ajusteHora} onChange={(e) => setAjusteHora(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Justificativa * <span className="text-xs text-muted-foreground font-normal">(obrigatória)</span></Label>
              <Textarea
                placeholder="Ex.: Esqueci de bater o ponto na saída; estava sem sinal de internet; precisei sair para atendimento médico..."
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Anexos <span className="text-xs text-muted-foreground font-normal">(opcional — atestado, comprovante etc.)</span></Label>
              <AnexoUpload
                anexos={ajusteAnexos}
                onAnexosChange={setAjusteAnexos}
                maxFiles={3}
                maxSize={10 * 1024 * 1024}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloseAjusteModal(false)}>Cancelar</Button>
            <Button
              onClick={handleSolicitarAjuste}
              disabled={
                !ajusteColaborador ||
                !ajusteMotivo.trim() ||
                (ajusteTipo !== "justificativa" && !ajusteHora) ||
                solicitandoAjuste
              }
            >
              {solicitandoAjuste ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GuiaRapidoPonto open={showGuia} onOpenChange={setShowGuia} />
      <AnexosAjusteModal ajuste={anexosModalAjuste} onOpenChange={(o) => !o && setAnexosModalAjuste(null)} />
    </div>
  );
};

export default Ponto;
