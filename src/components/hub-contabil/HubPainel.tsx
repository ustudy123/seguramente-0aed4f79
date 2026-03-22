import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, AlertTriangle, CheckCircle2, Clock, Send,
  FileCheck, PenLine, TrendingUp, Users, Plus, ArrowRight,
  Zap, XCircle
} from "lucide-react";
import { HubProcesso } from "@/hooks/useHubProcessos";
import { differenceInHours, parseISO } from "date-fns";

interface Props {
  processos: HubProcesso[];
  loading: boolean;
  onNovoProcesso: () => void;
  onVerProcesso: (id: string) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  aguardando_documentos: { label: "Aguard. Docs", color: "bg-amber-100 text-amber-800" },
  pronto_para_envio: { label: "Pronto p/ Envio", color: "bg-blue-100 text-blue-800" },
  enviado_contabilidade: { label: "Enviado", color: "bg-indigo-100 text-indigo-800" },
  recebido_contabilidade: { label: "Recebido", color: "bg-purple-100 text-purple-800" },
  em_analise: { label: "Em Análise", color: "bg-violet-100 text-violet-800" },
  pendente_complementacao: { label: "Pend. Complementação", color: "bg-orange-100 text-orange-800" },
  processado: { label: "Processado", color: "bg-teal-100 text-teal-800" },
  documentos_devolvidos: { label: "Docs Devolvidos", color: "bg-sky-100 text-sky-800" },
  aguardando_assinatura: { label: "Aguard. Assinatura", color: "bg-yellow-100 text-yellow-800" },
  assinado_parcialmente: { label: "Assinado Parcial", color: "bg-lime-100 text-lime-800" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  erro_integracao: { label: "Erro", color: "bg-destructive/20 text-destructive" },
};

const tipoConfig: Record<string, string> = {
  admissao: "Admissão",
  demissao: "Demissão",
  ferias: "Férias",
  advertencia: "Advertência",
  atestado_afastamento: "Atestado/Afastamento",
  ponto_folha: "Ponto/Folha",
  eventos_variaveis: "Eventos Variáveis",
  solicitacao_geral: "Solicitação Geral",
  alteracao_contratual: "Alt. Contratual",
  mudanca_salarial: "Mudança Salarial",
  cat: "CAT",
  ppp_ltcat: "PPP/LTCAT",
  pro_labore: "Pró-Labore",
};

export function HubPainel({ processos, loading, onNovoProcesso, onVerProcesso }: Props) {
  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  const ativos = processos.filter(p => !["concluido", "cancelado"].includes(p.status));
  const pendDocumentos = processos.filter(p => p.status === "aguardando_documentos");
  const aguardAssinatura = processos.filter(p => ["aguardando_assinatura", "assinado_parcialmente"].includes(p.status));
  const prontos = processos.filter(p => p.status === "pronto_para_envio");
  const concluidos = processos.filter(p => p.status === "concluido");

  // SLA vencidos
  const slaVencidos = ativos.filter(p => {
    if (!p.sla_vencimento) return false;
    return new Date(p.sla_vencimento) < new Date();
  });

  // Últimos processos ativos
  const recentes = ativos.slice(0, 8);

  // Agrupamento por tipo
  const porTipo = processos.reduce<Record<string, number>>((acc, p) => {
    acc[p.tipo] = (acc[p.tipo] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header de ação */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Painel Operacional</h2>
          <p className="text-sm text-muted-foreground">Visão geral dos processos em andamento</p>
        </div>
        <Button onClick={onNovoProcesso} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Solicitação
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ativos.length}</p>
            <p className="text-xs text-muted-foreground">processos ativos</p>
          </CardContent>
        </Card>

        <Card className={pendDocumentos.length > 0 ? "border-amber-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Pend. Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${pendDocumentos.length > 0 ? "text-amber-600" : ""}`}>{pendDocumentos.length}</p>
            <p className="text-xs text-muted-foreground">aguardando docs</p>
          </CardContent>
        </Card>

        <Card className={prontos.length > 0 ? "border-blue-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Pronto p/ Envio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${prontos.length > 0 ? "text-blue-600" : ""}`}>{prontos.length}</p>
            <p className="text-xs text-muted-foreground">para enviar</p>
          </CardContent>
        </Card>

        <Card className={aguardAssinatura.length > 0 ? "border-yellow-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${aguardAssinatura.length > 0 ? "text-yellow-600" : ""}`}>{aguardAssinatura.length}</p>
            <p className="text-xs text-muted-foreground">pendentes</p>
          </CardContent>
        </Card>

        <Card className={slaVencidos.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> SLA Vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${slaVencidos.length > 0 ? "text-destructive" : ""}`}>{slaVencidos.length}</p>
            <p className="text-xs text-muted-foreground">fora do prazo</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas urgentes */}
      {(slaVencidos.length > 0 || pendDocumentos.length > 0) && (
        <div className="space-y-2">
          {slaVencidos.length > 0 && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">⚠️ {slaVencidos.length} processo(s) com SLA vencido</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {slaVencidos.slice(0, 4).map(p => (
                        <button key={p.id} onClick={() => onVerProcesso(p.id)}
                          className="text-xs underline text-destructive hover:opacity-80">
                          {p.codigo} — {p.colaborador_nome || tipoConfig[p.tipo]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Processos recentes */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Processos Ativos
                </CardTitle>
                <span className="text-xs text-muted-foreground">{ativos.length} total</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum processo ativo</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={onNovoProcesso}>
                    Criar primeira solicitação
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {recentes.map(p => (
                    <div key={p.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => onVerProcesso(p.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{p.codigo}</span>
                          <span className="text-sm font-medium truncate">{p.titulo}</span>
                        </div>
                        {p.colaborador_nome && (
                          <p className="text-xs text-muted-foreground">{p.colaborador_nome}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.prioridade === "urgente" && (
                          <span className="text-xs font-medium text-destructive">URGENTE</span>
                        )}
                        <Badge className={`text-xs ${statusConfig[p.status]?.color || ""}`}>
                          {statusConfig[p.status]?.label || p.status}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas por tipo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4" /> Volume por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(porTipo).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo registrado</p>
            ) : (
              Object.entries(porTipo)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([tipo, count]) => (
                  <div key={tipo} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{tipoConfig[tipo] || tipo}</span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                ))
            )}
            <div className="pt-2 border-t mt-2 flex items-center justify-between text-sm font-medium">
              <span>Total</span>
              <span>{processos.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
