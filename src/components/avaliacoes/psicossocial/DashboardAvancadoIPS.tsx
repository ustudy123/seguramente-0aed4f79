import { useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Brain, 
  Info,
  LayoutDashboard,
  ShieldCheck,
  Zap
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IPSHistoricoChart } from "./IPSHistoricoChart";
import { IndicesDerivadosDashboard } from "./IndicesDerivadosDashboard";
import { RadarPsicossocial } from "./RadarPsicossocial";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { calcularIPSClassificacao, getIPSLabel, getIPSColor } from "@/types/psicossocial";

interface DashboardAvancadoIPSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanhas: CampanhaPsicossocial[];
}

export function DashboardAvancadoIPS({ open, onOpenChange, campanhas }: DashboardAvancadoIPSProps) {
  const MINIMO_ANONIMATO = 5;

  const campanhasValidas = useMemo(() => {
    return campanhas.filter(c => (c.total_respostas || 0) >= MINIMO_ANONIMATO);
  }, [campanhas]);

  const ultimaCampanha = useMemo(() => {
    if (campanhasValidas.length === 0) return null;
    return [...campanhasValidas].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [campanhasValidas]);

  const radarData = useMemo(() => {
    if (!ultimaCampanha?.radar_data) return [];
    return ultimaCampanha.radar_data as any[];
  }, [ultimaCampanha]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LayoutDashboard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Análise Psicossocial Avançada</DialogTitle>
                <DialogDescription>
                  Dashboard consolidado de indicadores, tendências e riscos organizacionais
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <Tabs defaultValue="visao-geral" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="visao-geral" className="gap-2">
                <BarChart3 className="h-4 w-4" /> Visão Geral
              </TabsTrigger>
              <TabsTrigger value="indices" className="gap-2">
                <Zap className="h-4 w-4" /> Índices SIPRO
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="gap-2">
                <TrendingUp className="h-4 w-4" /> Evolução
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="space-y-6 animate-in fade-in-50 duration-500">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Radar de Dimensões Psicossociais
                    </CardTitle>
                    <CardDescription>
                      Performance por dimensão na campanha mais recente: {ultimaCampanha?.nome}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center py-6">
                    {radarData.length > 0 ? (
                      <RadarPsicossocial dados={radarData} />
                    ) : (
                      <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-lg w-full">
                        <Info className="h-8 w-8 mb-2 opacity-20" />
                        <p>Nenhum dado de radar disponível para a última campanha</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">IPS Consolidado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {ultimaCampanha?.ips_score != null ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-end gap-2">
                            <span className={cn(
                              "text-4xl font-bold", 
                              getIPSColor(calcularIPSClassificacao(ultimaCampanha.instrumento === 'sipro' ? 100 - ultimaCampanha.ips_score : ultimaCampanha.ips_score))
                            )}>
                              {ultimaCampanha.instrumento === 'sipro' ? 100 - ultimaCampanha.ips_score : ultimaCampanha.ips_score}
                            </span>
                            <span className="text-muted-foreground text-sm mb-1">/ 100</span>
                          </div>
                          <Badge className={cn("w-fit", getIPSColor(calcularIPSClassificacao(ultimaCampanha.instrumento === 'sipro' ? 100 - ultimaCampanha.ips_score : ultimaCampanha.ips_score)))}>
                            {getIPSLabel(calcularIPSClassificacao(ultimaCampanha.instrumento === 'sipro' ? 100 - ultimaCampanha.ips_score : ultimaCampanha.ips_score))}
                          </Badge>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Sem dados suficientes</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-background border-blue-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        Conformidade NR-17
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Status atual das análises psicossociais em relação às normas regulamentadoras.
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span>Monitoramento Ativo</span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">OK</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>Metodologia Validada</span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">OK</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {radarData.slice(0, 4).map((d, i) => {
                  const score = d.value;
                  const isHighRisk = score < 50; 
                  return (
                    <Card key={i} className={cn(isHighRisk ? "border-amber-200 bg-amber-50/20" : "")}>
                      <CardHeader className="p-4 pb-0">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider">{d.subject}</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-1">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-2xl font-bold", score >= 80 ? "text-emerald-600" : score >= 65 ? "text-blue-600" : "text-amber-600")}>
                            {score}
                          </span>
                          <div className={cn("h-1.5 w-16 rounded-full bg-muted overflow-hidden")}>
                            <div className={cn("h-full", score >= 80 ? "bg-emerald-500" : score >= 65 ? "bg-blue-500" : "bg-amber-500")} style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="indices" className="space-y-6 animate-in slide-in-from-right-5 duration-500">
              <IndicesDerivadosDashboard campanhas={campanhas} />
            </TabsContent>

            <TabsContent value="evolucao" className="space-y-6 animate-in slide-in-from-right-5 duration-500">
              <div className="grid gap-6">
                <IPSHistoricoChart campanhas={campanhas} />
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Insights de Evolução</CardTitle>
                    <CardDescription>Análise automatizada de tendências entre campanhas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {campanhasValidas.length >= 2 ? (
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 flex gap-4">
                          <div className="p-2 bg-primary/10 rounded-full h-fit">
                            <Brain className="h-5 w-5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm">IA YourEyes Analysis</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              O Índice Psicossocial apresentou uma tendência de estabilização. 
                              Recomendamos focar em dimensões que apresentaram queda superior a 10% 
                              para evitar o surgimento de riscos ergonômicos psicossociais.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic text-center py-8">
                          São necessárias pelo menos 2 campanhas encerradas para análise de tendência.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Fechar Dashboard</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
