import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, Database, Server, LayoutGrid, Zap,
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp,
  Loader2, Bug, Activity, Play, Bot, Clock, CheckCircle2,
  XCircle, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuthContext } from "@/contexts/AuthContext";

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface Finding {
  categoria: string;
  severidade: "critico" | "alto" | "medio" | "baixo" | "info";
  titulo: string;
  descricao: string;
  sugestao: string;
  modulo: string;
}

interface ScanResult {
  success: boolean;
  categoria: string;
  timestamp: string;
  total_findings: number;
  criticos: number;
  altos: number;
  medios: number;
  baixos: number;
  info: number;
  findings: Finding[];
  ai_summary: string;
}

interface StepResult {
  step: string;
  action: string;
  status: "success" | "fail" | "warning";
  details: string;
  duration_ms: number;
}

interface FlowResult {
  flow: string;
  flow_label: string;
  steps: StepResult[];
  passed: number;
  failed: number;
  warnings: number;
  total_duration_ms: number;
}

interface AgentResult {
  success: boolean;
  timestamp: string;
  total_flows: number;
  total_steps: number;
  total_passed: number;
  total_failed: number;
  score: number;
  flows: FlowResult[];
  ai_report: string;
}

// Live streaming state
interface LiveStep {
  flow: string;
  step: string;
  action: string;
  status: "running" | "success" | "fail" | "warning";
  details?: string;
  duration_ms?: number;
}

