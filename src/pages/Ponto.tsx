import { useState } from "react";
import { motion } from "framer-motion";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  Calendar, 
  Download, 
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  Coffee,
  Utensils,
  History,
  FileText,
  Shield,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePonto, TIPO_MARCACAO_LABELS, STATUS_PONTO_CONFIG, type PontoDiario, type PontoAjuste } from "@/hooks/usePonto";
import { useColaboradores, type Colaborador } from "@/hooks/useColaboradores";
import { useAuth } from "@/hooks/useAuth";

const Ponto = () => {
  const { profile } = useAuth();
  const { colaboradores } = useColaboradores();
  const {
    usePontoDiario,
    useMarcacoesHoje,
    useAjustesPendentes,
    registrarPonto,
    registrandoPonto,
    solicitarAjuste,
    solicitandoAjuste,
    processarAjuste,
    processandoAjuste,
  } = usePonto();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("registros");
  
  // Modals
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [tipoMarcacao, setTipoMarcacao] = useState<"entrada" | "saida_almoco" | "retorno_almoco" | "saida">("entrada");
  
  // Ajuste form
  const [ajusteColaborador, setAjusteColaborador] = useState<string>("");
  const [ajusteData, setAjusteData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ajusteTipo, setAjusteTipo] = useState<"inclusao" | "correcao" | "justificativa">("inclusao");
  const [ajusteMarcacao, setAjusteMarcacao] = useState<"entrada" | "saida_almoco" | "retorno_almoco" | "saida">("entrada");
  const [ajusteHora, setAjusteHora] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");

  // Queries
  const { data: pontosDiarios = [], isLoading: loadingPontos } = usePontoDiario(selectedDate);
  const { data: marcacoesHoje = [] } = useMarcacoesHoje();
  const { data: ajustesPendentes = [] } = useAjustesPendentes();

  // Navegação de data
  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  // Filtrar registros
  const filteredPontos = pontosDiarios.filter(
    (ponto) => statusFilter === "all" || ponto.status === statusFilter
  );

  // Stats
  const stats = {
    regulares: pontosDiarios.filter((p) => p.status === "regular").length,
    atrasos: pontosDiarios.filter((p) => p.status === "atraso").length,
    faltas: pontosDiarios.filter((p) => p.status === "falta").length,
    incompletos: pontosDiarios.filter((p) => p.status === "incompleto").length,
    ajustesPendentes: ajustesPendentes.length,
  };

  // Registrar ponto
  const handleRegistrarPonto = async () => {
    if (!selectedColaborador) return;

    try {
      await registrarPonto({
        colaboradorId: selectedColaborador.id,
        colaboradorNome: selectedColaborador.nome_completo,
        colaboradorCpf: selectedColaborador.cpf,
        tipoMarcacao,
      });
      setShowRegistrarModal(false);
      setSelectedColaborador(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Solicitar ajuste
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
      });
      setShowAjusteModal(false);
      setAjusteMotivo("");
      setAjusteHora("");
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Processar ajuste
  const handleProcessarAjuste = async (ajusteId: string, aprovado: boolean, observacao?: string) => {
    await processarAjuste({ ajusteId, aprovado, observacao });
  };

  // Formatação de horas
  const formatHora = (hora: string | null) => {
    if (!hora) return "--:--";
    return hora.substring(0, 5);
  };

  const formatInterval = (interval: string | null) => {
    if (!interval) return "0h 00min";
    // Formato: HH:MM:SS
    const parts = interval.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}h ${parts[1]}min`;
    }
    return interval;
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-7 h-7 text-primary" />
            Controle de Ponto
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Registro fiel e auditável da jornada
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleToday}>
            <Calendar className="w-4 h-4 mr-2" />
            Hoje
          </Button>
          <Button variant="outline" onClick={() => setShowAjusteModal(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Solicitar Ajuste
          </Button>
          <Button onClick={() => setShowRegistrarModal(true)}>
            <Clock className="w-4 h-4 mr-2" />
            Registrar Ponto
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
      >
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{stats.regulares}</p>
              <p className="text-sm text-muted-foreground">Regulares</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{stats.atrasos}</p>
              <p className="text-sm text-muted-foreground">Atrasos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <XCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats.faltas}</p>
              <p className="text-sm text-muted-foreground">Faltas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="w-8 h-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{stats.incompletos}</p>
              <p className="text-sm text-muted-foreground">Incompletos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <FileText className="w-8 h-8 text-info" />
            <div>
              <p className="text-2xl font-bold">{stats.ajustesPendentes}</p>
              <p className="text-sm text-muted-foreground">Ajustes Pendentes</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="registros" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Registros
          </TabsTrigger>
          <TabsTrigger value="ajustes" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Ajustes Pendentes
            {ajustesPendentes.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {ajustesPendentes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Registros */}
        <TabsContent value="registros" className="space-y-4">
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border p-4"
          >
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevDay}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 py-2 bg-muted rounded-lg min-w-[180px] text-center">
                  <span className="font-medium">
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                <Button variant="outline" size="icon" onClick={handleNextDay}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="atraso">Atraso</SelectItem>
                    <SelectItem value="falta">Falta</SelectItem>
                    <SelectItem value="incompleto">Incompleto</SelectItem>
                    <SelectItem value="justificado">Justificado</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <LogIn className="w-4 h-4" />
                      Entrada
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Utensils className="w-4 h-4" />
                      Saída Almoço
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Coffee className="w-4 h-4" />
                      Retorno
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <LogOut className="w-4 h-4" />
                      Saída
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPontos ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredPontos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado para esta data.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPontos.map((ponto) => {
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
                          <Badge className={cn("text-xs", statusConfig.color)}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        {/* Tab: Ajustes Pendentes */}
        <TabsContent value="ajustes" className="space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marcação</TableHead>
                  <TableHead>Hora Solicitada</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ajustesPendentes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum ajuste pendente de aprovação.
                    </TableCell>
                  </TableRow>
                ) : (
                  ajustesPendentes.map((ajuste) => (
                    <TableRow key={ajuste.id}>
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
                      <TableCell>{format(new Date(ajuste.data_referencia), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ajuste.tipo_ajuste}</Badge>
                      </TableCell>
                      <TableCell>{ajuste.tipo_marcacao ? TIPO_MARCACAO_LABELS[ajuste.tipo_marcacao] : "-"}</TableCell>
                      <TableCell className="font-mono">{ajuste.hora_solicitada || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{ajuste.motivo}</TableCell>
                      <TableCell>{ajuste.created_by_nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success hover:text-success hover:bg-success/10"
                            onClick={() => handleProcessarAjuste(ajuste.id, true)}
                            disabled={processandoAjuste}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleProcessarAjuste(ajuste.id, false)}
                            disabled={processandoAjuste}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Auditoria e Rastreabilidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Todos os registros de ponto são imutáveis e auditados. Não é possível excluir marcações.
                Qualquer alteração gera um registro no log de auditoria com identificação do usuário.
              </p>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Garantias do Sistema:</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Registro fiel da jornada com hash de integridade
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Impossibilidade de exclusão de marcações
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Rastreabilidade total com IP, dispositivo e geolocalização
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Logs de todas as alterações e ajustes
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Identificação do usuário em cada operação
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Integridade garantida por hash SHA-256
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Registrar Ponto */}
      <Dialog open={showRegistrarModal} onOpenChange={setShowRegistrarModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Ponto</DialogTitle>
            <DialogDescription>
              Selecione o colaborador e o tipo de marcação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={selectedColaborador?.id || ""}
                onValueChange={(id) => setSelectedColaborador(colaboradores.find(c => c.id === id) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colab) => (
                    <SelectItem key={colab.id} value={colab.id}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        {colab.nome_completo}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Marcação</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["entrada", "saida_almoco", "retorno_almoco", "saida"] as const).map((tipo) => (
                  <Button
                    key={tipo}
                    type="button"
                    variant={tipoMarcacao === tipo ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setTipoMarcacao(tipo)}
                  >
                    {tipo === "entrada" && <LogIn className="w-4 h-4 mr-2" />}
                    {tipo === "saida_almoco" && <Utensils className="w-4 h-4 mr-2" />}
                    {tipo === "retorno_almoco" && <Coffee className="w-4 h-4 mr-2" />}
                    {tipo === "saida" && <LogOut className="w-4 h-4 mr-2" />}
                    {TIPO_MARCACAO_LABELS[tipo]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Data:</strong> {format(new Date(), "dd/MM/yyyy")}</p>
              <p><strong>Hora:</strong> {format(new Date(), "HH:mm:ss")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegistrarModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarPonto}
              disabled={!selectedColaborador || registrandoPonto}
            >
              {registrandoPonto ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitar Ajuste */}
      <Dialog open={showAjusteModal} onOpenChange={setShowAjusteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Ajuste de Ponto</DialogTitle>
            <DialogDescription>
              Preencha os dados para solicitar um ajuste. A solicitação será enviada para aprovação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={ajusteColaborador} onValueChange={setAjusteColaborador}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map((colab) => (
                    <SelectItem key={colab.id} value={colab.id}>
                      {colab.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Referência</Label>
                <Input
                  type="date"
                  value={ajusteData}
                  onChange={(e) => setAjusteData(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Ajuste</Label>
                <Select value={ajusteTipo} onValueChange={(v) => setAjusteTipo(v as typeof ajusteTipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusao">Inclusão</SelectItem>
                    <SelectItem value="correcao">Correção</SelectItem>
                    <SelectItem value="justificativa">Justificativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {ajusteTipo !== "justificativa" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marcação</Label>
                  <Select value={ajusteMarcacao} onValueChange={(v) => setAjusteMarcacao(v as typeof ajusteMarcacao)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida_almoco">Saída Almoço</SelectItem>
                      <SelectItem value="retorno_almoco">Retorno Almoço</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hora Solicitada</Label>
                  <Input
                    type="time"
                    value={ajusteHora}
                    onChange={(e) => setAjusteHora(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Motivo / Justificativa</Label>
              <Textarea
                placeholder="Descreva o motivo do ajuste..."
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAjusteModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSolicitarAjuste}
              disabled={!ajusteColaborador || !ajusteMotivo || solicitandoAjuste}
            >
              {solicitandoAjuste ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ponto;
