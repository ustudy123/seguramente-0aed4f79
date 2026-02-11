import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, AlertTriangle, ClipboardList, Brain, Shield, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
      const { data, error } = await supabase
        .from("funcao_atividades" as never)
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
      const { data, error } = await supabase
        .from("funcao_competencias" as never)
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
      const { data, error } = await supabase
        .from("funcao_ferramentas" as never)
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
      const { data, error } = await supabase
        .from("funcao_conteudos" as never)
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

  const stats = [
    { label: "Total de Atividades", value: totalAtividades, icon: ClipboardList, color: "text-blue-600" },
    { label: "Complexidade Alta", value: altaComplexidade, icon: AlertTriangle, color: "text-red-600" },
    { label: "Atividades Críticas", value: criticas, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Competências", value: competencias.length, icon: Brain, color: "text-purple-600" },
    { label: "Ferramentas", value: totalFerramentas, icon: Wrench, color: "text-teal-600" },
    { label: "Conteúdos Vinculados", value: totalConteudos, icon: Shield, color: "text-green-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
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
            <CardTitle className="text-sm text-amber-600 flex items-center gap-2">
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
    </div>
  );
}
