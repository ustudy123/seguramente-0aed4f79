import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, BookOpen, BrainCircuit, CheckCircle2,
  FileQuestion, Layers, Zap, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface ErgonomiaContextPanelProps {
  colaboradorNome: string;
  colaboradorCargo?: string;
  cicloNome: string;
  tenantId: string;
  userId: string;
}

export function ErgonomiaContextPanel({
  colaboradorNome,
  colaboradorCargo,
  cicloNome,
  tenantId,
  userId,
}: ErgonomiaContextPanelProps) {
  // Buscar cargo pelo nome
  const { data: cargo } = useQuery({
    queryKey: ["cargo-por-nome", tenantId, colaboradorCargo],
    queryFn: async () => {
      if (!colaboradorCargo) return null;
      const { data } = await supabase
        .from("cargos")
        .select("id, nome, descricao, nivel")
        .eq("tenant_id", tenantId)
        .ilike("nome", colaboradorCargo)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!colaboradorCargo,
  });

  // Buscar atividades da função (para saber se têm POP)
  const { data: atividades = [], isLoading: isLoadingAtiv } = useQuery({
    queryKey: ["funcao-atividades-avd", tenantId, cargo?.id],
    queryFn: async () => {
      if (!cargo?.id) return [];
      const { data } = await (supabase as any)
        .from("funcao_atividades")
        .select("id, nome, complexidade, critico, tem_pop:funcao_pops(id)")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargo.id)
        .eq("ativo", true)
        .order("nome");
      return (data || []) as Array<{
        id: string;
        nome: string;
        complexidade: string | null;
        critico: boolean;
        tem_pop: { id: string }[];
      }>;
    },
    enabled: !!tenantId && !!cargo?.id,
  });

  // Buscar riscos ergonômicos ativos relacionados ao cargo/função
  const { data: riscosErgo = [], isLoading: isLoadingRiscos } = useQuery({
    queryKey: ["ergonomia-riscos-avd", tenantId, colaboradorCargo],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("ergonomia_riscos")
        .select("id, descricao, categoria, nivel_risco, cargo_afetado")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .ilike("cargo_afetado", `%${colaboradorCargo || ""}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!tenantId && !!colaboradorCargo,
  });

  const semPop = atividades.filter(a => !a.tem_pop?.length);
  const altaComplexidade = atividades.filter(
    a => a.complexidade === "alta" || a.complexidade === "muito_alta"
  );
  const criticas = atividades.filter(a => a.critico);

  const isLoading = isLoadingAtiv || isLoadingRiscos;

  const criarAcaoErgonomia = async (tipo: "criar_pop" | "revisar_funcao" | "redistribuir") => {
    const titulos: Record<string, string> = {
      criar_pop: `Criar POP para atividades sem procedimento — ${colaboradorCargo || colaboradorNome}`,
      revisar_funcao: `Revisar descrição da função — ${colaboradorCargo || colaboradorNome}`,
      redistribuir: `Redistribuir tarefas de alta complexidade — ${colaboradorCargo || colaboradorNome}`,
    };
    try {
      await (supabase as any).from("plano_acoes").insert({
        tenant_id: tenantId,
        titulo: titulos[tipo],
        descricao: `Ação gerada a partir da avaliação de desempenho — Ciclo: ${cicloNome}. Colaborador: ${colaboradorNome}.`,
        status: "pendente",
        progresso: 0,
        responsavel_id: userId,
        criado_por: userId,
        origem_modulo: "ergonomia",
        origem_descricao: `🔧 Ergonomia NR-17 — via Avaliação de Desempenho | ${cicloNome}`,
        prioridade: "medio",
        tipo: "melhoria",
        exige_evidencia: false,
        codigo: "",
      });
      toast.success("Ação criada no Plano de Ação com rastreabilidade!");
    } catch (e: any) {
      toast.error("Erro ao criar ação: " + e.message);
    }
  };

  if (!colaboradorCargo) return null;

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const semAlerta = semPop.length === 0 && altaComplexidade.length === 0 && riscosErgo.length === 0;

  return (
    <Card className={semAlerta ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-warning" />
          Contexto Ergonômico NR-17
          <Badge variant="outline" className="text-[10px] ml-auto">Não diagnóstico</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Função: <strong>{colaboradorCargo}</strong>
          {cargo?.nivel && <span> · Nível: {cargo.nivel}</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {semAlerta && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Sem alertas ergonômicos identificados para esta função.</span>
          </div>
        )}

        {/* Atividades sem POP */}
        {semPop.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-warning">
              <FileQuestion className="h-3.5 w-3.5 shrink-0" />
              {semPop.length} atividade(s) sem POP/procedimento
            </div>
            <ul className="pl-5 space-y-0.5 text-muted-foreground list-disc">
              {semPop.slice(0, 3).map(a => (
                <li key={a.id}>{a.nome}</li>
              ))}
              {semPop.length > 3 && <li>+ {semPop.length - 3} outras…</li>}
            </ul>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 w-full"
              onClick={() => criarAcaoErgonomia("criar_pop")}
            >
              <Zap className="h-3 w-3 text-warning" />
              Criar ação: elaborar POPs
            </Button>
          </div>
        )}

        {/* Alta complexidade cognitiva */}
        {altaComplexidade.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-orange-600">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              {altaComplexidade.length} atividade(s) de alta complexidade cognitiva
            </div>
            <ul className="pl-5 space-y-0.5 text-muted-foreground list-disc">
              {altaComplexidade.slice(0, 3).map(a => (
                <li key={a.id}>{a.nome}</li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 w-full"
              onClick={() => criarAcaoErgonomia("redistribuir")}
            >
              <Zap className="h-3 w-3 text-warning" />
              Criar ação: redistribuir tarefas
            </Button>
          </div>
        )}

        {/* Riscos ergonômicos */}
        {riscosErgo.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {riscosErgo.length} risco(s) ergonômico(s) mapeado(s)
            </div>
            <ul className="pl-5 space-y-0.5 text-muted-foreground list-disc">
              {riscosErgo.slice(0, 2).map((r: any) => (
                <li key={r.id}>{r.descricao?.substring(0, 60)}{r.descricao?.length > 60 ? "…" : ""}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Atividades críticas */}
        {criticas.length > 0 && (
          <div className="flex items-center gap-1.5 text-destructive font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {criticas.length} atividade(s) marcada(s) como crítica(s)
          </div>
        )}

        {atividades.length > 0 && (
          <div className="pt-1 border-t flex items-center justify-between text-muted-foreground">
            <span>{atividades.length} atividades mapeadas na função</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={() => criarAcaoErgonomia("revisar_funcao")}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Revisar função
            </Button>
          </div>
        )}

        {atividades.length === 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            <span>Nenhuma atividade mapeada para esta função no módulo de Papéis.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
