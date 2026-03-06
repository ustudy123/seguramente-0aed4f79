import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from 'recharts';
import type { RadarDimensao } from "@/types/psicossocial";

interface RadarPsicossocialProps {
  dados: RadarDimensao[];
  color?: string;
}

export function RadarPsicossocial({ dados, color = '#8b5cf6' }: RadarPsicossocialProps) {
  if (!dados || dados.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dados}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [`${value}`, 'Score']}
          contentStyle={{
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
