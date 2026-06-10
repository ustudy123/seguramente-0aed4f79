import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
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
import { PontoAjustesTab } from "@/components/ponto/PontoAjustesTab";
import { PontoCCTTab } from "@/components/ponto/PontoCCTTab";
import { PontoLinksTab } from "@/components/ponto/PontoLinksTab";
import { PontoConfigTab } from "@/components/ponto/PontoConfigTab";
import { PontoAcordosTab } from "@/components/ponto/PontoAcordosTab";
import { PontoBancoHorasConfigTab } from "@/components/ponto/PontoBancoHorasConfigTab";
import { MarcacaoBadge } from "@/components/ponto/MarcacaoBadge";

const Ponto = () => {
  const { profile, tenantId: tenantIdAtivo, hasMinimumRole } = useAuth();
  const { colaboradores } = useColaboradores({ excluirPJ: true, apenasBatePonto: true, excluirInativos: true });
  const podeEditarMarcacao = hasMinimumRole("manager");
  const {
    usePontoDiario, useMarcacoesHoje, useAjustesPendentes,
    registrarPonto, registrandoPonto,
    solicitarAjuste, solicitandoAjuste,
    processarAjuste, processandoAjuste,
    excluirAjuste, excluindoAjuste,
    editarMarcacao, editandoMarcacao,
    excluirMarcacao, excluindoMarcacao,
  } = usePonto();

  const geo = useGeolocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("visao_geral");
  const [apuracaoTab, setApuracaoTab] = useState("banco");
  const [complianceTab, setComplianceTab] = useState("alertas");
  const [configTab, setConfigTab] = useState("config");
  
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [anexosModalAjuste, setAnexosModalAjuste] = useState<PontoAjuste | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [tipoMarcacao, setTipoMarcacao] = useState<any>("entrada");
  
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [ajusteColaborador, setAjusteColaborador] = useState<string>("");
  const [ajusteData, setAjusteData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ajusteTipo, setAjusteTipo] = useState<"inclusao" | "correcao" | "justificativa">("inclusao");
  const [ajusteMarcacao, setAjusteMarcacao] = useState<any>("entrada");
  const [ajusteHora, setAjusteHora] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteAnexos, setAjusteAnexos] = useState<File[]>([]);

  const { data: pontosDiarios = [], isLoading: loadingPontos } = usePontoDiario(selectedDate);
  const { data: marcacoesHoje = [] } = useMarcacoesHoje();

  const { empresaAtivaId } = useEmpresaAtiva();
  const dataSelStr = format(selectedDate, "yyyy-MM-dd");
  
  const { data: marcacoesDoDia = [] } = useQuery({
    queryKey: ["ponto-marcacoes-dia", tenantIdAtivo, dataSelStr, empresaAtivaId],
    queryFn: async () => {
      if (!tenantIdAtivo) return [] as any[];
      let q = fromTable("ponto_marcacoes")
        .select("id,colaborador_cpf,hora_marcacao,tipo_marcacao,marcacao_original,endereco_geolocalizacao,selfie_url")
        .eq("tenant_id", tenantIdAtivo)
        .eq("data_marcacao", dataSelStr);
      if (empresaAtivaId) q = q.or(`empresa_id.eq.${empresaAtivaId},empresa_id.is.null`);
      const { data, error } = await q.order("hora_marcacao", { ascending: true }) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantIdAtivo,
  });

  const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");
  const marcacoesPorCpf = useMemo(() => {
    const map = new Map<string, Array<{ id: string; hora: string; tipo: string; original: boolean; endereco?: string; selfieUrl?: string }>>();
    for (const m of marcacoesDoDia) {
      const k = onlyDigits(m.colaborador_cpf);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({ 
        id: m.id,
        hora: m.hora_marcacao, 
        tipo: m.tipo_marcacao,
        original: m.marcacao_original ?? true,
        endereco: m.endereco_geolocalizacao,
        selfieUrl: m.selfie_url
      });
    }
    return map;
  }, [marcacoesDoDia]);
  
  const marcacoesColaboradorHoje = marcacoesHoje.filter(
    (m: any) => selectedColaborador && m.colaborador_cpf === selectedColaborador.cpf
  );
  const tiposJaRegistrados = marcacoesColaboradorHoje.map((m: any) => m.tipo_marcacao);
  
  useEffect(() => {
    if (!selectedColaborador) return;
    const ordem: any[] = ["entrada", "saida_almoco", "retorno_almoco", "saida", "batida"];
    const proximo = ordem.find((t) => !tiposJaRegistrados.includes(t));
    if (proximo) setTipoMarcacao(proximo);
  }, [selectedColaborador, tiposJaRegistrados.join(",")]);

  const { data: ajustesPendentesRaw = [] } = useAjustesPendentes();
  const ajustesPendentes = useMemo(() => {
    if (!empresaAtivaId) return ajustesPendentesRaw;
    if (colaboradores.length > 0) {
      const cpfsEmpresa = new Set(colaboradores.map((c) => (c.cpf || "").replace(/\D/g, "")).filter(Boolean));
      return ajustesPendentesRaw.filter((a: any) => {
        if (a.empresa_id && a.empresa_id === empresaAtivaId) return true;
        const cpfDigito = (a.colaborador_cpf || "").replace(/\D/g, "");
        return cpfDigito && cpfsEmpresa.has(cpfDigito);
      });
    }
    return ajustesPendentesRaw.filter((a: any) => a.empresa_id === empresaAtivaId);
  }, [ajustesPendentesRaw, colaboradores, empresaAtivaId]);

  useEffect(() => {
    if (showRegistrarModal) geo.capturarLocalizacao();
    else { geo.limpar(); setSelfieFile(null); setSelfiePreview(null); }
  }, [showRegistrarModal]);

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  const colabIds = useMemo(() => new Set(colaboradores.map(c => c.id)), [colaboradores]);
  const colabCpfs = useMemo(() => new Set(colaboradores.map(c => (c.cpf || "").replace(/\D/g, "")).filter(Boolean)), [colaboradores]);

  const filteredPontos = pontosDiarios.filter((ponto) => {
    const cpfDig = (ponto.colaborador_cpf || "").replace(/\D/g, "");
    const pertence = colabIds.has(ponto.colaborador_id) || (cpfDig && colabCpfs.has(cpfDig));
    if (!pertence) return false;
    const matchesStatus = statusFilter === "all" || ponto.status === statusFilter;
    const matchesSearch = ponto.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase()) || ponto.colaborador_cpf.includes(searchTerm);
    const colab = colaboradores.find(c => c.id === ponto.colaborador_id);
    const matchesDept = deptFilter === "all" || (colab && colab.departamento === deptFilter);
    return matchesStatus && matchesSearch && matchesDept;
  });

  const departamentos = Array.from(new Set(colaboradores.map(c => c.departamento).filter(Boolean))) as string[];

  const handleRegistrarPonto = async () => {
    if (!selectedColaborador) return;
    try {
      let selfieUrl: string | null = null;
      let selfieNome: string | null = null;
      if (selfieFile) {
        const fileName = `${selectedColaborador.cpf}/${format(new Date(), "yyyy-MM-dd")}_${tipoMarcacao}_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from("ponto-selfies").upload(fileName, selfieFile, { contentType: "image/jpeg" });
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

  const formatInterval = (interval: string | null) => {
    if (!interval) return "0h 00min";
    const parts = interval.split(":");
    return parts.length >= 2 ? `${parts[0]}h ${parts[1]}min` : interval;
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">Gestão de Jornada · CLT</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-primary" /> Controle de Ponto Eletrônico
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Registro fiel e auditável da jornada · Portaria 671 MTP
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowGuia(true)} className="gap-2 text-primary border-primary/30 hover:bg-primary/5">
            <HelpCircle className="h-4 w-4" /> Guia Rápido
          </Button>
          <Button size="sm" onClick={() => setShowAjusteModal(true)} className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-md shadow-primary/20">
            <FileText className="h-4 w-4 mr-2" /> Solicitar Ajuste
          </Button>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max min-w-full h-auto gap-1 p-0 bg-transparent border-b border-border rounded-none">
            <TabsTrigger value="visao_geral" className="py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium">Visão Geral</TabsTrigger>
            <TabsTrigger value="espelho" className="py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium">Espelho</TabsTrigger>
            <TabsTrigger value="ajustes" className="py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium">Ajustes</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="visao_geral"><PontoDashboardTab /></TabsContent>
        <TabsContent value="espelho" className="space-y-4">
          <div className="bg-card rounded-xl border p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevDay}><ChevronLeft className="w-4 h-4" /></Button>
              <div className="px-4 py-2 bg-muted rounded-lg min-w-[220px] text-center">
                <div className="font-medium">{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
              </div>
              <Button variant="outline" size="icon" onClick={handleNextDay}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={handleToday}>Hoje</Button>
            </div>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50"><TableHead>Colaborador</TableHead><TableHead>Marcações</TableHead><TableHead className="text-center">Total</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredPontos.map((ponto) => {
                  const cpfKey = onlyDigits(ponto.colaborador_cpf);
                  const marcs = marcacoesPorCpf.get(cpfKey) || [];
                  const statusConfig = STATUS_PONTO_CONFIG[ponto.status] || STATUS_PONTO_CONFIG.pendente;
                  return (
                    <TableRow key={ponto.id}>
                      <TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback>{ponto.colaborador_nome[0]}</AvatarFallback></Avatar><div><span className="font-medium">{ponto.colaborador_nome}</span></div></div></TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-2 max-w-sm py-2">
                          {marcs.map((m, idx) => {
                            const isEntry = m.tipo === 'batida' ? (idx % 2 === 0) : (m.tipo === "entrada" || m.tipo === "retorno_almoco");
                            return (
                              <MarcacaoBadge
                                key={m.id || idx} id={m.id} hora={m.hora} isEntry={isEntry} original={m.original}
                                podeEditar={podeEditarMarcacao} editando={editandoMarcacao} onSalvar={editarMarcacao}
                                onExcluir={podeEditarMarcacao ? excluirMarcacao : undefined} excluindo={excluindoMarcacao}
                                endereco={m.endereco} selfieUrl={m.selfieUrl} tipo={m.tipo}
                              />
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{formatInterval(ponto.horas_trabalhadas)}</TableCell>
                      <TableCell className="text-center"><Badge className={cn("text-xs", statusConfig.color)}>{statusConfig.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="ajustes"><PontoAjustesTab ajustes={ajustesPendentes} processarAjuste={processarAjuste} processandoAjuste={processandoAjuste} excluirAjuste={excluirAjuste} excluindoAjuste={excluindoAjuste} setAnexosModalAjuste={setAnexosModalAjuste} /></TabsContent>
      </Tabs>
      <Dialog open={showRegistrarModal} onOpenChange={setShowRegistrarModal}>
        <DialogContent><DialogHeader><DialogTitle>Registrar Ponto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Select onValueChange={(id) => setSelectedColaborador(colaboradores.find(c => c.id === id) || null)}><SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger><SelectContent>{colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-2">
            {["entrada", "saida", "batida"].map(t => <Button key={t} variant={tipoMarcacao === t ? "default" : "outline"} onClick={() => setTipoMarcacao(t as any)}>{t.toUpperCase()}</Button>)}
          </div>
          <PontoSelfieCapture onCapture={(file, preview) => { setSelfieFile(file); setSelfiePreview(preview); }} />
          <Button onClick={handleRegistrarPonto} disabled={registrandoPonto} className="w-full">Registrar</Button>
        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ponto;