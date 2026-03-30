import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MetaCompleta } from "@/types/metas-module";

interface MetasConsistenciaPanelProps {
  metas: MetaCompleta[];
}

interface Alerta {
  tipo: string;
  descricao: string;
  metas_envolvidas: string[];
  sugestao: string;
}

interface ConsistenciaResult {
  alertas: Alerta[];
  resumo: string;
}

const TIPO_CORES: Record<string, string> = {
  duplicidade: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  conflito: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  desalinhamento: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  sobreposicao: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export function MetasConsistenciaPanel({ metas }: MetasConsistenciaPanelProps) {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [result, setResult] = useState<ConsistenciaResult | null>(null);

  const handleValidar = async () => {
    if (metas.length < 2) {
      toast.error("É necessário ter pelo menos 2 metas para validar consistência.");
      return;
    }
    setIsAnalysing(true);
    try {
      const metasResumo = metas.map(m => ({
        titulo: m.titulo,
        nivel: m.nivel,
        objetivo_estrategico: m.objetivo_estrategico,
        indicador_nome: m.indicador_nome,
        responsavel_nome: m.responsavel_nome,
        unidade_nome: m.unidade_nome,
        status: m.status,
        progresso: m.progresso,
      }));

      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: { acao: "validar_consistencia", meta: metasResumo },
      });
      if (error) throw error;
      setResult(data as ConsistenciaResult);
      toast.success("Validação concluída!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAnalysing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Validação de Consistência (IA)
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleValidar} disabled={isAnalysing} className="gap-1.5">
            {isAnalysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Validar Metas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result && !isAnalysing && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Validar Metas" para que a IA analise duplicidades, conflitos e desalinhamentos entre suas {metas.length} metas.
          </p>
        )}

        {result && (
          <>
            <div className="p-3 bg-muted/50 rounded-lg text-sm">{result.resumo}</div>

            {result.alertas?.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                Nenhuma inconsistência detectada!
              </div>
            ) : (
              <div className="space-y-2">
                {result.alertas?.map((alerta, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge className={`${TIPO_CORES[alerta.tipo] || "bg-muted"} text-[10px] shrink-0`}>
                        {alerta.tipo}
                      </Badge>
                      <p className="text-sm">{alerta.descricao}</p>
                    </div>
                    {alerta.metas_envolvidas?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {alerta.metas_envolvidas.map((m, j) => (
                          <Badge key={j} variant="outline" className="text-[10px]">{m}</Badge>
                        ))}
                      </div>
                    )}
                    {alerta.sugestao && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Info className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{alerta.sugestao}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Conteúdo gerado por IA — sujeito a revisão humana
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
