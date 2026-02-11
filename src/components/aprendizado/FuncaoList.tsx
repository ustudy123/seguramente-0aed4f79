import { Search, Briefcase, ClipboardList, Brain, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Cargo {
  id: string;
  nome: string;
  nivel: string | null;
  departamento_id: string | null;
  descricao: string | null;
}

interface FuncaoListProps {
  cargos: Cargo[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}

export function FuncaoList({ cargos, isLoading, onSelect }: FuncaoListProps) {
  const [search, setSearch] = useState("");
  const { tenantId } = useAuth();

  // Count activities and competencies per cargo
  const { data: atividadeCounts = {} } = useQuery({
    queryKey: ["funcao_atividades_count", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await supabase
        .from("funcao_atividades" as never)
        .select("cargo_id")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string }[] | null; error: Error | null };
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d) => { counts[d.cargo_id] = (counts[d.cargo_id] || 0) + 1; });
      return counts;
    },
    enabled: !!tenantId,
  });

  const { data: competenciaCounts = {} } = useQuery({
    queryKey: ["funcao_competencias_count", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await supabase
        .from("funcao_competencias" as never)
        .select("cargo_id")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string }[] | null; error: Error | null };
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d) => { counts[d.cargo_id] = (counts[d.cargo_id] || 0) + 1; });
      return counts;
    },
    enabled: !!tenantId,
  });

  const { data: epiCounts = {} } = useQuery({
    queryKey: ["funcao_epi_count", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await supabase
        .from("funcao_epi_vinculacoes" as never)
        .select("cargo_id")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string }[] | null; error: Error | null };
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d) => { counts[d.cargo_id] = (counts[d.cargo_id] || 0) + 1; });
      return counts;
    },
    enabled: !!tenantId,
  });

  const filtered = cargos.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.nivel || "").toLowerCase().includes(search.toLowerCase())
  );

  const nivelLabel: Record<string, string> = {
    operacional: "Operacional",
    tatico: "Tático",
    estrategico: "Estratégico",
  };

  const nivelColor: Record<string, string> = {
    operacional: "bg-blue-100 text-blue-800",
    tatico: "bg-amber-100 text-amber-800",
    estrategico: "bg-purple-100 text-purple-800",
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar funções..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma função cadastrada.</p>
          <p className="text-sm">Cadastre funções em Cadastros → Funções para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((cargo) => (
            <Card
              key={cargo.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => onSelect(cargo.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{cargo.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {cargo.nivel && (
                        <Badge variant="secondary" className={`text-xs ${nivelColor[cargo.nivel] || ""}`}>
                          {nivelLabel[cargo.nivel] || cargo.nivel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1" title="Atividades">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {atividadeCounts[cargo.id] || 0}
                  </span>
                  <span className="flex items-center gap-1" title="Competências">
                    <Brain className="w-3.5 h-3.5" />
                    {competenciaCounts[cargo.id] || 0}
                  </span>
                  <span className="flex items-center gap-1" title="EPIs">
                    <Shield className="w-3.5 h-3.5" />
                    {epiCounts[cargo.id] || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
