import { motion } from "framer-motion";
import { Bot, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEpiFiscalIA } from "@/hooks/useEpiFiscalIA";
import ReactMarkdown from "react-markdown";

export function EpiFiscalIATab() {
  const { analise, isLoading, error, executarAnalise } = useEpiFiscalIA();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              IA Fiscal Interno — Análise de Padrões
            </CardTitle>
            <Button
              onClick={executarAnalise}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : analise ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Reanalisar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Executar Análise
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A IA analisa padrões de entrega, consumo, extravios e conformidade dos EPIs para identificar anomalias e riscos jurídicos.
          </p>
        </CardHeader>
      </Card>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20"
        >
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Result */}
      {(analise || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="w-5 h-5 text-primary" />
                Relatório de Análise Fiscal
                {isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{analise || "Aguardando resposta da IA..."}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {!analise && !isLoading && !error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Análise Fiscal Inteligente</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Execute a análise para que a IA identifique padrões suspeitos, anomalias de consumo, riscos de conformidade e recomendações de ação baseadas nos dados reais de EPIs da empresa.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">🔍 Padrões</p>
                  <p className="text-xs text-muted-foreground mt-1">Frequência anormal de substituições e perdas</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">⚖️ Conformidade</p>
                  <p className="text-xs text-muted-foreground mt-1">CAs vencidos, EPIs sem entrega para funções obrigatórias</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">📊 Anomalias</p>
                  <p className="text-xs text-muted-foreground mt-1">Picos de consumo e desgaste acelerado</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