interface LiveFlow {
  flow: string;
  label: string;
  status: "running" | "done";
  steps: LiveStep[];
}

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const SCAN_CATEGORIES = [
  { id: "dados", label: "Dados & Integridade", icon: Database, description: "Verifica integridade referencial, perfis órfãos, dados incompletos, inconsistências em admissões e atestados.", color: "text-blue-500", bgColor: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20" },
  { id: "seguranca", label: "Segurança & RLS", icon: Shield, description: "Testa acesso anônimo a tabelas sensíveis, verifica políticas RLS, analisa distribuição de roles e superadmins.", color: "text-red-500", bgColor: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20" },
  { id: "edge_functions", label: "Edge Functions", icon: Server, description: "Testa disponibilidade e resposta de todas as edge functions: IA, onboarding, notificações e integrações.", color: "text-purple-500", bgColor: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20" },
  { id: "modulos", label: "Módulos do Sistema", icon: LayoutGrid, description: "Verifica campanhas psicossociais, estoque EPIs, afastamentos, ASOs pendentes, alertas de ponto e documentos.", color: "text-amber-500", bgColor: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20" },
  { id: "todos", label: "Varredura Completa", icon: Zap, description: "Executa TODAS as verificações acima em sequência. Gera relatório completo com análise de IA.", color: "text-emerald-500", bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20" },
];

const AGENT_FLOWS = [
  { id: "admissao", label: "Admissão Completa", icon: "👤", description: "Cria, verifica, atualiza e exclui uma admissão completa com documentos.", steps: 6 },
  { id: "atestado", label: "Atestado Médico", icon: "🏥", description: "Registra atestado, valida campos, adiciona CID e limpa.", steps: 4 },
  { id: "epi", label: "EPI (Entrega + Estoque)", icon: "🦺", description: "Cria EPI, registra entrega, verifica trigger de baixa de estoque.", steps: 5 },
  { id: "plano_acao", label: "Plano de Ação", icon: "📋", description: "Cria ação, adiciona tarefa, conclui e verifica trigger de progresso.", steps: 5 },
  { id: "rls_isolamento", label: "Isolamento Multi-Tenant", icon: "🔒", description: "Testa acesso anônimo e verifica integridade do isolamento por tenant.", steps: 3 },
  { id: "edge_functions", label: "Health Check Functions", icon: "⚡", description: "Pinga todas as edge functions e verifica disponibilidade.", steps: 11 },
  { id: "todos", label: "Executar TODOS os Fluxos", icon: "🚀", description: "Roda todos os fluxos acima em sequência. Gera relatório completo com IA.", steps: 34 },
];

const severityConfig = {
  critico: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100 text-red-700 border-red-200", label: "Crítico" },
  alto: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-100 text-orange-700 border-orange-200", label: "Alto" },
  medio: { icon: Info, color: "text-amber-500", bg: "bg-amber-100 text-amber-700 border-amber-200", label: "Médio" },
  baixo: { icon: Info, color: "text-blue-500", bg: "bg-blue-100 text-blue-700 border-blue-200", label: "Baixo" },
  info: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Info" },
};

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export default function QADashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthContext();

  // Scan state
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

  // Agent state
  const [agentRunning, setAgentRunning] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());

  // Live streaming state
  const [liveFlows, setLiveFlows] = useState<LiveFlow[]>([]);
  const [liveMessage, setLiveMessage] = useState<string>("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const liveContainerRef = useRef<HTMLDivElement>(null);

  // ── Scan handlers ──
  const runScan = async (categoria: string) => {
    setScanning(categoria);
    setScanResult(null);
    setExpandedFindings(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("ai-qa-scan", { body: { categoria } });
      if (error) throw error;
      setScanResult(data as ScanResult);
      if (data.criticos > 0) toast.error(`Varredura: ${data.criticos} problemas críticos`);
      else if (data.altos > 0) toast.warning(`Varredura: ${data.altos} problemas altos`);
      else toast.success("Varredura concluída sem problemas críticos");
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar varredura");
    } finally {
      setScanning(null);
    }
  };

  // ── Agent handlers (streaming) ──
  const runAgent = async (flow: string) => {
    setAgentRunning(flow);
    setAgentResult(null);
    setExpandedFlows(new Set());
    setLiveFlows([]);
    setLiveMessage("Conectando ao agente...");
    setIsGeneratingReport(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "diayjpsrcerycycyaxst";
      const url = `https://${projectId}.supabase.co/functions/v1/ai-qa-agent`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({ flow, tenantId: profile?.tenant_id, stream: true }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream não disponível");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(currentEvent, data);
            } catch { /* skip bad json */ }
            currentEvent = "";
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar agente");
      setLiveMessage("");
    } finally {
      setAgentRunning(null);
      setLiveMessage("");
      setIsGeneratingReport(false);
    }
  };

  const handleSSEEvent = (event: string, data: any) => {
    switch (event) {
      case "flow_start":
        setLiveFlows(prev => [...prev, {
          flow: data.flow,
          label: data.label,
          status: "running",
          steps: [],
        }]);
        setLiveMessage(`▶ ${data.label}`);
        break;

      case "step_start":
        setLiveFlows(prev => prev.map(f =>
          f.flow === data.flow
            ? {
              ...f,
              steps: [...f.steps, {
                flow: data.flow,
                step: data.step,
                action: data.action,
                status: "running" as const,
              }],
            }
            : f
        ));
        setLiveMessage(`⏳ ${data.step} — ${data.action}`);
        break;

      case "step_done":
        setLiveFlows(prev => prev.map(f =>
          f.flow === data.flow
            ? {
              ...f,
              steps: f.steps.map(s =>
                s.step === data.step
                  ? { ...s, status: data.status, details: data.details, duration_ms: data.duration_ms }
                  : s
              ),
            }
            : f
        ));
        setLiveMessage(
          data.status === "success"
            ? `✅ ${data.step} — ${data.duration_ms}ms`
            : `❌ ${data.step} — ${data.details?.slice(0, 60)}`
        );
        break;

      case "flow_done":
        setLiveFlows(prev => prev.map(f =>
          f.flow === data.flow ? { ...f, status: "done" } : f
        ));
        break;

      case "ai_start":
        setIsGeneratingReport(true);
        setLiveMessage("🤖 Gerando relatório com IA...");
        break;

      case "complete":
        setAgentResult(data as AgentResult);
        setExpandedFlows(new Set(data.flows?.map((f: FlowResult) => f.flow) || []));
        if (data.total_failed > 0) toast.error(`Agente: ${data.total_failed} testes falharam`);
        else toast.success(`Agente: todos os ${data.total_passed} testes passaram ✓`);
        break;
    }

    // Auto-scroll
    setTimeout(() => {
      liveContainerRef.current?.scrollTo({
        top: liveContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  const toggleFinding = (i: number) => setExpandedFindings(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleFlow = (f: string) => setExpandedFlows(p => { const n = new Set(p); n.has(f) ? n.delete(f) : n.add(f); return n; });

  const healthScore = scanResult ? Math.max(0, 100 - (scanResult.criticos * 20 + scanResult.altos * 10 + scanResult.medios * 5 + scanResult.baixos * 2)) : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Bug className="w-8 h-8 text-primary" />
              QA & Testes com IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Varredura automatizada e agente de QA programático
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="agent" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="agent" className="gap-2">
              <Bot className="w-4 h-4" /> Agente de QA
            </TabsTrigger>
            <TabsTrigger value="scan" className="gap-2">
              <Database className="w-4 h-4" /> Varredura
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════ */}
          {/* TAB: AGENTE DE QA */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="agent" className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <Bot className="w-6 h-6 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Agente de QA Programático — Tempo Real</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    O agente executa ações reais no banco de dados simulando o comportamento de um usuário.
                    Acompanhe cada passo sendo executado em tempo real na tela.
                    <strong> Todos os dados de teste são removidos automaticamente.</strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Flow buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {AGENT_FLOWS.map((f) => {
                const isRunning = agentRunning === f.id;
                const isAnyRunning = agentRunning !== null;
                return (
                  <Card
                    key={f.id}
                    className={`cursor-pointer transition-all border hover:shadow-md ${
                      isAnyRunning && !isRunning ? "opacity-50 pointer-events-none" : ""
                    } ${f.id === "todos" ? "border-primary/30 bg-primary/5" : ""}`}
                    onClick={() => !isAnyRunning && runAgent(f.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{f.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{f.label}</h3>
                            <Badge variant="secondary" className="text-[10px]">{f.steps} steps</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                          {isRunning && (
                            <div className="flex items-center gap-2 mt-2 text-primary">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span className="text-xs font-medium animate-pulse">Executando...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ═══ LIVE TERMINAL ═══ */}
            {(agentRunning || (liveFlows.length > 0 && !agentResult)) && (
              <Card className="border-primary/30 overflow-hidden">
                <CardHeader className="pb-2 bg-muted/30">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary animate-pulse" />
                    Execução em Tempo Real
                    {liveMessage && (
                      <span className="text-xs font-normal text-muted-foreground ml-2 truncate max-w-[400px]">
                        {liveMessage}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    ref={liveContainerRef}
                    className="max-h-[400px] overflow-y-auto bg-slate-950 text-slate-100 p-4 font-mono text-xs space-y-1"
                  >
                    {liveFlows.map((liveFlow) => (
                      <div key={liveFlow.flow} className="mb-3">
                        <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                          {liveFlow.status === "running" ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          )}
                          <span>═══ {liveFlow.label} ═══</span>
                        </div>
                        {liveFlow.steps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 pl-4">
                            {step.status === "running" ? (
                              <Loader2 className="w-3 h-3 animate-spin text-blue-400 mt-0.5 shrink-0" />
                            ) : step.status === "success" ? (
                              <span className="text-emerald-400 shrink-0">✓</span>
                            ) : step.status === "fail" ? (
                              <span className="text-red-400 shrink-0">✗</span>
                            ) : (
                              <span className="text-amber-400 shrink-0">⚠</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`${
                                step.status === "running" ? "text-blue-300" :
                                step.status === "success" ? "text-emerald-300" :
                                step.status === "fail" ? "text-red-300" : "text-amber-300"
                              }`}>
                                {step.step}
                              </span>
                              <span className="text-slate-500 ml-2">{step.action}</span>
                              {step.duration_ms !== undefined && (
                                <span className="text-slate-600 ml-2">{step.duration_ms}ms</span>
                              )}
                              {step.details && (
                                <div className={`text-[10px] mt-0.5 ${
                                  step.status === "fail" ? "text-red-400/80" : "text-slate-500"
                                }`}>
                                  → {step.details.slice(0, 120)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {isGeneratingReport && (
                      <div className="flex items-center gap-2 text-primary pt-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Gerando relatório com IA...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Results */}
            {agentResult && (
              <div className="space-y-4">
                {/* Score header */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className={`col-span-2 md:col-span-1 ${agentResult.score >= 80 ? "border-emerald-300 bg-emerald-50" : agentResult.score >= 50 ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
                    <CardContent className="p-4 text-center">
                      <Activity className={`w-6 h-6 mx-auto ${agentResult.score >= 80 ? "text-emerald-600" : agentResult.score >= 50 ? "text-amber-600" : "text-red-600"}`} />
                      <p className={`text-3xl font-bold mt-1 ${agentResult.score >= 80 ? "text-emerald-700" : agentResult.score >= 50 ? "text-amber-700" : "text-red-700"}`}>
                        {agentResult.score}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Score</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{agentResult.total_flows}</p>
                      <p className="text-[10px] text-muted-foreground">Fluxos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{agentResult.total_steps}</p>
                      <p className="text-[10px] text-muted-foreground">Steps</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{agentResult.total_passed}</p>
                      <p className="text-[10px] text-muted-foreground">Passou</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{agentResult.total_failed}</p>
                      <p className="text-[10px] text-muted-foreground">Falhou</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Flow details */}
                {agentResult.flows.map((flow) => {
                  const isExpanded = expandedFlows.has(flow.flow);
                  const allPassed = flow.failed === 0;
                  return (
                    <Card key={flow.flow} className={`border ${allPassed ? "border-emerald-200" : "border-red-200"}`}>
                      <Collapsible open={isExpanded} onOpenChange={() => toggleFlow(flow.flow)}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {allPassed ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-600" />
                                )}
                                <div>
                                  <CardTitle className="text-sm">{flow.flow_label}</CardTitle>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant={allPassed ? "default" : "destructive"} className="text-[10px]">
                                      {flow.passed}/{flow.steps.length} passou
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {flow.total_duration_ms}ms
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              {flow.steps.map((step, i) => (
                                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                                  step.status === "success" ? "bg-emerald-50/50" : step.status === "fail" ? "bg-red-50/50" : "bg-amber-50/50"
                                }`}>
                                  {step.status === "success" ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                  ) : step.status === "fail" ? (
                                    <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm">{step.step}</span>
                                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{step.action}</code>
                                      <span className="text-[10px] text-muted-foreground">{step.duration_ms}ms</span>
                                    </div>
                                    <p className={`text-xs mt-0.5 ${step.status === "fail" ? "text-red-700" : "text-muted-foreground"}`}>
                                      {step.details}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}

                {/* AI Report */}
                {agentResult.ai_report && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary" />
                        Relatório do Agente de QA (IA)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-foreground">
                        <ReactMarkdown>{agentResult.ai_report}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════ */}
          {/* TAB: VARREDURA (existing scan) */}
          {/* ═══════════════════════════════════════════ */}
          <TabsContent value="scan" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCAN_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isScanning = scanning === cat.id;
                const isAnyScanning = scanning !== null;
                return (
                  <Card
                    key={cat.id}
                    className={`cursor-pointer transition-all border-2 ${cat.bgColor} ${isAnyScanning && !isScanning ? "opacity-50" : ""}`}
                    onClick={() => !isAnyScanning && runScan(cat.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className={`p-3 rounded-xl bg-background/80 ${cat.color}`}>
                          {isScanning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Icon className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{cat.label}</h3>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cat.description}</p>
                          {isScanning && <p className="text-xs text-primary mt-2 font-medium animate-pulse">Executando varredura...</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Scan Results */}
            {scanResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {healthScore !== null && (
                    <Card className="col-span-2 md:col-span-1">
                      <CardContent className="p-4 text-center">
                        <Activity className={`w-6 h-6 mx-auto ${healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-red-500"}`} />
                        <p className={`text-2xl font-bold mt-1 ${healthScore >= 80 ? "text-emerald-600" : healthScore >= 50 ? "text-amber-600" : "text-red-600"}`}>{healthScore}</p>
                        <p className="text-[10px] text-muted-foreground">Saúde</p>
                      </CardContent>
                    </Card>
                  )}
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{scanResult.criticos}</p><p className="text-[10px] text-muted-foreground">Críticos</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-orange-500">{scanResult.altos}</p><p className="text-[10px] text-muted-foreground">Altos</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{scanResult.medios}</p><p className="text-[10px] text-muted-foreground">Médios</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-500">{scanResult.baixos}</p><p className="text-[10px] text-muted-foreground">Baixos</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-500">{scanResult.info}</p><p className="text-[10px] text-muted-foreground">Info</p></CardContent></Card>
                </div>

                {scanResult.ai_summary && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Análise da IA</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-foreground">
                        <ReactMarkdown>{scanResult.ai_summary}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      {scanResult.total_findings} findings
                      <span className="text-muted-foreground font-normal ml-2">{new Date(scanResult.timestamp).toLocaleString("pt-BR")}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {scanResult.findings
                      .sort((a, b) => {
                        const order = { critico: 0, alto: 1, medio: 2, baixo: 3, info: 4 };
                        return order[a.severidade] - order[b.severidade];
                      })
                      .map((finding, i) => {
                        const config = severityConfig[finding.severidade];
                        const SevIcon = config.icon;
                        const isExpanded = expandedFindings.has(i);
                        return (
                          <Collapsible key={i} open={isExpanded} onOpenChange={() => toggleFinding(i)}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                                <SevIcon className={`w-4 h-4 shrink-0 ${config.color}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">{finding.titulo}</span>
                                    <Badge variant="outline" className={`text-[10px] ${config.bg}`}>{config.label}</Badge>
                                    <Badge variant="secondary" className="text-[10px]">{finding.modulo}</Badge>
                                  </div>
                                </div>
                                {finding.sugestao && (isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
                              </div>
                            </CollapsibleTrigger>
                            {finding.sugestao && (
                              <CollapsibleContent>
                                <div className="ml-7 pl-4 pb-3 border-l-2 border-muted space-y-1">
                                  <p className="text-sm text-muted-foreground">{finding.descricao}</p>
                                  <p className="text-sm text-primary font-medium">💡 {finding.sugestao}</p>
                                </div>
                              </CollapsibleContent>
                            )}
                          </Collapsible>
                        );
                      })}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
