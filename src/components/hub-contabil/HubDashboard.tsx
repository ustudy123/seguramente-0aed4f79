import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Receipt, ShieldCheck, AlertTriangle, CheckCircle2, Clock, FileText, TrendingDown, Users } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

interface Props { hub: any; }

const statusColors: Record<string, string> = {
  em_preparacao: "bg-yellow-100 text-yellow-800",
  enviado: "bg-blue-100 text-blue-800",
  em_processamento: "bg-purple-100 text-purple-800",
  em_conferencia: "bg-orange-100 text-orange-800",
  aprovado: "bg-green-100 text-green-800",
  finalizado: "bg-emerald-100 text-emerald-800",
  reaberto: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  em_preparacao: "Em Preparação",
  enviado: "Enviado",
  em_processamento: "Em Processamento",
  em_conferencia: "Em Conferência",
  aprovado: "Aprovado",
  finalizado: "Finalizado",
  reaberto: "Reaberto",
};

export function HubDashboard({ hub }: Props) {
  const { competencias, guias, certidoes, documentos, loading } = hub;

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const compAtual = competencias.find((c: any) => c.competencia === mesAtual);

  const guiasPendentes = guias.filter((g: any) => g.status === "pendente");
  const guiasVencidas = guias.filter((g: any) => g.status === "vencida");
  const guiasVencendo = guiasPendentes.filter((g: any) => differenceInDays(parseISO(g.data_vencimento), now) <= 7);

  const cndsVencendo = certidoes.filter((c: any) => c.status === "a_vencer");
  const cndsVencidas = certidoes.filter((c: any) => c.status === "vencida");

  const docsEsteMes = documentos.filter((d: any) => d.competencia === mesAtual);

  // Risco trabalhista simples
  const riscos: string[] = [];
  if (guiasVencidas.length > 0) riscos.push(`${guiasVencidas.length} guia(s) vencida(s)`);
  if (cndsVencidas.length > 0) riscos.push(`${cndsVencidas.length} CND(s) vencida(s)`);
  if (compAtual?.status === "reaberto") riscos.push("Competência reaberta");
  const nivelRisco = riscos.length === 0 ? "baixo" : riscos.length <= 2 ? "medio" : "alto";

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Competência Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{mesAtual}</p>
            {compAtual ? (
              <Badge className={statusColors[compAtual.status]}>{statusLabels[compAtual.status]}</Badge>
            ) : (
              <p className="text-xs text-muted-foreground">Não iniciada</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Guias Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{guiasPendentes.length}</p>
            {guiasVencendo.length > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {guiasVencendo.length} vencendo em 7 dias</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Certidões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{certidoes.length}</p>
            {cndsVencendo.length > 0 && <p className="text-xs text-amber-600">{cndsVencendo.length} a vencer</p>}
            {cndsVencidas.length > 0 && <p className="text-xs text-destructive">{cndsVencidas.length} vencidas</p>}
            {cndsVencendo.length === 0 && cndsVencidas.length === 0 && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Regulares</p>}
          </CardContent>
        </Card>

        <Card className={nivelRisco === "alto" ? "border-destructive" : nivelRisco === "medio" ? "border-amber-400" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Risco Trabalhista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${nivelRisco === "alto" ? "text-destructive" : nivelRisco === "medio" ? "text-amber-600" : "text-emerald-600"}`}>
              {nivelRisco === "baixo" ? "Baixo" : nivelRisco === "medio" ? "Médio" : "Alto"}
            </p>
            {riscos.length > 0 ? (
              <div className="space-y-0.5">
                {riscos.map((r, i) => <p key={i} className="text-xs text-muted-foreground">• {r}</p>)}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Tudo em dia</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas urgentes */}
      {(guiasVencidas.length > 0 || cndsVencidas.length > 0) && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alertas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {guiasVencidas.map((g: any) => (
              <p key={g.id} className="text-sm">⚠️ Guia <strong>{g.tipo?.toUpperCase()}</strong> ({g.competencia}) vencida em {format(parseISO(g.data_vencimento), "dd/MM/yyyy")} — R$ {Number(g.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            ))}
            {cndsVencidas.map((c: any) => (
              <p key={c.id} className="text-sm">⚠️ CND <strong>{c.tipo}</strong> vencida em {format(parseISO(c.data_validade), "dd/MM/yyyy")}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Documentos do mês */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos ({mesAtual})</CardTitle>
          </CardHeader>
          <CardContent>
            {docsEsteMes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento neste mês</p>
            ) : (
              <div className="space-y-1.5">
                {docsEsteMes.slice(0, 8).map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between text-sm p-2 rounded border">
                    <span>{d.tipo} {d.colaborador_nome && `— ${d.colaborador_nome}`}</span>
                    <Badge variant="outline" className="text-xs">{d.direcao === "enviado" ? "↑ Enviado" : "↓ Recebido"}</Badge>
                  </div>
                ))}
                {docsEsteMes.length > 8 && <p className="text-xs text-muted-foreground text-center">+{docsEsteMes.length - 8} documentos</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competências recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Últimas Competências</CardTitle>
          </CardHeader>
          <CardContent>
            {competencias.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma competência registrada</p>
            ) : (
              <div className="space-y-2">
                {competencias.slice(0, 6).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{c.competencia}</span>
                    </div>
                    <Badge className={statusColors[c.status] || ""}>{statusLabels[c.status] || c.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
