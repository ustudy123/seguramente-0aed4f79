import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export type IndicatorType = 
  | "turnover" 
  | "admissoes" 
  | "cargos" 
  | "departamentos"
  | "nr17" 
  | "epis" 
  | "riscos"
  | "humor" 
  | "ouvidoria" 
  | "feed"
  | "acoes" 
  | "evidencias"
  | "organizacao"
  | "condicoes"
  | "experiencia"
  | "governanca";

interface IndicatorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: IndicatorType;
  title: string;
  currentValue: string | number;
}

// Mock data for monthly comparison - in production, this would come from a hook
const generateMonthlyData = (indicator: IndicatorType) => {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const currentMonth = new Date().getMonth();
  
  return months.slice(0, currentMonth + 1).map((month, index) => {
    const baseValue = Math.floor(Math.random() * 30) + 50;
    const variation = Math.floor(Math.random() * 20) - 10;
    
    switch (indicator) {
      case "turnover":
        return { 
          month, 
          valor: (Math.random() * 5 + 1).toFixed(1), 
          meta: 3,
          admissoes: Math.floor(Math.random() * 10) + 2,
          desligamentos: Math.floor(Math.random() * 5) + 1,
        };
      case "admissoes":
        return { 
          month, 
          valor: Math.floor(Math.random() * 15) + 3, 
          meta: 8,
          concluidas: Math.floor(Math.random() * 10) + 2,
          pendentes: Math.floor(Math.random() * 5) + 1,
        };
      case "cargos":
      case "departamentos":
        return { 
          month, 
          valor: baseValue + index * 2, 
          ativos: baseValue + index * 2 - Math.floor(Math.random() * 5),
          inativos: Math.floor(Math.random() * 5),
        };
      case "nr17":
        return { 
          month, 
          atendidos: Math.floor(Math.random() * 30) + 60, 
          parciais: Math.floor(Math.random() * 20) + 10,
          naoAtendidos: Math.floor(Math.random() * 15) + 5,
          meta: 80,
        };
      case "epis":
        return { 
          month, 
          estoque: Math.floor(Math.random() * 100) + 150, 
          entregas: Math.floor(Math.random() * 30) + 10,
          vencidos: Math.floor(Math.random() * 10),
        };
      case "riscos":
        return { 
          month, 
          ativos: Math.floor(Math.random() * 10) + 5, 
          mitigados: Math.floor(Math.random() * 8) + 2,
          novos: Math.floor(Math.random() * 5),
        };
      case "humor":
        return { 
          month, 
          positivo: Math.floor(Math.random() * 30) + 60, 
          neutro: Math.floor(Math.random() * 20) + 15,
          negativo: Math.floor(Math.random() * 15) + 5,
        };
      case "ouvidoria":
        return { 
          month, 
          recebidas: Math.floor(Math.random() * 20) + 5, 
          resolvidas: Math.floor(Math.random() * 18) + 3,
          pendentes: Math.floor(Math.random() * 5),
        };
      case "acoes":
        return { 
          month, 
          concluidas: Math.floor(Math.random() * 15) + 5, 
          emAndamento: Math.floor(Math.random() * 10) + 3,
          pendentes: Math.floor(Math.random() * 8) + 2,
        };
      case "organizacao":
      case "condicoes":
      case "experiencia":
      case "governanca":
        return { 
          month, 
          score: Math.floor(Math.random() * 30) + 50, 
          meta: 75,
        };
      default:
        return { month, valor: baseValue + variation };
    }
  });
};

