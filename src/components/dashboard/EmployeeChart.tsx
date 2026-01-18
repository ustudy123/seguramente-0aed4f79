import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", colaboradores: 145, admissoes: 8, desligamentos: 3 },
  { month: "Fev", colaboradores: 150, admissoes: 7, desligamentos: 2 },
  { month: "Mar", colaboradores: 155, admissoes: 10, desligamentos: 5 },
  { month: "Abr", colaboradores: 158, admissoes: 6, desligamentos: 3 },
  { month: "Mai", colaboradores: 162, admissoes: 8, desligamentos: 4 },
  { month: "Jun", colaboradores: 168, admissoes: 9, desligamentos: 3 },
  { month: "Jul", colaboradores: 172, admissoes: 7, desligamentos: 3 },
  { month: "Ago", colaboradores: 178, admissoes: 11, desligamentos: 5 },
  { month: "Set", colaboradores: 182, admissoes: 8, desligamentos: 4 },
  { month: "Out", colaboradores: 188, admissoes: 10, desligamentos: 4 },
  { month: "Nov", colaboradores: 194, admissoes: 9, desligamentos: 3 },
  { month: "Dez", colaboradores: 198, admissoes: 6, desligamentos: 2 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const EmployeeChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-card rounded-xl border border-border p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Evolução do Quadro</h2>
          <p className="text-sm text-muted-foreground">Colaboradores ativos por mês</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Admissões</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground">Desligamentos</span>
          </div>
        </div>
      </div>
      
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorColaboradores" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(200, 20%, 90%)" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(200, 10%, 45%)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(200, 10%, 45%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="colaboradores"
              name="Colaboradores"
              stroke="hsl(173, 58%, 39%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorColaboradores)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
