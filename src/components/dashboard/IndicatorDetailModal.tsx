import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Activity, Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIndicatorHistory } from "@/hooks/useIndicatorHistory";

export type IndicatorType =
  | "turnover" | "admissoes" | "cargos" | "departamentos"
  | "nr17" | "epis" | "riscos"
  | "humor" | "ouvidoria" | "feed"
  | "acoes" | "evidencias"
  | "organizacao" | "condicoes" | "experiencia" | "governanca";

interface IndicatorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: IndicatorType;
  title: string;
  currentValue: string | number;
}

const getChartConfig = (indicator: IndicatorType) => {
  const configs: Record<string, { colors: string[]; dataKeys: string[]; labels: string[] }> = {
    admissoes: { colors: ["hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)"], dataKeys: ["concluidas", "pendentes"], labels: ["Concluídas", "Pendentes"] },
    nr17: { colors: ["hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"], dataKeys: ["atendidos", "parciais", "naoAtendidos"], labels: ["Atendidos", "Parciais", "Não Atendidos"] },
    epis: { colors: ["hsl(145, 55%, 45%)", "hsl(215, 50%, 45%)"], dataKeys: ["disponiveis", "total"], labels: ["Disponíveis", "Total"] },
    riscos: { colors: ["hsl(0, 72%, 51%)", "hsl(215, 50%, 45%)"], dataKeys: ["ativos", "total"], labels: ["Ativos", "Total"] },
    humor: { colors: ["hsl(145, 55%, 45%)", "hsl(200, 20%, 60%)", "hsl(0, 72%, 51%)"], dataKeys: ["positivo", "neutro", "negativo"], labels: ["Positivo", "Neutro", "Negativo"] },
    ouvidoria: { colors: ["hsl(215, 50%, 45%)", "hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)"], dataKeys: ["recebidas", "resolvidas", "pendentes"], labels: ["Recebidas", "Resolvidas", "Pendentes"] },
    acoes: { colors: ["hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)", "hsl(200, 20%, 60%)"], dataKeys: ["concluidas", "emAndamento", "pendentes"], labels: ["Concluídas", "Em Andamento", "Pendentes"] },
    organizacao: { colors: ["hsl(215, 50%, 23%)"], dataKeys: ["score"], labels: ["Score"] },
    condicoes: { colors: ["hsl(145, 55%, 45%)"], dataKeys: ["score"], labels: ["Score"] },
    experiencia: { colors: ["hsl(280, 55%, 55%)"], dataKeys: ["score"], labels: ["Score"] },
    governanca: { colors: ["hsl(38, 92%, 50%)"], dataKeys: ["score"], labels: ["Score"] },
  };
  return configs[indicator] || { colors: ["hsl(173, 58%, 39%)"], dataKeys: ["valor"], labels: ["Valor"] };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const IndicatorDetailModal = ({ open, onOpenChange, indicator, title, currentValue }: IndicatorDetailModalProps) => {
  const { data = [], isLoading } = useIndicatorHistory(indicator);
  const config = getChartConfig(indicator);

  const hasData = data.length > 0 && data.some((d) =>
    config.dataKeys.some((key) => (d[key] as number) > 0)
  );

  // Calculate trend from last 2 data points
  const trend = (() => {
    if (data.length < 2) return 0;
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const key = config.dataKeys[0];
    const cur = (last[key] as number) || 0;
    const pre = (prev[key] as number) || 0;
    if (!pre) return 0;
    return Math.round(((cur - pre) / pre) * 100);
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <Activity className="w-6 h-6 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-sm">Valor Atual</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{currentValue}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Período</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{data.length} meses</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {trend > 0 ? <TrendingUp className="w-4 h-4 text-success" /> : trend < 0 ? <TrendingDown className="w-4 h-4 text-destructive" /> : <Minus className="w-4 h-4" />}
              <span className="text-sm">Tendência</span>
            </div>
            <p className={cn("text-2xl font-bold", trend > 0 ? "text-success" : trend < 0 ? "text-destructive" : "text-foreground")}>
              {hasData ? `${trend > 0 ? "+" : ""}${trend}%` : "—"}
            </p>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[350px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-[350px] text-center">
            <BarChart3 className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h4 className="font-medium text-foreground mb-1">Sem dados históricos</h4>
            <p className="text-sm text-muted-foreground max-w-sm">
              Os gráficos serão preenchidos automaticamente conforme dados reais forem cadastrados no sistema.
            </p>
          </div>
        ) : (
          <>
            <Tabs defaultValue="area" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="area">Área</TabsTrigger>
                <TabsTrigger value="bar">Barras</TabsTrigger>
                <TabsTrigger value="line">Linha</TabsTrigger>
              </TabsList>

              <TabsContent value="area" className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      {config.colors.map((color, i) => (
                        <linearGradient key={i} id={`g-${indicator}-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {config.dataKeys.map((key, i) => (
                      <Area key={key} type="monotone" dataKey={key} name={config.labels[i]} stroke={config.colors[i]} strokeWidth={2} fillOpacity={1} fill={`url(#g-${indicator}-${i})`} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="bar" className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {config.dataKeys.map((key, i) => (
                      <Bar key={key} dataKey={key} name={config.labels[i]} fill={config.colors[i]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="line" className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {config.dataKeys.map((key, i) => (
                      <Line key={key} type="monotone" dataKey={key} name={config.labels[i]} stroke={config.colors[i]} strokeWidth={2} dot={{ fill: config.colors[i], strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 2 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>

            {/* Monthly Data Table */}
            <div className="mt-6 border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <h4 className="font-medium text-foreground">Dados Mensais</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Mês</th>
                      {config.labels.map((label) => (
                        <th key={label} className="text-right px-4 py-2 font-medium text-muted-foreground">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, index) => (
                      <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium text-foreground">{row.month}</td>
                        {config.dataKeys.map((key) => (
                          <td key={key} className="text-right px-4 py-2 text-foreground">{row[key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