const getChartConfig = (indicator: IndicatorType) => {
  const configs: Record<string, { colors: string[]; dataKeys: string[]; labels: string[] }> = {
    turnover: {
      colors: ["hsl(173, 58%, 39%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"],
      dataKeys: ["admissoes", "desligamentos"],
      labels: ["Admissões", "Desligamentos"],
    },
    admissoes: {
      colors: ["hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)"],
      dataKeys: ["concluidas", "pendentes"],
      labels: ["Concluídas", "Pendentes"],
    },
    nr17: {
      colors: ["hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"],
      dataKeys: ["atendidos", "parciais", "naoAtendidos"],
      labels: ["Atendidos", "Parciais", "Não Atendidos"],
    },
    epis: {
      colors: ["hsl(215, 50%, 45%)", "hsl(145, 55%, 45%)", "hsl(0, 72%, 51%)"],
      dataKeys: ["estoque", "entregas", "vencidos"],
      labels: ["Em Estoque", "Entregas", "Vencidos"],
    },
    riscos: {
      colors: ["hsl(0, 72%, 51%)", "hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)"],
      dataKeys: ["ativos", "mitigados", "novos"],
      labels: ["Ativos", "Mitigados", "Novos"],
    },
    humor: {
      colors: ["hsl(145, 55%, 45%)", "hsl(200, 20%, 60%)", "hsl(0, 72%, 51%)"],
      dataKeys: ["positivo", "neutro", "negativo"],
      labels: ["Positivo", "Neutro", "Negativo"],
    },
    ouvidoria: {
      colors: ["hsl(215, 50%, 45%)", "hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)"],
      dataKeys: ["recebidas", "resolvidas", "pendentes"],
      labels: ["Recebidas", "Resolvidas", "Pendentes"],
    },
    acoes: {
      colors: ["hsl(145, 55%, 45%)", "hsl(38, 92%, 50%)", "hsl(200, 20%, 60%)"],
      dataKeys: ["concluidas", "emAndamento", "pendentes"],
      labels: ["Concluídas", "Em Andamento", "Pendentes"],
    },
    organizacao: {
      colors: ["hsl(215, 50%, 23%)"],
      dataKeys: ["score"],
      labels: ["Score"],
    },
    condicoes: {
      colors: ["hsl(145, 55%, 45%)"],
      dataKeys: ["score"],
      labels: ["Score"],
    },
    experiencia: {
      colors: ["hsl(280, 55%, 55%)"],
      dataKeys: ["score"],
      labels: ["Score"],
    },
    governanca: {
      colors: ["hsl(38, 92%, 50%)"],
      dataKeys: ["score"],
      labels: ["Score"],
    },
  };

  return configs[indicator] || { colors: ["hsl(173, 58%, 39%)"], dataKeys: ["valor"], labels: ["Valor"] };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const IndicatorDetailModal = ({
  open,
  onOpenChange,
  indicator,
  title,
  currentValue,
}: IndicatorDetailModalProps) => {
  const data = generateMonthlyData(indicator);
  const config = getChartConfig(indicator);
  
  // Calculate trends
  const lastTwoMonths = data.slice(-2);
  const currentMonthData = lastTwoMonths[1] || lastTwoMonths[0];
  const previousMonthData = lastTwoMonths[0];
  
  const calculateTrend = () => {
    if (!currentMonthData || !previousMonthData) return 0;
    const currentVal = currentMonthData[config.dataKeys[0] as keyof typeof currentMonthData] as number;
    const previousVal = previousMonthData[config.dataKeys[0] as keyof typeof previousMonthData] as number;
    if (!previousVal) return 0;
    return Math.round(((currentVal - previousVal) / previousVal) * 100);
  };

  const trend = calculateTrend();

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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-sm">Valor Atual</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{currentValue}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Período</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {data.length} meses
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-muted/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              {trend > 0 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : trend < 0 ? (
                <TrendingDown className="w-4 h-4 text-destructive" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              <span className="text-sm">Tendência</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              trend > 0 ? "text-success" : trend < 0 ? "text-destructive" : "text-foreground"
            )}>
              {trend > 0 ? "+" : ""}{trend}%
            </p>
          </motion.div>
        </div>

        {/* Charts Tabs */}
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
                  {config.colors.map((color, index) => (
                    <linearGradient key={index} id={`gradient-${indicator}-${index}`} x1="0" y1="0" x2="0" y2="1">
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
                {config.dataKeys.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={config.labels[index]}
                    stroke={config.colors[index]}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#gradient-${indicator}-${index})`}
                  />
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
                {config.dataKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={config.labels[index]}
                    fill={config.colors[index]}
                    radius={[4, 4, 0, 0]}
                  />
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
                {config.dataKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={config.labels[index]}
                    stroke={config.colors[index]}
                    strokeWidth={2}
                    dot={{ fill: config.colors[index], strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
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
                    <th key={label} className="text-right px-4 py-2 font-medium text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium text-foreground">{row.month}</td>
                    {config.dataKeys.map((key) => (
                      <td key={key} className="text-right px-4 py-2 text-foreground">
                        {row[key as keyof typeof row]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
