import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, Plus, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SugestaoAcao {
  titulo: string;
  descricao: string;
  tipo: "corretiva" | "preventiva" | "melhoria";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  gravidade: number;
  urgencia: number;
  tendencia: number;
}

interface AuditoriaAcoesSectionProps {
  analise: string;
}

export function AuditoriaAcoesSection({ analise }: AuditoriaAcoesSectionProps) {
  const [sugestoes, setSugestoes] = useState<SugestaoAcao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [criando, setCriando] = useState(false);
  const [criadasCount, setCriadasCount] = useState(0);
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const gerarSugestoes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "sugerir",
          contexto: analise,
          dados: {
            origem: "Auditoria Inteligente de EPIs",
            risco: "Riscos identificados pela IA na auditoria de EPIs",
          },
        },
      });
      if (error) throw error;
      if (data?.sugestoes) {
        setSugestoes(data.sugestoes);
        setSelected(new Set());
      }
    } catch (err) {
      toast.error("Erro ao gerar sugestões de ações");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sugestoes.length) setSelected(new Set());
    else setSelected(new Set(sugestoes.map((_, i) => i)));
  };

  const criarAcoes = async () => {
    if (!tenantId || selected.size === 0) return;
    setCriando(true);
    const userName = profile?.nome_completo || user?.email || "Usuário";
    let count = 0;

    for (const idx of Array.from(selected)) {
      const s = sugestoes[idx];
      const gutMap: Record<string, { g: number; u: number; t: number }> = {
        urgente: { g: 5, u: 5, t: 4 },
        alta: { g: 4, u: 4, t: 3 },
        media: { g: 3, u: 3, t: 3 },
        baixa: { g: 2, u: 2, t: 2 },
      };
      const gut = gutMap[s.prioridade] || gutMap.media;
      const g = s.gravidade || gut.g;
      const u = s.urgencia || gut.u;
      const t = s.tendencia || gut.t;

      try {
        const { data: created, error } = await supabase
          .from("plano_acoes")
          .insert({
            tenant_id: tenantId,
            codigo: "",
            titulo: s.titulo,
            descricao: s.descricao,
            porque: "Identificado pela Auditoria Inteligente de EPIs",
            origem_modulo: "epi",
            origem_descricao: "Auditoria Inteligente — Análise de Padrões",
            tipo: s.tipo,
            prioridade: s.prioridade === "urgente" ? "imediato" : s.prioridade === "alta" ? "urgente" : s.prioridade === "media" ? "medio" : "baixo",
            gravidade: g,
            urgencia: u,
            tendencia: t,
            criado_por: user?.id,
            criado_por_nome: userName,
          })
          .select()
          .single();

        if (!error && created) {
          await supabase.from("plano_historico").insert({
            tenant_id: tenantId,
            acao_id: created.id,
            tipo_evento: "criacao",
            descricao: `Ação criada a partir da Auditoria Inteligente de EPIs`,
            usuario_id: user?.id,
            usuario_nome: userName,
          });
          count++;
        }
      } catch { /* continue */ }
    }

    setCriadasCount((prev) => prev + count);
    queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
    queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
    toast.success(`${count} ação(ões) criada(s) no Plano de Ação!`);
    setSelected(new Set());
    setCriando(false);
  };

  const getPrioridadeBadge = (p: string) => {
    switch (p) {
      case "urgente": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "alta": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "media": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
  };

  const getTipoBadge = (t: string) => {
    switch (t) {
      case "corretiva": return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
      case "preventiva": return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
      default: return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5 text-primary" />
            Ações Sugeridas pela IA
          </CardTitle>
          {sugestoes.length === 0 ? (
            <Button onClick={gerarSugestoes} disabled={isLoading} size="sm" className="gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {isLoading ? "Gerando..." : "Sugerir Ações"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selected.size === sugestoes.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
              <Button
                size="sm"
                onClick={criarAcoes}
                disabled={selected.size === 0 || criando}
                className="gap-2"
              >
                {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar {selected.size} Ação(ões)
              </Button>
            </div>
          )}
        </div>
        {criadasCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mt-1">
            <CheckCircle2 className="w-4 h-4" />
            {criadasCount} ação(ões) já criada(s) no Plano de Ação
          </div>
        )}
      </CardHeader>

      {sugestoes.length > 0 && (
        <CardContent>
          <div className="space-y-3">
            {sugestoes.map((s, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(idx) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
                onClick={() => toggleSelect(idx)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox checked={selected.has(idx)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-medium text-sm">{s.titulo}</h4>
                      <Badge className={getPrioridadeBadge(s.prioridade)} variant="secondary">
                        {s.prioridade.toUpperCase()}
                      </Badge>
                      <Badge className={getTipoBadge(s.tipo)} variant="secondary">
                        {s.tipo}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.descricao}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      )}

      {sugestoes.length === 0 && !isLoading && (
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Sugerir Ações" para que a IA gere recomendações com base no relatório de auditoria.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
