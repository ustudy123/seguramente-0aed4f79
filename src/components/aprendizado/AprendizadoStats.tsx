import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, AlertTriangle, ClipboardList, Brain, Shield, Wrench, LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { IndicadorDetailModal } from "./IndicadorDetailModal";

interface Cargo {
  id: string;
  nome: string;
  nivel: string | null;
}

interface AprendizadoStatsProps {
  cargos: Cargo[];
}

export function AprendizadoStats({ cargos }: AprendizadoStatsProps) {
  const { tenantId } = useAuth();

  const { data: atividades = [] } = useQuery({
    queryKey: ["all_funcao_atividades", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("funcao_atividades")
        .select("cargo_id, complexidade, classificacao")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string; complexidade: string; classificacao: string }[] | null; error: Error | null };
      if (error) return [];
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: competencias = [] } = useQuery({
    queryKey: ["all_funcao_competencias", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("funcao_competencias")
        .select("cargo_id, tipo")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string; tipo: string }[] | null; error: Error | null };
      if (error) return [];
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: ferramentas = [] } = useQuery({
    queryKey: ["all_funcao_ferramentas", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("funcao_ferramentas")
        .select("atividade_id")
        .eq("tenant_id", tenantId) as { data: { atividade_id: string }[] | null; error: Error | null };
      if (error) return [];
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: conteudos = [] } = useQuery({
    queryKey: ["all_funcao_conteudos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("funcao_conteudos")
        .select("atividade_id")
        .eq("tenant_id", tenantId) as { data: { atividade_id: string }[] | null; error: Error | null };
      if (error) return [];
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Indicators
  const totalAtividades = atividades.length;
  const altaComplexidade = atividades.filter((a) => a.complexidade === "alta").length;
  const criticas = atividades.filter((a) => a.classificacao === "critica").length;

  // Cargos with most tools (ergonomia digital)
  const atividadeIdSet = new Set(atividades.map((a) => `${a.cargo_id}`));
  const totalFerramentas = ferramentas.length;
  const totalConteudos = conteudos.length;

  // Funções sem atividades
  const cargosComAtividades = new Set(atividades.map((a) => a.cargo_id));
  const cargosSemAtividades = cargos.filter((c) => !cargosComAtividades.has(c.id));

  // Funções sem competências
  const cargosComComp = new Set(competencias.map((c) => c.cargo_id));
  const cargosSemCompetencias = cargos.filter((c) => !cargosComComp.has(c.id));

  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  // Build detail data per indicator
  const getDetailData = (key: string) => {
    const cargoMap = new Map(cargos.map((c) => [c.id, c.nome]));
    switch (key) {
      case "total":
        return atividades.map((a) => ({
          cargo: cargoMap.get(a.cargo_id) || "—",
          detalhe: a.classificacao || "—",
          extra: a.complexidade || "—",
        }));
      case "alta":
        return atividades
          .filter((a) => a.complexidade === "alta")
          .map((a) => ({
            cargo: cargoMap.get(a.cargo_id) || "—",
            detalhe: a.classificacao || "—",
            extra: "Alta",
          }));
      case "criticas":
        return atividades
          .filter((a) => a.classificacao === "critica")
          .map((a) => ({
            cargo: cargoMap.get(a.cargo_id) || "—",
            detalhe: "Crítica",
            extra: a.complexidade || "—",
          }));
      case "competencias":
        return competencias.map((c) => ({
          cargo: cargoMap.get(c.cargo_id) || "—",
          detalhe: c.tipo || "—",
        }));
      case "ferramentas":
        return ferramentas.map(() => ({
          cargo: "—",
          detalhe: "Ferramenta vinculada",
        }));
      case "conteudos":
        return conteudos.map(() => ({
          cargo: "—",
          detalhe: "Conteúdo vinculado",
        }));
      default:
        return [];
    }
  };

  const stats = [
    { key: "total", label: "Total de Atividades", value: totalAtividades, icon: ClipboardList, color: "text-primary", columns: [{ label: "Função", key: "cargo" as const }, { label: "Classificação", key: "detalhe" as const }, { label: "Complexidade", key: "extra" as const }] },
    { key: "alta", label: "Complexidade Alta", value: altaComplexidade, icon: AlertTriangle, color: "text-destructive", columns: [{ label: "Função", key: "cargo" as const }, { label: "Classificação", key: "detalhe" as const }, { label: "Complexidade", key: "extra" as const }] },
    { key: "criticas", label: "Atividades Críticas", value: criticas, icon: AlertTriangle, color: "text-warning", columns: [{ label: "Função", key: "cargo" as const }, { label: "Classificação", key: "detalhe" as const }, { label: "Complexidade", key: "extra" as const }] },
    { key: "competencias", label: "Competências", value: competencias.length, icon: Brain, color: "text-accent-foreground", columns: [{ label: "Função", key: "cargo" as const }, { label: "Tipo", key: "detalhe" as const }] },
    { key: "ferramentas", label: "Ferramentas", value: totalFerramentas, icon: Wrench, color: "text-primary", columns: [{ label: "Função", key: "cargo" as const }, { label: "Detalhe", key: "detalhe" as const }] },
    { key: "conteudos", label: "Conteúdos Vinculados", value: totalConteudos, icon: Shield, color: "text-primary", columns: [{ label: "Função", key: "cargo" as const }, { label: "Detalhe", key: "detalhe" as const }] },
  ];

  const activeStat = stats.find((s) => s.key === selectedStat);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card
            key={s.key}
            className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
            onClick={() => setSelectedStat(s.key)}
          >
            <CardContent className="p-4 text-center">
              <s.icon className={`w-6 h-6 mx-auto mb-2 ${s.color}`} />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Funções sem Atividades ({cargosSemAtividades.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {cargosSemAtividades.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todas as funções possuem atividades ✓</p>
            ) : (
              <ul className="text-xs space-y-1">
                {cargosSemAtividades.slice(0, 10).map((c) => (
                  <li key={c.id} className="text-muted-foreground">• {c.nome}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Brain className="w-4 h-4" /> Funções sem Competências ({cargosSemCompetencias.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {cargosSemCompetencias.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todas as funções possuem competências ✓</p>
            ) : (
              <ul className="text-xs space-y-1">
                {cargosSemCompetencias.slice(0, 10).map((c) => (
                  <li key={c.id} className="text-muted-foreground">• {c.nome}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {activeStat && (
        <IndicadorDetailModal
          open={!!selectedStat}
          onOpenChange={(open) => !open && setSelectedStat(null)}
          title={activeStat.label}
          icon={activeStat.icon}
          color={activeStat.color}
          total={activeStat.value}
          items={getDetailData(activeStat.key)}
          columns={activeStat.columns}
        />
      )}
    </div>
  );
}