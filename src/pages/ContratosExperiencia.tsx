import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText, Clock, CheckCircle2, XCircle, ArrowRightLeft,
  Search, AlertTriangle, User, Calendar, Building2, ChevronDown,
  Shield, Loader2, History, Settings2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExperienciaConfigForm } from "@/components/experiencia/ExperienciaConfigForm";
import { ExperienciaDocGenerator } from "@/components/experiencia/ExperienciaDocGenerator";
import { useEnviarParaHub } from "@/hooks/useEnviarParaHub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useContratosExperiencia,
  ContratoExperiencia,
  validarProrrogacao,
  getDiasRestantes,
  getDataFimAtual,
  getPeriodoAtual,
  getDuracaoTotal,
} from "@/hooks/useContratosExperiencia";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  em_experiencia: { label: "1º Período", variant: "default", icon: <Clock className="w-3 h-3" /> },
  em_experiencia_2_periodo: { label: "2º Período", variant: "outline", icon: <ArrowRightLeft className="w-3 h-3" /> },
  efetivado: { label: "Efetivado", variant: "secondary", icon: <CheckCircle2 className="w-3 h-3" /> },
  encerrado: { label: "Encerrado", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  vencido_automatico: { label: "Vencido (Indeterminado)", variant: "destructive", icon: <AlertTriangle className="w-3 h-3" /> },
};

