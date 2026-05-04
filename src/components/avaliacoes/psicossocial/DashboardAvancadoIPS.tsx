import { useMemo, useState } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Brain, 
  Info,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  Filter,
  Calendar
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
  const [filtroCampanha, setFiltroCampanha] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  const campanhasFiltradas = useMemo(() => {
    return campanhas.filter(c => {
      let match = true;
      if (filtroCampanha !== "todos" && c.id !== filtroCampanha) match = false;
      if (dataInicio && new Date(c.data_inicio) < dataInicio) match = false;
      if (dataFim && new Date(c.data_fim || c.data_inicio) > dataFim) match = false;
      return match;
    });
  }, [campanhas, filtroCampanha, dataInicio, dataFim]);

  const ultimaCampanha = useMemo(() => {
    if (campanhasFiltradas.length === 0) return null;
    return [...campanhasFiltradas].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
  }, [campanhasFiltradas]);

  const radarData = useMemo(() => {
    if (!ultimaCampanha?.radar_data) return [];
    return ultimaCampanha.radar_data as any[];
  }, [ultimaCampanha]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LayoutDashboard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Análise Psicossocial Avançada</DialogTitle>
                <DialogDescription>
                  Dashboard com filtros de campanha, período e análise detalhada por dimensão.
                </DialogDescription>
              </div>
            </div>
            {/* Filtros */}
            <div className="flex items-center gap-2">
              <Select value={filtroCampanha} onValueChange={setFiltroCampanha}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por Campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Campanhas</SelectItem>
                  {campanhas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <Tabs defaultValue="visao-geral" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="visao-geral" className="gap-2"><BarChart3 className="h-4 w-4" /> Visão Geral</TabsTrigger>
              <TabsTrigger value="indices" className="gap-2"><Zap className="h-4 w-4" /> Índices SIPRO</TabsTrigger>
              <TabsTrigger value="evolucao" className="gap-2"><TrendingUp className="h-4 w-4" /> Evolução</TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                  <CardHeader><CardTitle>Radar de Dimensões Psicossociais</CardTitle></CardHeader>
                  <CardContent className="flex justify-center">
                    {radarData.length > 0 ? <RadarPsicossocial dados={radarData} /> : <p className="text-muted-foreground italic">Selecione uma campanha com dados suficientes.</p>}
                  </CardContent>
                </Card>
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">IPS Consolidado</CardTitle></CardHeader>
                    <CardContent>
                      {ultimaCampanha?.ips_score != null ? (
                        <div className="text-4xl font-bold">{ultimaCampanha.instrumento === 'sipro' ? 100 - ultimaCampanha.ips_score : ultimaCampanha.ips_score}</div>
                      ) : <p className="text-sm text-muted-foreground italic">Sem dados suficientes</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="indices"><IndicesDerivadosDashboard campanhas={campanhasFiltradas} /></TabsContent>
            <TabsContent value="evolucao"><IPSHistoricoChart campanhas={campanhasFiltradas} /></TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}