import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Shield,
  Database,
  Server,
  LayoutGrid,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Bug,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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

const SCAN_CATEGORIES = [
  {
    id: "dados",
    label: "Dados & Integridade",
    icon: Database,
    description: "Verifica integridade referencial, perfis órfãos, dados incompletos, inconsistências em admissões e atestados.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
  },
  {
    id: "seguranca",
    label: "Segurança & RLS",
    icon: Shield,
    description: "Testa acesso anônimo a tabelas sensíveis, verifica políticas RLS, analisa distribuição de roles e superadmins.",
    color: "text-red-500",
    bgColor: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20",
  },
  {
    id: "edge_functions",
    label: "Edge Functions",
    icon: Server,
    description: "Testa disponibilidade e resposta de todas as edge functions: IA, onboarding, notificações e integrações.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
  },
  {
    id: "modulos",
    label: "Módulos do Sistema",
    icon: LayoutGrid,
    description: "Verifica campanhas psicossociais, estoque EPIs, afastamentos, ASOs pendentes, alertas de ponto e documentos.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
  },
  {
    id: "todos",
    label: "Varredura Completa",
    icon: Zap,
    description: "Executa TODAS as verificações acima em sequência. Gera relatório completo com análise de IA.",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20",
  },
];

const severityConfig = {
  critico: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100 text-red-700 border-red-200", label: "Crítico" },
  alto: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-100 text-orange-700 border-orange-200", label: "Alto" },
  medio: { icon: Info, color: "text-amber-500", bg: "bg-amber-100 text-amber-700 border-amber-200", label: "Médio" },
  baixo: { icon: Info, color: "text-blue-500", bg: "bg-blue-100 text-blue-700 border-blue-200", label: "Baixo" },
  info: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Info" },
};

export default function QADashboard() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());

  const runScan = async (categoria: string) => {
    setScanning(categoria);
    setResult(null);
    setExpandedFindings(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("ai-qa-scan", {
        body: { categoria },
      });

      if (error) throw error;
      setResult(data as ScanResult);

      if (data.criticos > 0) {
        toast.error(`Varredura concluída: ${data.criticos} problemas críticos encontrados`);
      } else if (data.altos > 0) {
        toast.warning(`Varredura concluída: ${data.altos} problemas de alta severidade`);
      } else {
        toast.success("Varredura concluída sem problemas críticos");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar varredura");
    } finally {
      setScanning(null);
    }
  };

  const toggleFinding = (index: number) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const healthScore = result ? Math.max(0, 100 - (result.criticos * 20 + result.altos * 10 + result.medios * 5 + result.baixos * 2)) : null;

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
              Varredura automatizada com inteligência artificial — clique em uma categoria para iniciar
            </p>
          </div>
        </div>

        {/* Scan Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SCAN_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isScanning = scanning === cat.id;
            const isAnyScanning = scanning !== null;

            return (
              <Card
                key={cat.id}
                className={`cursor-pointer transition-all border-2 ${cat.bgColor} ${isAnyScanning && !isScanning ? "opacity-50" : ""} ${cat.id === "todos" ? "md:col-span-2 lg:col-span-1" : ""}`}
                onClick={() => !isAnyScanning && runScan(cat.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-3 rounded-xl bg-background/80 ${cat.color}`}>
                      {isScanning ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{cat.label}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {cat.description}
                      </p>
                      {isScanning && (
                        <p className="text-xs text-primary mt-2 font-medium animate-pulse">
                          Executando varredura...
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {healthScore !== null && (
                <Card className="col-span-2 md:col-span-1">
                  <CardContent className="p-4 text-center">
                    <Activity className={`w-6 h-6 mx-auto ${healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-red-500"}`} />
                    <p className={`text-2xl font-bold mt-1 ${healthScore >= 80 ? "text-emerald-600" : healthScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {healthScore}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Saúde</p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{result.criticos}</p>
                  <p className="text-[10px] text-muted-foreground">Críticos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-500">{result.altos}</p>
                  <p className="text-[10px] text-muted-foreground">Altos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.medios}</p>
                  <p className="text-[10px] text-muted-foreground">Médios</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">{result.baixos}</p>
                  <p className="text-[10px] text-muted-foreground">Baixos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{result.info}</p>
                  <p className="text-[10px] text-muted-foreground">Info</p>
                </CardContent>
              </Card>
            </div>

            {/* AI Summary */}
            {result.ai_summary && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Análise da IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{result.ai_summary}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Findings List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {result.total_findings} findings encontrados
                  <span className="text-muted-foreground font-normal ml-2">
                    {new Date(result.timestamp).toLocaleString("pt-BR")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.findings
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
                                <Badge variant="outline" className={`text-[10px] ${config.bg}`}>
                                  {config.label}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">
                                  {finding.modulo}
                                </Badge>
                              </div>
                            </div>
                            {finding.sugestao && (
                              isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
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
      </div>
    </div>
  );
}