export default function ContratosExperiencia() {
  const {
    contratos, isLoading, emExperiencia, vencendo15Dias, vencendo7Dias, vencendo30Dias,
    prorrogar, prorrogando,
    efetivar, efetivando,
    encerrar, encerrando,
  } = useContratosExperiencia();
  const { enviarParaHub } = useEnviarParaHub();

  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroFilial, setFiltroFilial] = useState("todos");
  const [filtroGestor, setFiltroGestor] = useState("todos");
  const [filtroPrazo, setFiltroPrazo] = useState("todos");
  const [selectedContrato, setSelectedContrato] = useState<ContratoExperiencia | null>(null);
  const [modalAction, setModalAction] = useState<"prorrogar" | "efetivar" | "encerrar" | "detalhes" | "documento" | null>(null);

  // Prorrogação form
  const [diasProrrogacao, setDiasProrrogacao] = useState(45);
  // Encerramento form
  const [tipoEncerramento, setTipoEncerramento] = useState("termino_normal");
  const [motivoEncerramento, setMotivoEncerramento] = useState("");
  const [dataEncerramento, setDataEncerramento] = useState(format(new Date(), "yyyy-MM-dd"));

  // Extrair listas únicas para filtros
  const filiais = useMemo(() => {
    const set = new Set(contratos.map(c => c.filial).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [contratos]);

  const gestores = useMemo(() => {
    const set = new Set(contratos.map(c => c.gestor_imediato).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [contratos]);

  const filtered = useMemo(() => {
    let result = contratos;
    if (filtroStatus !== "todos") {
      result = result.filter(c => c.status === filtroStatus);
    }
    if (filtroFilial !== "todos") {
      result = result.filter(c => c.filial === filtroFilial);
    }
    if (filtroGestor !== "todos") {
      result = result.filter(c => c.gestor_imediato === filtroGestor);
    }
    if (filtroPrazo !== "todos") {
      result = result.filter(c => {
        if (!isActive(c)) return false;
        const dias = getDiasRestantes(c);
        if (filtroPrazo === "7dias") return dias >= 0 && dias <= 7;
        if (filtroPrazo === "15dias") return dias >= 0 && dias <= 15;
        if (filtroPrazo === "30dias") return dias >= 0 && dias <= 30;
        return true;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.colaborador_nome.toLowerCase().includes(term) ||
        c.colaborador_cpf.includes(term) ||
        (c.cargo || "").toLowerCase().includes(term)
      );
    }
    return result;
  }, [contratos, filtroStatus, filtroFilial, filtroGestor, filtroPrazo, searchTerm]);

  const openAction = (contrato: ContratoExperiencia, action: typeof modalAction) => {
    setSelectedContrato(contrato);
    setModalAction(action);
    if (action === "prorrogar") {
      const v = validarProrrogacao(contrato);
      setDiasProrrogacao(Math.min(45, v.diasDisponiveis));
    }
    if (action === "encerrar") {
      setTipoEncerramento("termino_normal");
      setMotivoEncerramento("");
      setDataEncerramento(getDataFimAtual(contrato));
    }
  };

  const handleProrrogar = async () => {
    if (!selectedContrato) return;
    await prorrogar({ id: selectedContrato.id, duracao_prorrogacao: diasProrrogacao });
    setModalAction(null);
  };

  const handleEfetivar = async () => {
    if (!selectedContrato) return;
    await efetivar({ id: selectedContrato.id });
    // Enviar ao Hub Contábil
    const competencia = format(new Date(), "yyyy-MM");
    enviarParaHub({
      tipo: "Efetivação de Contrato de Experiência",
      competencia,
      descricao: `Colaborador ${selectedContrato.colaborador_nome} efetivado — contrato de experiência convertido para prazo indeterminado.`,
      colaborador_nome: selectedContrato.colaborador_nome,
      colaborador_cpf: selectedContrato.colaborador_cpf,
      direcao: "enviado",
    });
    setModalAction(null);
  };

  const handleEncerrar = async () => {
    if (!selectedContrato) return;
    await encerrar({
      id: selectedContrato.id,
      tipo_encerramento: tipoEncerramento,
      motivo_encerramento: motivoEncerramento || undefined,
      data_encerramento: dataEncerramento,
    });
    // Enviar ao Hub Contábil
    const tiposLabel: Record<string, string> = {
      termino_normal: "Término normal",
      rescisao_antecipada_empregador: "Rescisão antecipada (empregador)",
      rescisao_antecipada_empregado: "Rescisão antecipada (empregado)",
    };
    const competencia = format(new Date(), "yyyy-MM");
    enviarParaHub({
      tipo: "Encerramento de Contrato de Experiência",
      competencia,
      descricao: `Contrato encerrado: ${tiposLabel[tipoEncerramento] || tipoEncerramento}. Colaborador: ${selectedContrato.colaborador_nome}.${motivoEncerramento ? ` Motivo: ${motivoEncerramento}` : ""}`,
      colaborador_nome: selectedContrato.colaborador_nome,
      colaborador_cpf: selectedContrato.colaborador_cpf,
      direcao: "enviado",
    });
    setModalAction(null);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
  };

  const isActive = (c: ContratoExperiencia) =>
    c.status === "em_experiencia" || c.status === "em_experiencia_2_periodo";

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Contratos de Experiência</h1>
        <p className="text-muted-foreground">Gestão de contratos com prazos, alertas e ações legais integradas</p>
      </motion.div>

      <Tabs defaultValue="painel" className="space-y-6">
        <TabsList>
          <TabsTrigger value="painel" className="gap-1.5"><FileText className="w-4 h-4" /> Painel</TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5"><Settings2 className="w-4 h-4" /> Configuração da Empresa</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-0">
          <ExperienciaConfigForm />
        </TabsContent>

        <TabsContent value="painel" className="space-y-6">

      {/* Explicação */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Como funciona esta tela?</p>
                <p>
                  Esta tela centraliza a <strong>gestão dos contratos de experiência</strong> (CLT art. 445) de todos os colaboradores.
                  Os contratos aparecem aqui automaticamente quando um colaborador é admitido com tipo de contrato{" "}
                  <strong>"CLT – Contrato de Experiência"</strong> no módulo de Admissão/Pessoas.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Origem dos dados:</strong> as informações vêm do cadastro de admissão — nome, cargo, data de admissão, duração do período e cláusula assecuratória.</li>
                  <li><strong>Duração máxima:</strong> 90 dias, podendo ser dividida em dois períodos (ex.: 45 + 45). Apenas uma prorrogação é permitida.</li>
                  <li><strong>Alertas automáticos:</strong> o sistema notifica com 15, 7 e 2 dias de antecedência do vencimento para que a decisão (efetivar, prorrogar ou encerrar) seja tomada no prazo.</li>
                  <li><strong>Ações disponíveis:</strong> Prorrogar (se ainda permitido), Efetivar (converte para prazo indeterminado) ou Encerrar (rescisão por término ou antecipada).</li>
                  <li><strong>Segurança jurídica:</strong> todas as ações são registradas com histórico, data, responsável e fundamentação legal, impedindo alterações indevidas.</li>
                </ul>
                <p className="text-xs italic">
                  Se nenhum contrato aparece na lista, verifique se há admissões cadastradas com tipo "CLT – Contrato de Experiência" no módulo de Admissão.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Experiência</p>
                <p className="text-2xl font-bold">{emExperiencia.length}</p>
              </div>
              <Clock className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className={vencendo7Dias.length > 0 ? "border-destructive/50" : ""}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencendo em 7 dias</p>
                <p className="text-2xl font-bold text-destructive">{vencendo7Dias.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencendo em 15 dias</p>
                <p className="text-2xl font-bold">{vencendo15Dias.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencendo em 30 dias</p>
                <p className="text-2xl font-bold">{vencendo30Dias.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Contratos</p>
                <p className="text-2xl font-bold">{contratos.length}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar colaborador, CPF ou cargo..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="em_experiencia">1º Período</SelectItem>
            <SelectItem value="em_experiencia_2_periodo">2º Período</SelectItem>
            <SelectItem value="efetivado">Efetivado</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPrazo} onValueChange={setFiltroPrazo}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Prazos</SelectItem>
            <SelectItem value="7dias">Vencendo em 7 dias</SelectItem>
            <SelectItem value="15dias">Vencendo em 15 dias</SelectItem>
            <SelectItem value="30dias">Vencendo em 30 dias</SelectItem>
          </SelectContent>
        </Select>
        {filiais.length > 0 && (
          <Select value={filtroFilial} onValueChange={setFiltroFilial}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas Unidades</SelectItem>
              {filiais.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {gestores.length > 0 && (
          <Select value={filtroGestor} onValueChange={setFiltroGestor}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Gestor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Gestores</SelectItem>
              {gestores.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Admissão</TableHead>
              <TableHead>Término</TableHead>
              <TableHead>Dias Restantes</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum contrato de experiência encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contrato) => {
                const diasRestantes = getDiasRestantes(contrato);
                const active = isActive(contrato);
                const totalDias = getDuracaoTotal(contrato);
                const diasPassados = totalDias - (active ? Math.max(0, diasRestantes) : 0);
                const progresso = Math.min(100, (diasPassados / totalDias) * 100);
                const statusCfg = STATUS_CONFIG[contrato.status] || STATUS_CONFIG.em_experiencia;
                const urgente = active && diasRestantes <= 7 && diasRestantes >= 0;

                return (
                  <TableRow key={contrato.id} className={urgente ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{contrato.colaborador_nome}</p>
                          <p className="text-xs text-muted-foreground">{contrato.colaborador_cpf}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{contrato.cargo || "—"}</TableCell>
                    <TableCell>{formatDate(contrato.data_admissao)}</TableCell>
                    <TableCell>
                      <span className={urgente ? "text-destructive font-semibold" : ""}>
                        {formatDate(getDataFimAtual(contrato))}
                      </span>
                    </TableCell>
                    <TableCell>
                      {active ? (
                        <div className="space-y-1 min-w-[100px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className={diasRestantes <= 7 ? "text-destructive font-semibold" : diasRestantes <= 15 ? "text-amber-500 font-medium" : ""}>
                              {diasRestantes > 0 ? `${diasRestantes} dias` : diasRestantes === 0 ? "Vence hoje!" : "Vencido!"}
                            </span>
                            <span className="text-muted-foreground">{totalDias}d</span>
                          </div>
                          <Progress value={progresso} className="h-1.5" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getPeriodoAtual(contrato)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant} className="gap-1">
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {active ? (
                        <div className="flex justify-end gap-1">
                          <TooltipProvider>
                            {validarProrrogacao(contrato).permitido && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => openAction(contrato, "prorrogar")}>
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Prorrogar</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openAction(contrato, "efetivar")}
                                  className="text-emerald-600 hover:text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Efetivar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openAction(contrato, "encerrar")}
                                  className="text-destructive hover:text-destructive">
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Encerrar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => openAction(contrato, "documento")}>
                                  <FileText className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Gerar Documento</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openAction(contrato, "documento")}>
                            <FileText className="w-3.5 h-3.5 mr-1" /> Docs
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAction(contrato, "detalhes")}>
                            <History className="w-3.5 h-3.5 mr-1" /> Ver
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </motion.div>

        </TabsContent>
      </Tabs>

      {/* ===== MODAIS ===== */}

      {/* PRORROGAR */}
      <Dialog open={modalAction === "prorrogar"} onOpenChange={() => setModalAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" /> Prorrogar Contrato
            </DialogTitle>
            <DialogDescription>
              Prorrogar experiência de <strong>{selectedContrato?.colaborador_nome}</strong>
            </DialogDescription>
          </DialogHeader>
          {selectedContrato && (() => {
            const v = validarProrrogacao(selectedContrato);
            return (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                  <p><strong>1º Período:</strong> {selectedContrato.duracao_primeiro_periodo} dias (até {formatDate(selectedContrato.data_fim_primeiro_periodo)})</p>
                  <p><strong>Dias disponíveis:</strong> {v.diasDisponiveis} dias</p>
                  <p className="text-xs text-muted-foreground">CLT art. 445: máximo 90 dias, uma única prorrogação.</p>
                </div>

                <div className="space-y-2">
                  <Label>Duração da prorrogação (dias)</Label>
                  <Input type="number" min={1} max={v.diasDisponiveis}
                    value={diasProrrogacao}
                    onChange={(e) => setDiasProrrogacao(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Total após prorrogação: {selectedContrato.duracao_primeiro_periodo + diasProrrogacao} dias</p>
                </div>

                {selectedContrato.duracao_primeiro_periodo + diasProrrogacao > 90 && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                    ⚠️ Total excede 90 dias! Reduza a duração.
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancelar</Button>
            <Button onClick={handleProrrogar} disabled={prorrogando || (selectedContrato ? selectedContrato.duracao_primeiro_periodo + diasProrrogacao > 90 : false)}>
              {prorrogando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Prorrogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EFETIVAR */}
      <Dialog open={modalAction === "efetivar"} onOpenChange={() => setModalAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Efetivar Colaborador
            </DialogTitle>
            <DialogDescription>
              Converter o contrato de <strong>{selectedContrato?.colaborador_nome}</strong> para prazo indeterminado.
            </DialogDescription>
          </DialogHeader>
          {selectedContrato && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm space-y-1">
                <p className="font-semibold text-foreground">O que acontece ao efetivar:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Vínculo passa a CLT – prazo indeterminado</li>
                  <li>Contrato de experiência marcado como concluído</li>
                  <li>Módulo Financeiro atualizado automaticamente</li>
                  <li>Registro permanente no histórico</li>
                </ul>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p><strong>Colaborador:</strong> {selectedContrato.colaborador_nome}</p>
                <p><strong>Cargo:</strong> {selectedContrato.cargo || "—"}</p>
                <p><strong>Período total:</strong> {getDuracaoTotal(selectedContrato)} dias</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancelar</Button>
            <Button onClick={handleEfetivar} disabled={efetivando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {efetivando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Efetivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ENCERRAR */}
      <Dialog open={modalAction === "encerrar"} onOpenChange={() => setModalAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" /> Encerrar Contrato
            </DialogTitle>
            <DialogDescription>
              Encerrar experiência de <strong>{selectedContrato?.colaborador_nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Encerramento</Label>
              <Select value={tipoEncerramento} onValueChange={setTipoEncerramento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="termino_normal">Término normal do contrato</SelectItem>
                  <SelectItem value="rescisao_antecipada_empregador">Rescisão antecipada (empregador)</SelectItem>
                  <SelectItem value="rescisao_antecipada_empregado">Rescisão antecipada (empregado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Encerramento</Label>
              <Input type="date" value={dataEncerramento} onChange={(e) => setDataEncerramento(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea value={motivoEncerramento} onChange={(e) => setMotivoEncerramento(e.target.value)}
                placeholder="Descreva o motivo do encerramento..." rows={3} />
            </div>

            {tipoEncerramento.startsWith("rescisao_antecipada") && selectedContrato && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Atenção Legal
                </p>
                {selectedContrato.clausula_assecuratoria ? (
                  <p className="text-muted-foreground">Com cláusula assecuratória: aplicam-se regras de aviso prévio como contrato indeterminado.</p>
                ) : (
                  <p className="text-muted-foreground">
                    Sem cláusula assecuratória: aplica-se indenização de metade dos dias restantes
                    ({Math.ceil(getDiasRestantes(selectedContrato) / 2)} dias) — art. {tipoEncerramento === "rescisao_antecipada_empregador" ? "479" : "480"} CLT.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEncerrar} disabled={encerrando}>
              {encerrando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Encerrar Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETALHES */}
      <Dialog open={modalAction === "detalhes"} onOpenChange={() => setModalAction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Contrato</DialogTitle>
          </DialogHeader>
          {selectedContrato && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Colaborador</Label><p className="font-medium">{selectedContrato.colaborador_nome}</p></div>
                <div><Label className="text-muted-foreground">CPF</Label><p>{selectedContrato.colaborador_cpf}</p></div>
                <div><Label className="text-muted-foreground">Cargo</Label><p>{selectedContrato.cargo || "—"}</p></div>
                <div><Label className="text-muted-foreground">Admissão</Label><p>{formatDate(selectedContrato.data_admissao)}</p></div>
                <div><Label className="text-muted-foreground">1º Período</Label><p>{selectedContrato.duracao_primeiro_periodo} dias (até {formatDate(selectedContrato.data_fim_primeiro_periodo)})</p></div>
                {selectedContrato.prorrogado && (
                  <div><Label className="text-muted-foreground">Prorrogação</Label><p>{selectedContrato.duracao_prorrogacao} dias (até {formatDate(selectedContrato.data_fim_prorrogacao)})</p></div>
                )}
                <div><Label className="text-muted-foreground">Status</Label>
                  <Badge variant={STATUS_CONFIG[selectedContrato.status]?.variant || "default"}>
                    {STATUS_CONFIG[selectedContrato.status]?.label || selectedContrato.status}
                  </Badge>
                </div>
                <div><Label className="text-muted-foreground">Duração Total</Label><p>{getDuracaoTotal(selectedContrato)} dias</p></div>
                {selectedContrato.data_efetivacao && (
                  <div><Label className="text-muted-foreground">Efetivado em</Label><p>{formatDate(selectedContrato.data_efetivacao)}</p></div>
                )}
                {selectedContrato.data_encerramento && (
                  <>
                    <div><Label className="text-muted-foreground">Encerrado em</Label><p>{formatDate(selectedContrato.data_encerramento)}</p></div>
                    <div><Label className="text-muted-foreground">Tipo</Label><p>{selectedContrato.tipo_encerramento?.replace(/_/g, " ")}</p></div>
                  </>
                )}
              </div>
              {selectedContrato.clausula_assecuratoria && (
                <Badge variant="outline" className="gap-1"><Shield className="w-3 h-3" /> Cláusula assecuratória</Badge>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GERAR DOCUMENTO */}
      {selectedContrato && (
        <ExperienciaDocGenerator
          contrato={selectedContrato}
          open={modalAction === "documento"}
          onClose={() => setModalAction(null)}
        />
      )}
    </div>
  );
}
