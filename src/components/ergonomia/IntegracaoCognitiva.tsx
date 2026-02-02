import { motion } from "framer-motion";
import { 
  SmilePlus, 
  MessageSquareWarning, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DadosCognitivos } from "@/hooks/useErgonomiaInteligente";

interface IntegracaoCognitivaProps {
  dados: DadosCognitivos;
}

export function IntegracaoCognitiva({ dados }: IntegracaoCognitivaProps) {
  const totalHumor = dados.humorUltimos7Dias.total || 1;
  const percPositivo = Math.round((dados.humorUltimos7Dias.positivo / totalHumor) * 100);
  const percNeutro = Math.round((dados.humorUltimos7Dias.neutro / totalHumor) * 100);
  const percNegativo = Math.round((dados.humorUltimos7Dias.negativo / totalHumor) * 100);

  const totalRiscos = dados.riscosAtivos.fisico + dados.riscosAtivos.cognitivo + dados.riscosAtivos.organizacional;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SmilePlus className="h-5 w-5 text-primary" />
          Integração Cognitiva e Psicossocial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Humor dos últimos 7 dias */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Humor da Equipe (últimos 7 dias)</h4>
            <span className="text-xs text-muted-foreground">
              {dados.humorUltimos7Dias.total} registros
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 rounded-lg bg-success/10 border border-success/30 text-center"
            >
              <div className="text-2xl font-bold text-success">{percPositivo}%</div>
              <div className="text-xs text-success/80">Positivo</div>
              <div className="text-lg mt-1">😊</div>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="p-3 rounded-lg bg-muted border text-center"
            >
              <div className="text-2xl font-bold text-muted-foreground">{percNeutro}%</div>
              <div className="text-xs text-muted-foreground">Neutro</div>
              <div className="text-lg mt-1">😐</div>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-center"
            >
              <div className="text-2xl font-bold text-destructive">{percNegativo}%</div>
              <div className="text-xs text-destructive/80">Negativo</div>
              <div className="text-lg mt-1">😟</div>
            </motion.div>
          </div>
        </div>

        {/* Canal de Escuta / Ouvidoria */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <MessageSquareWarning className={cn(
              "h-8 w-8",
              dados.denunciasAbertas > 0 ? "text-warning" : "text-muted-foreground"
            )} />
            <div className="flex-1">
              <h4 className="text-sm font-medium">Canal de Escuta</h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-muted-foreground">
                  <strong className={dados.denunciasAbertas > 0 ? "text-warning" : ""}>
                    {dados.denunciasAbertas}
                  </strong> manifestações abertas
                </span>
                <span className="text-xs text-muted-foreground">
                  <strong>{dados.denunciasUltimos30Dias}</strong> nos últimos 30 dias
                </span>
              </div>
            </div>
            {dados.denunciasAbertas > 0 && (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
          </div>
        </div>

        {/* Riscos Ativos por Eixo */}
        <div>
          <h4 className="text-sm font-medium mb-3">Riscos Ativos por Eixo</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-600">Eixo Físico</span>
                <span className="font-medium">{dados.riscosAtivos.fisico}</span>
              </div>
              <Progress 
                value={totalRiscos > 0 ? (dados.riscosAtivos.fisico / totalRiscos) * 100 : 0} 
                className="h-2 [&>div]:bg-blue-500" 
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-600">Eixo Cognitivo</span>
                <span className="font-medium">{dados.riscosAtivos.cognitivo}</span>
              </div>
              <Progress 
                value={totalRiscos > 0 ? (dados.riscosAtivos.cognitivo / totalRiscos) * 100 : 0} 
                className="h-2 [&>div]:bg-purple-500" 
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-600">Eixo Organizacional</span>
                <span className="font-medium">{dados.riscosAtivos.organizacional}</span>
              </div>
              <Progress 
                value={totalRiscos > 0 ? (dados.riscosAtivos.organizacional / totalRiscos) * 100 : 0} 
                className="h-2 [&>div]:bg-amber-500" 
              />
            </div>
          </div>
        </div>

        {/* Status das Ações */}
        <div>
          <h4 className="text-sm font-medium mb-3">Plano de Ação</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-center">
              <div className="text-xl font-bold text-warning">
                {dados.acoesStatus.pendentes}
              </div>
              <div className="text-xs text-warning/80">Pendentes</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
              <div className="text-xl font-bold text-blue-600">
                {dados.acoesStatus.emAndamento}
              </div>
              <div className="text-xs text-blue-600/80">Em Andamento</div>
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
              <div className="text-xl font-bold text-success">
                {dados.acoesStatus.concluidas}
              </div>
              <div className="text-xs text-success/80">Concluídas</div>
            </div>
          </div>
        </div>

        {/* Insight */}
        {percNegativo > 30 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-warning mt-0.5" />
            <p className="text-sm text-warning">
              <strong>Atenção:</strong> {percNegativo}% de humor negativo nos últimos 7 dias. 
              Considere investigar causas organizacionais.
            </p>
          </div>
        )}
        
        {percPositivo > 70 && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
            <p className="text-sm text-success">
              <strong>Excelente:</strong> {percPositivo}% de humor positivo. 
              A equipe demonstra bom engajamento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
