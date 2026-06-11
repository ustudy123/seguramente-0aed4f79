import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { calcularIPSClassificacao, getIPSColor } from "@/types/psicossocial";
import { formatDateBR } from "@/lib/dataLocal";

interface IPSHistoricoChartProps {
  campanhas: CampanhaPsicossocial[];
}

const MINIMO_ANONIMATO = 5;

const ips_color_map: Record<string, string> = {
  saudavel: "#10b981",
  estavel: "#3b82f6",
  atencao: "#f59e0b",
  risco: "#f97316",
  critico: "#ef4444",
};

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const cls = calcularIPSClassificacao(payload.ips);
  const color = ips_color_map[cls] || "#8b5cf6";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={color}
      stroke="white"
      strokeWidth={2}
    />
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const cls = calcularIPSClassificacao(data.ips);
  const labels: Record<string, string> = {
    saudavel: "Saudável",
    estavel: "Estável",
    atencao: "Atenção",
    risco: "Risco",
    critico: "Crítico",
  };
  const color = ips_color_map[cls];
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold mb-1">{data.nome}</p>
      <p className="text-muted-foreground text-xs mb-2">{data.data}</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-bold text-lg" style={{ color }}>{data.ips}</span>
        <span className="text-muted-foreground text-xs">{labels[cls]}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{data.respostas} respostas</p>
    </div>
  );
}

export function IPSHistoricoChart({ campanhas }: IPSHistoricoChartProps) {
  const dados = useMemo(() => {
    return campanhas
      .filter(c => c.ips_score != null && (c.total_respostas || 0) >= MINIMO_ANONIMATO)
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
      .map(c => {
        // SIPRO grava `ips_score` em escala IRP-S (alto = ruim). Convertemos
        // para a escala IPS (alto = bom) para que o gráfico histórico fique
        // consistente com o termômetro principal e o relatório PDF.
        const raw = c.ips_score!;
        const valorIPS = c.instrumento === 'sipro' ? 100 - raw : raw;
        return {
          nome: c.nome.length > 18 ? c.nome.slice(0, 18) + "…" : c.nome,
          nomeCompleto: c.nome,
          data: formatDateBR(c.data_inicio, "MMM/yy"),
          ips: valorIPS,
          respostas: c.total_respostas || 0,
        };
      });
  }, [campanhas]);

  // Trend: compare last 2
  const tendencia = useMemo(() => {
    if (dados.length < 2) return null;
    const diff = dados[dados.length - 1].ips - dados[dados.length - 2].ips;
    return diff > 0 ? "up" : diff < 0 ? "down" : "stable";
  }, [dados]);

  const ultimoIPS = dados[dados.length - 1]?.ips ?? null;
  const ultimoCls = ultimoIPS != null ? calcularIPSClassificacao(ultimoIPS) : null;

  if (dados.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">
            O histórico estará disponível quando houver campanhas encerradas com mín. {MINIMO_ANONIMATO} respostas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Evolução Histórica do IPS
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Índice Psicossocial Organizacional por campanha
            </CardDescription>
          </div>
          {tendencia && ultimoIPS != null && ultimoCls && (
            <div className="flex items-center gap-2 text-sm">
              <span className={cn("font-bold text-lg", getIPSColor(ultimoCls))}>{ultimoIPS}</span>
              {tendencia === "up" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
              {tendencia === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
              {tendencia === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dados} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickCount={6}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Faixas de referência */}
            <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: "Saudável", position: "right", fontSize: 9, fill: "#10b981" }} />
            <ReferenceLine y={65} stroke="#3b82f6" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: "Estável", position: "right", fontSize: 9, fill: "#3b82f6" }} />
            <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: "Atenção", position: "right", fontSize: 9, fill: "#f59e0b" }} />
            <ReferenceLine y={35} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: "Risco", position: "right", fontSize: 9, fill: "#ef4444" }} />
            <Line
              type="monotone"
              dataKey="ips"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={<CustomDot />}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legenda de faixas */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
          {[
            { label: "Saudável", color: "bg-emerald-500" },
            { label: "Estável", color: "bg-blue-500" },
            { label: "Atenção", color: "bg-amber-500" },
            { label: "Risco", color: "bg-orange-500" },
            { label: "Crítico", color: "bg-red-500" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
