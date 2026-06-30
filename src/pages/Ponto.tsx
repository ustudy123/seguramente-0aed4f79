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
  MapPin, Loader2, Link2, HelpCircle, Search, Paperclip, Eye, Image as ImageIcon, CalendarDays,
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
import { PontoAjustesTab } from "@/components/ponto/PontoAjustesTab";
import { PontoCCTTab } from "@/components/ponto/PontoCCTTab";
import { PontoLinksTab } from "@/components/ponto/PontoLinksTab";
import { PontoConfigTab } from "@/components/ponto/PontoConfigTab";
import { PontoFeriadosTab } from "@/components/ponto/PontoFeriadosTab";
import { PontoFeriadoExcecoesTab } from "@/components/ponto/PontoFeriadoExcecoesTab";
import { PontoAcordosTab } from "@/components/ponto/PontoAcordosTab";
import { PontoBancoHorasConfigTab } from "@/components/ponto/PontoBancoHorasConfigTab";
import { AjustesAprovacaoPlanilha } from "@/components/ponto/AjustesAprovacaoPlanilha";
import { SolicitarAjusteFolhaInterno } from "@/components/ponto/SolicitarAjusteFolhaInterno";
import { MarcacaoBadge } from "@/components/ponto/MarcacaoBadge";



const Ponto = () => {
  const { profile, tenantId: tenantIdAtivo, hasMinimumRole } = useAuth();
  // Ponto eletrônico é exclusivo para vínculos CLT — exclui PJ/Pró-labore/Terceiros.
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
  
  // Modals
  const [showRegistrarModal, setShowRegistrarModal] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [anexosModalAjuste, setAnexosModalAjuste] = useState<PontoAjuste | null>(null);
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [tipoMarcacao, setTipoMarcacao] = useState<"entrada" | "saida_almoco" | "retorno_almoco" | "saida" | "batida">("entrada");
  
  // Selfie state
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Ajuste form
  const [ajusteColaborador, setAjusteColaborador] = useState<string>("");
  const [ajusteData, setAjusteData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ajusteTipo, setAjusteTipo] = useState<"inclusao" | "correcao" | "justificativa">("inclusao");
  const [ajusteMarcacao, setAjusteMarcacao] = useState<"entrada" | "saida_almoco" | "retorno_almoco" | "saida" | "batida">("entrada");
  const [ajusteHora, setAjusteHora] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteAnexos, setAjusteAnexos] = useState<File[]>([]);

  // Queries
  const { data: pontosDiarios = [], isLoading: loadingPontos } = usePontoDiario(selectedDate);
  const { data: marcacoesHoje = [] } = useMarcacoesHoje();

  // Marcações detalhadas do dia selecionado (todas, em ordem cronológica)
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
      // NÃO filtramos por empresa_id aqui de propósito. As marcações são
      // casadas por CPF com a lista de ponto_diario já escopada por
      // empresa (filteredPontos), então só aparecem as dos colaboradores
      // exibidos. Filtrar empresa_id aqui escondia marcações cujo
      // empresa_id divergia do ativo (ex.: inserida por aprovação de
      // ajuste, admissão duplicada) — a linha mostrava status
      // "Entrada Registrada" mas "Sem marcações" no espelho.
      const { data, error } = await q.order("hora_marcacao", { ascending: true }) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantIdAtivo,
  });

  // Atestados que cobrem o dia selecionado — para exibir o selo "ATESTADO" no
  // espelho, mesmo quando a pessoa trabalhou parte do dia (atestado de horas).
  const { data: atestadosDoDia = [] } = useQuery({
    queryKey: ["ponto-atestados-dia", tenantIdAtivo, dataSelStr],
    queryFn: async () => {
      if (!tenantIdAtivo) return [] as any[];
      const { data, error } = await fromTable("atestados")
        .select("colaborador_cpf, unidade_afastamento, horas_afastamento, minutos_afastamento, data_inicio_afastamento, data_fim_afastamento")
        .eq("tenant_id", tenantIdAtivo)
        .not("data_inicio_afastamento", "is", null)
        .lte("data_inicio_afastamento", dataSelStr) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      // Mantém os que cobrem a data (fim >= data; fim nulo = só o dia início)
      return (data || []).filter((a) => (a.data_fim_afastamento || a.data_inicio_afastamento) >= dataSelStr);
    },
    enabled: !!tenantIdAtivo,
  });

  // Agrupa por CPF (apenas dígitos para evitar divergências de máscara)
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

  // Atestado por CPF (dígitos) do dia selecionado.
  const atestadosPorCpf = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of atestadosDoDia) {
      const k = onlyDigits(a.colaborador_cpf);
      if (k && !map.has(k)) map.set(k, a);
    }
    return map;
  }, [atestadosDoDia]);
  
  // Determine which markings the selected collaborator already has today
  const marcacoesColaboradorHoje = marcacoesHoje.filter(
    (m: any) => selectedColaborador && m.colaborador_cpf === selectedColaborador.cpf
  );
  // Alternância entrada ↔ saída: classifica pela última marcação do dia
  const classificaTipo = (t: string) => (t === "saida" || t === "saida_almoco" ? "out" : "in");
  const ultimaMarcacaoHoje = [...marcacoesColaboradorHoje].sort((a: any, b: any) =>
    String(a.hora_marcacao).localeCompare(String(b.hora_marcacao))
  ).pop();
  const proximoTipoEsperado: "entrada" | "saida" = !ultimaMarcacaoHoje
    ? "entrada"
    : classificaTipo(ultimaMarcacaoHoje.tipo_marcacao) === "in"
    ? "saida"
    : "entrada";

  // Auto-seleciona o próximo tipo pela alternância quando troca o colaborador
  useEffect(() => {
    if (!selectedColaborador) return;
    setTipoMarcacao(proximoTipoEsperado as any);
  }, [selectedColaborador, proximoTipoEsperado]);
  const { data: ajustesPendentesRaw = [] } = useAjustesPendentes();
  // Ajustes são escopados por tenant (a tabela não possui empresa_id).
  // Se houver colaboradores carregados para a empresa ativa, filtra; caso contrário, mostra todos do tenant.
  const ajustesPendentes = useMemo(() => {
    // Se não houver colaboradores carregados, ou se não houver empresa selecionada,
    // o hook useAjustesPendentes já filtra por empresa_id no banco se disponível.
    // Aqui fazemos um fallback de segurança baseado no CPF se necessário.
    if (!empresaAtivaId) return ajustesPendentesRaw;
    
    // Se tivermos colaboradores carregados, filtramos apenas os ajustes dos colaboradores que PERTENCEM a essa empresa
    // ou que tenham o empresa_id explicitamente vinculado à empresa ativa.
    if (colaboradores.length > 0) {
      const cpfsEmpresa = new Set(
        colaboradores.map((c) => (c.cpf || "").replace(/\D/g, "")).filter(Boolean)
      );
      
      return ajustesPendentesRaw.filter((a: any) => {
        // PENDENTES nunca são escondidos: se a aprovação filtrasse por
        // empresa, um pendente de outra empresa ficaria invisível e o
        // colaborador (bloqueado pela folha) não teria como ser destravado.
        if (a.status === "pendente") return true;
        // Se o ajuste já tem empresa_id e ele bate com a ativa, mantém
        if (a.empresa_id && a.empresa_id === empresaAtivaId) return true;
        
        // Se o ajuste é do tenant (global) ou nulo, verifica pelo CPF se o colaborador pertence a esta empresa
        const cpfDigito = (a.colaborador_cpf || "").replace(/\D/g, "");
        return cpfDigito && cpfsEmpresa.has(cpfDigito);
      });
    }

    // Se não houver colaboradores carregados ainda mas houver empresaId, filtramos apenas pelo ID da empresa
    return ajustesPendentesRaw.filter((a: any) => a.status === "pendente" || a.empresa_id === empresaAtivaId);
  }, [ajustesPendentesRaw, colaboradores, empresaAtivaId]);

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

  // Monta as linhas do espelho a partir da lista COMPLETA de colaboradores
  // da empresa ativa (fonte da verdade de quem bate ponto), anexando o
  // registro de ponto_diario quando existir. Colaboradores sem registro no
  // dia passam a aparecer como "Sem marcações / Pendente". Antes a tabela
  // iterava apenas ponto_diario, então quem ainda não tinha linha consolidada
  // (sem escala atribuída, admissão recente, consolidação não executada ou
  // que ainda não bateu o ponto no dia) simplesmente sumia do espelho.
  type EspelhoRow = PontoDiario & { __virtual?: boolean };
  const espelhoRows = useMemo<EspelhoRow[]>(() => {
    // Indexa o ponto_diario do dia por colaborador (id e CPF só-dígitos).
    const pontoPorColabId = new Map<string, PontoDiario>();
    const pontoPorCpf = new Map<string, PontoDiario>();
    for (const p of pontosDiarios) {
      if (p.colaborador_id) pontoPorColabId.set(p.colaborador_id, p);
      const cpf = (p.colaborador_cpf || "").replace(/\D/g, "");
      if (cpf) pontoPorCpf.set(cpf, p);
    }

    const usados = new Set<string>(); // ids de ponto_diario já anexados
    const rows: EspelhoRow[] = [];

    // 1) Uma linha por colaborador da empresa ativa (registro real ou virtual).
    for (const colab of colaboradores) {
      const cpfDig = (colab.cpf || "").replace(/\D/g, "");
      const ponto = pontoPorColabId.get(colab.id) || (cpfDig ? pontoPorCpf.get(cpfDig) : undefined);
      if (ponto) {
        usados.add(ponto.id);
        rows.push(ponto);
      } else {
        rows.push({
          id: `virtual-${colab.id}`,
          tenant_id: tenantIdAtivo || "",
          empresa_id: colab.empresa_id ?? null,
          colaborador_id: colab.id,
          colaborador_nome: colab.nome_completo,
          colaborador_cpf: colab.cpf || "",
          data: dataSelStr,
          entrada: null, saida_almoco: null, retorno_almoco: null, saida: null,
          horas_trabalhadas: null, horas_extras: null, horas_faltantes: null,
          status: "pendente",
          observacao: null,
          tipo_dia: null, feriado_nome: null, feriado_trabalhado: null,
          created_at: "", updated_at: "",
          __virtual: true,
        });
      }
    }

    // 2) Mantém registros de ponto_diario da empresa ativa que NÃO casaram
    //    com nenhum colaborador da lista (cadastro divergente: empresa
    //    trocada, admissão pendente, bate_ponto desmarcado). Sem isso, uma
    //    batida real cujo cadastro diverge sumiria do espelho.
    for (const p of pontosDiarios) {
      if (usados.has(p.id)) continue;
      if (!!empresaAtivaId && p.empresa_id === empresaAtivaId) rows.push(p);
    }

    return rows.sort((a, b) =>
      (a.colaborador_nome || "").localeCompare(b.colaborador_nome || "", "pt-BR", { sensitivity: "base" })
    );
  }, [colaboradores, pontosDiarios, empresaAtivaId, tenantIdAtivo, dataSelStr]);

  const filteredPontos = espelhoRows.filter((ponto) => {
    // Só lista no espelho quem tem ao menos uma marcação no dia. Some quem
    // está sem batida (linhas virtuais "Pendente", além de Falta/Atestado/
    // Justificado/Férias/Feriado) — essas situações ficam visíveis em
    // Apuração/Fechamento/Compliance. Quem bate ponto gera linha em
    // ponto_diario via trigger, então continua aparecendo.
    const temMarcacao = (marcacoesPorCpf.get(onlyDigits(ponto.colaborador_cpf))?.length ?? 0) > 0;
    // Mostra também dias COM situação abonada sem batida (atestado, férias,
    // afastamento): o backend consolida esses dias em ponto_diario com
    // status 'justificado' justamente "para aparecerem no espelho mesmo sem
    // batida" (ver migration ferias_atestado_integra_ponto). Sem isto, um
    // atestado de dia inteiro sumia do espelho mesmo lançado.
    const temAbono = !ponto.__virtual && ponto.status === "justificado";
    if (!temMarcacao && !temAbono) return false;

    const matchesStatus = statusFilter === "all" || ponto.status === statusFilter;
    const matchesSearch = ponto.colaborador_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ponto.colaborador_cpf.includes(searchTerm);
    // Para filtrar por departamento, cruzamos com a lista de colaboradores.
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
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">
            Gestão de Jornada · CLT
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-primary" /> Controle de Ponto Eletrônico
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Registro fiel e auditável da jornada · Portaria 671 MTP
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
          <Button
            id="btn-solicitar-ajuste"
            size="sm"
            onClick={() => setShowAjusteModal(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-md shadow-primary/20"
          >
            <FileText className="h-4 w-4 mr-2" /> Solicitar Ajuste
          </Button>
        </div>
      </motion.div>


      {/* Main Tabs — 7 grupos funcionais */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max min-w-full h-auto gap-1 p-0 bg-transparent border-b border-border rounded-none">
            <TabsTrigger id="tab-ponto-visao-geral" value="visao_geral" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Visão Geral</span><span className="sm:hidden">Visão</span>
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-espelho" value="espelho" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <Clock className="h-3.5 w-3.5" /> Espelho
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-escalas" value="escalas" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <Calendar className="h-3.5 w-3.5" /> Escalas
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-apuracao" value="apuracao" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <Wallet className="h-3.5 w-3.5" /> Apuração
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-ajustes" value="ajustes" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <FileText className="h-3.5 w-3.5" /> Ajustes
              {(() => {
                const pendentes = ajustesPendentes.filter(a => a.status === "pendente");
                const uniqueDaysMap = new Map<string, Set<string>>();
                pendentes.forEach(a => {
                  const key = a.colaborador_id || a.colaborador_cpf;
                  if (!uniqueDaysMap.has(key)) uniqueDaysMap.set(key, new Set());
                  uniqueDaysMap.get(key)!.add(a.data_referencia);
                });
                let count = 0;
                uniqueDaysMap.forEach(days => { count += days.size; });
                return count > 0 && (
                  <Badge variant="destructive" className="ml-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]">
                    {count}
                  </Badge>
                );
              })()}
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-compliance" value="compliance" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <Shield className="h-3.5 w-3.5" /> Compliance
            </TabsTrigger>
            <TabsTrigger id="tab-ponto-configuracoes" value="configuracoes" className="flex items-center gap-1.5 text-xs sm:text-sm py-3 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium">
              <Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Configurações</span><span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>


        {/* Visão Geral */}
        <TabsContent value="visao_geral"><PontoDashboardTab /></TabsContent>

        {/* Espelho */}
        <TabsContent value="espelho" className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button id="btn-ponto-prev-dia" variant="outline" size="icon" onClick={handlePrevDay}><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="px-4 py-2 bg-muted rounded-lg min-w-[220px] text-center">
                    <div className="font-medium leading-tight">{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</div>
                    <div className="text-[11px] text-muted-foreground capitalize leading-tight">{format(selectedDate, "EEEE", { locale: ptBR })}</div>
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
                  <TableHead><div className="flex items-center gap-1"><Clock className="w-4 h-4" />Marcações do dia</div></TableHead>
                  <TableHead className="text-center w-28">Registros</TableHead>
                  <TableHead className="text-center w-28">Total</TableHead>
                  <TableHead className="text-center w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPontos ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : filteredPontos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
                ) : filteredPontos.map((ponto) => {
                  // Linha virtual (colaborador sem registro no dia) mostra
                  // "Pendente"; só registros reais com status pendente viram
                  // "Ajuste Pendente".
                  const isVirtual = ponto.__virtual === true;
                  const pontoStatus = (ponto.status === 'pendente' && !isVirtual) ? 'ajuste_pendente' : ponto.status;
                  const statusConfig = STATUS_PONTO_CONFIG[pontoStatus] || STATUS_PONTO_CONFIG.pendente;
                  // Deriva badge a partir de tipo_dia (preferencial) e cai
                  // para o status genérico quando não há classificação especial.
                  const obs = ponto.observacao || "";
                  const tipoDia = ponto.tipo_dia;
                  const feriadoNome = ponto.feriado_nome || "";
                  const badge = (() => {
                    // Atestado no dia tem precedência no selo de status, para
                    // consistência: trabalhando ou não o resto do dia, o selo
                    // mostra "Atestado" (as horas trabalhadas seguem na coluna
                    // Total). Evita divergência tipo "Regular" x "Justificado"
                    // entre colaboradores com a mesma situação de atestado.
                    if (atestadosPorCpf.get(onlyDigits(ponto.colaborador_cpf))) {
                      return { label: "Atestado", color: "bg-violet-100 text-violet-800" };
                    }
                    if (tipoDia === "feriado") {
                      return ponto.feriado_trabalhado
                        ? { label: "Feriado trabalhado", color: "bg-amber-100 text-amber-800" }
                        : { label: "Feriado", color: "bg-teal-100 text-teal-800" };
                    }
                    if (tipoDia === "ferias") return { label: "Férias", color: "bg-sky-100 text-sky-800" };
                    if (tipoDia === "atestado") return { label: "Atestado", color: "bg-violet-100 text-violet-800" };
                    if (tipoDia === "afastamento") return { label: "Afastamento", color: "bg-purple-100 text-purple-800" };
                    // Dias abonados (status 'justificado') vindos da consolidação de
                    // atestado/férias/afastamento NÃO setam tipo_dia — deriva o rótulo
                    // pelo prefixo da observação ('Atestado: ...', 'Férias: ...').
                    if (ponto.status === "justificado") {
                      if (/^Atestado/i.test(obs)) return { label: "Atestado", color: "bg-violet-100 text-violet-800" };
                      if (/^Férias/i.test(obs)) return { label: "Férias", color: "bg-sky-100 text-sky-800" };
                      if (/^Afastamento/i.test(obs)) return { label: "Afastamento", color: "bg-purple-100 text-purple-800" };
                    }
                    return statusConfig;
                  })();
                  const badgeTooltip = tipoDia === "feriado"
                    ? (feriadoNome || "Feriado")
                    : (obs || undefined);
                  const cpfKey = onlyDigits(ponto.colaborador_cpf);
                  const marcs = marcacoesPorCpf.get(cpfKey) || [];
                  const atestadoRaw = atestadosPorCpf.get(cpfKey);
                  const atestadoInfo = atestadoRaw ? (() => {
                    const unidade = (atestadoRaw.unidade_afastamento || "dias");
                    let label = "";
                    if (unidade === "horas") {
                      const h = Number(atestadoRaw.horas_afastamento) || 0;
                      const mm = Number(atestadoRaw.minutos_afastamento) || 0;
                      label = mm > 0 ? `${h}h${String(mm).padStart(2, "0")}` : `${h}h`;
                    }
                    const di = (atestadoRaw.data_inicio_afastamento || "").split("-").reverse().join("/");
                    const df = atestadoRaw.data_fim_afastamento
                      ? String(atestadoRaw.data_fim_afastamento).split("-").reverse().join("/") : "";
                    const tooltip = `Atestado${label ? ` (${label})` : ""}: ${di}${df && df !== di ? ` a ${df}` : ""}`;
                    return { label, tooltip };
                  })() : null;
                  // Calcula total a partir dos pares (entrada → saída), independente do label
                  let totalMin = 0;
                  let pendingEntry: string | null = null;
                  for (const m of marcs) {
                    const isEntry = m.tipo === "entrada" || m.tipo === "retorno_almoco";
                    if (isEntry) {
                      pendingEntry = m.hora;
                    } else if (pendingEntry) {
                      const [h1, mi1] = pendingEntry.split(":").map(Number);
                      const [h2, mi2] = m.hora.split(":").map(Number);
                      totalMin += (h2 * 60 + mi2) - (h1 * 60 + mi1);
                      pendingEntry = null;
                    }
                  }
                  const totalLabel = marcs.length > 0
                    ? `${Math.floor(Math.max(0, totalMin) / 60).toString().padStart(2, "0")}h ${(Math.max(0, totalMin) % 60).toString().padStart(2, "0")}min`
                    : formatInterval(ponto.horas_trabalhadas);
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
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {atestadoInfo && (
                            <span
                              className="inline-flex items-center gap-1 self-start rounded-md bg-violet-100 text-violet-800 px-2 py-0.5 text-[11px] font-semibold"
                              title={atestadoInfo.tooltip}
                            >
                              <FileText className="w-3 h-3" /> ATESTADO{atestadoInfo.label ? ` · ${atestadoInfo.label}` : ""}
                            </span>
                          )}
                          {marcs.length === 0 ? (
                            !atestadoInfo && <span className="text-xs text-muted-foreground">Sem marcações</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                            {(() => {
                              // Agrupa em pares: uma ENTRADA abre uma nova linha; a
                              // marcação seguinte (saída) fecha o par na mesma linha.
                              // Saídas órfãs (sem entrada antes) ficam em linha própria.
                              const linhas: typeof marcs[] = [];
                              let atual: typeof marcs = [];
                              for (const m of marcs) {
                                const isEntry = m.tipo === "entrada" || m.tipo === "retorno_almoco";
                                if (isEntry) {
                                  if (atual.length > 0) linhas.push(atual);
                                  atual = [m];
                                } else {
                                  atual.push(m);
                                  linhas.push(atual);
                                  atual = [];
                                }
                              }
                              if (atual.length > 0) linhas.push(atual);
                              return linhas.map((linha, li) => (
                                <div key={li} className="grid grid-cols-2 gap-1.5">
                                  {linha.map((m, idx) => {
                                    const isEntry = m.tipo === "entrada" || m.tipo === "retorno_almoco";
                                    return (
                                      <MarcacaoBadge
                                        key={m.id || `${li}-${idx}`}
                                        id={m.id}
                                        hora={m.hora}
                                        isEntry={isEntry}
                                        original={m.original}
                                        podeEditar={podeEditarMarcacao}
                                        editando={editandoMarcacao}
                                        onSalvar={editarMarcacao}
                                        onExcluir={podeEditarMarcacao ? excluirMarcacao : undefined}
                                        excluindo={excluindoMarcacao}
                                      />
                                    );
                                  })}
                                </div>
                              ));
                            })()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {marcs.length}
                          {marcs.length % 2 !== 0 && <span className="ml-1 text-amber-600">⚠</span>}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium font-mono">{totalLabel}</TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const colab = colaboradores.find(c => (c.cpf || "").replace(/\D/g, "") === onlyDigits(ponto.colaborador_cpf));
                            if (colab) setAjusteColaborador(colab.id);
                            setAjusteData(format(selectedDate, "yyyy-MM-dd"));
                            setAjusteTipo(ponto.status === "ajuste_pendente" ? "correcao" : "inclusao");
                            setShowAjusteModal(true);
                          }}
                          title="Clique para solicitar/ajustar"
                          className="inline-flex"
                        >
                          <Badge className={cn("text-xs cursor-pointer hover:opacity-80 transition", badge.color)} title={badgeTooltip}>{badge.label}</Badge>
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        {/* Ajustes */}
        <TabsContent value="ajustes" className="space-y-5">
          <PontoAjustesTab 
            ajustes={ajustesPendentes}
            processarAjuste={processarAjuste}
            processandoAjuste={processandoAjuste}
            excluirAjuste={excluirAjuste}
            excluindoAjuste={excluindoAjuste}
            setAnexosModalAjuste={setAnexosModalAjuste}
          />

        </TabsContent>


        {/* Escalas */}
        <TabsContent value="escalas"><PontoEscalasTab /></TabsContent>

        {/* Apuração */}
        <TabsContent value="apuracao">
          <Tabs value={apuracaoTab} onValueChange={setApuracaoTab} className="w-full">
            <TabsList className="grid w-full max-w-3xl grid-cols-5 mb-4">
              <TabsTrigger value="banco" className="text-xs"><Wallet className="h-3.5 w-3.5 mr-1" />Banco Horas</TabsTrigger>
              <TabsTrigger value="banco_config" className="text-xs"><Settings className="h-3.5 w-3.5 mr-1" />Config BH</TabsTrigger>
              <TabsTrigger value="fechamento" className="text-xs"><Lock className="h-3.5 w-3.5 mr-1" />Fechamento</TabsTrigger>
              <TabsTrigger value="folha" className="text-xs"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Folha</TabsTrigger>
              <TabsTrigger value="relatorios" className="text-xs"><FileDown className="h-3.5 w-3.5 mr-1" />Relatórios</TabsTrigger>
            </TabsList>
            <TabsContent value="banco"><PontoBancoHorasTab /></TabsContent>
            <TabsContent value="banco_config"><PontoBancoHorasConfigTab /></TabsContent>
            <TabsContent value="fechamento"><PontoFechamentoTab /></TabsContent>
            <TabsContent value="folha"><PontoFolhaTab /></TabsContent>
            <TabsContent value="relatorios"><PontoRelatoriosTab /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance">
          <Tabs value={complianceTab} onValueChange={setComplianceTab} className="w-full">
            <TabsList className="grid w-full max-w-xl grid-cols-3 mb-4">
              <TabsTrigger value="alertas" className="text-xs"><Bell className="h-3.5 w-3.5 mr-1" />Alertas CLT</TabsTrigger>
              <TabsTrigger value="acordos" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Acordos</TabsTrigger>
              <TabsTrigger value="cct" className="text-xs"><Scale className="h-3.5 w-3.5 mr-1" />CCT</TabsTrigger>
            </TabsList>
            <TabsContent value="alertas"><PontoAlertasTab /></TabsContent>
            <TabsContent value="acordos"><PontoAcordosTab /></TabsContent>
            <TabsContent value="cct"><PontoCCTTab /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* Configurações */}
        <TabsContent value="configuracoes">
          <Tabs value={configTab} onValueChange={setConfigTab} className="w-full">
            <TabsList className="grid w-full max-w-xl grid-cols-4 mb-4">
              <TabsTrigger value="config" className="text-xs"><Settings className="h-3.5 w-3.5 mr-1" />Geral</TabsTrigger>
              <TabsTrigger value="links" className="text-xs"><Link2 className="h-3.5 w-3.5 mr-1" />Links</TabsTrigger>
              <TabsTrigger value="repc" className="text-xs"><HardDrive className="h-3.5 w-3.5 mr-1" />REP-C</TabsTrigger>
              <TabsTrigger value="feriados" className="text-xs"><CalendarDays className="h-3.5 w-3.5 mr-1" />Feriados</TabsTrigger>
            </TabsList>
            <TabsContent value="config"><PontoConfigTab /></TabsContent>
            <TabsContent value="links"><PontoLinksTab /></TabsContent>
            <TabsContent value="repc"><PontoRepCTab /></TabsContent>
            <TabsContent value="feriados">
              <Tabs defaultValue="lista" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="lista" className="text-xs"><CalendarDays className="h-3.5 w-3.5 mr-1" />Lista</TabsTrigger>
                  <TabsTrigger value="excecoes" className="text-xs"><UserCheck className="h-3.5 w-3.5 mr-1" />Exceções por colaborador</TabsTrigger>
                </TabsList>
                <TabsContent value="lista"><PontoFeriadosTab /></TabsContent>
                <TabsContent value="excecoes"><PontoFeriadoExcecoesTab /></TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </TabsContent>
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
                  const esperado = tipo === proximoTipoEsperado;
                  return (
                    <Button
                      key={tipo}
                      type="button"
                      variant={tipoMarcacao === tipo ? "default" : "outline"}
                      className={cn("justify-start", !esperado && tipoMarcacao !== tipo && "opacity-50")}
                      onClick={() => setTipoMarcacao(tipo)}
                      disabled={!esperado}
                    >
                      {tipo === "entrada" ? <LogIn className="w-4 h-4 mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                      {TIPO_MARCACAO_LABELS[tipo]}
                      {!esperado && <Lock className="w-3.5 h-3.5 ml-auto text-muted-foreground" />}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center py-1">
                {proximoTipoEsperado === "entrada"
                  ? marcacoesColaboradorHoje.length === 0
                    ? "Primeira marcação do dia: Entrada"
                    : "Jornada fechada — a próxima marcação é uma Entrada"
                  : "Jornada em aberto — a próxima marcação é uma Saída"}
                {marcacoesColaboradorHoje.length > 0 && ` · ${marcacoesColaboradorHoje.length} marcação(ões) hoje`}
              </p>
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
            <Button onClick={handleRegistrarPonto} disabled={!selectedColaborador || registrandoPonto || tipoMarcacao !== proximoTipoEsperado}>
              {registrandoPonto ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Solicitar Ajuste (Folha Mensal) */}
      <SolicitarAjusteFolhaInterno
        open={showAjusteModal}
        onOpenChange={handleCloseAjusteModal}
        colaboradores={colaboradores}
        tenantId={tenantIdAtivo}
        empresaAtivaId={empresaAtivaId}
        colaboradorIdInicial={ajusteColaborador}
      />


      <GuiaRapidoPonto open={showGuia} onOpenChange={setShowGuia} />
      <AnexosAjusteModal ajuste={anexosModalAjuste} onOpenChange={(o) => !o && setAnexosModalAjuste(null)} />
    </div>
  );
};

export default Ponto;
