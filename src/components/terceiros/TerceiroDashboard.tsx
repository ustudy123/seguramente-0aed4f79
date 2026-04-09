import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle, Clock, XCircle, AlertTriangle, FileText, Users, ShieldAlert } from "lucide-react";
import type { Terceiro } from "@/types/terceiros";

interface Props {
  terceiros: Terceiro[];
}

export function TerceiroDashboard({ terceiros }: Props) {
  const { tenantId } = useAuth();

  // Fetch all docs and trainings for metrics
  const { data: allDocs = [] } = useQuery({
    queryKey: ["terceiro-all-docs", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await fromTable("terceiro_documentos")
        .select("id, status, terceiro_id, trabalhador_id, tipo, data_validade")
        .eq("tenant_id", tenantId);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: allTreins = [] } = useQuery({
    queryKey: ["terceiro-all-treins", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await fromTable("terceiro_treinamentos")
        .select("id, status, terceiro_id, trabalhador_id, tipo, data_validade")
        .eq("tenant_id", tenantId);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: allTrabs = [] } = useQuery({
    queryKey: ["terceiro-all-trabalhadores", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await fromTable("terceiro_trabalhadores")
        .select("id, atividades_risco, terceiro_id")
        .eq("tenant_id", tenantId);
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const ativos = terceiros.length;
  const liberados = terceiros.filter((t) => t.status === "liberado").length;
  const restritos = terceiros.filter((t) => t.status === "restrito").length;
  const bloqueados = terceiros.filter((t) => t.status === "bloqueado").length;
  const comRisco = terceiros.filter((t) => t.atividade_risco).length;
  const pctConforme = ativos > 0 ? Math.round((liberados / ativos) * 100) : 0;

  const docsAVencer = allDocs.filter((d: any) => d.status === "a_vencer").length +
    allTreins.filter((t: any) => t.status === "a_vencer").length;
  const docsVencidos = allDocs.filter((d: any) => d.status === "vencido").length +
    allTreins.filter((t: any) => t.status === "vencido").length;

  const totalTrabalhadores = allTrabs.length;

  // Atividades de risco ranking
  const riscoCount: Record<string, number> = {};
  for (const t of allTrabs) {
    for (const r of (t.atividades_risco || [])) {
      riscoCount[r] = (riscoCount[r] || 0) + 1;
    }
  }
  const topRiscos = Object.entries(riscoCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Terceiros mais recorrentes (by worker count)
  const trabPorTerceiro: Record<string, number> = {};
  for (const t of allTrabs) {
    trabPorTerceiro[t.terceiro_id] = (trabPorTerceiro[t.terceiro_id] || 0) + 1;
  }
  const topTerceiros = Object.entries(trabPorTerceiro)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      nome: terceiros.find((t) => t.id === id)?.razao_social || "—",
      count,
    }));

  const stats = [
    { label: "Terceiros Ativos", value: ativos, icon: Building2, color: "text-primary" },
    { label: "Conformes", value: `${pctConforme}%`, icon: CheckCircle, color: "text-green-600" },
    { label: "Com Restrição", value: restritos, icon: Clock, color: "text-yellow-600" },
    { label: "Bloqueados", value: bloqueados, icon: XCircle, color: "text-destructive" },
    { label: "Trabalhadores", value: totalTrabalhadores, icon: Users, color: "text-primary" },
    { label: "Docs a Vencer", value: docsAVencer, icon: AlertTriangle, color: "text-yellow-600" },
    { label: "Docs Vencidos", value: docsVencidos, icon: ShieldAlert, color: "text-destructive" },
    { label: "Atividade de Risco", value: comRisco, icon: AlertTriangle, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom row: top riscos + top terceiros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topRiscos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Atividades de Maior Risco
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {topRiscos.map(([risco, count]) => (
                <div key={risco} className="flex items-center justify-between text-sm">
                  <span>{risco}</span>
                  <Badge variant="outline">{count} trab.</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {topTerceiros.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1">
                <Building2 className="w-4 h-4" /> Terceiros Mais Recorrentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {topTerceiros.map((t) => (
                <div key={t.nome} className="flex items-center justify-between text-sm">
                  <span className="truncate">{t.nome}</span>
                  <Badge variant="outline">{t.count} trab.</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
