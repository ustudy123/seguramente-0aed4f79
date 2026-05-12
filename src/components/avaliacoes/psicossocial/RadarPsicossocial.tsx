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

  // Renderiza o label quebrando em até 2 linhas e ajustando ancoragem por quadrante,
  // evitando o corte de nomes longos como "Reconhecimento e Recompensas".
  const renderTick = (props: { payload: { value: string }; x: number; y: number; cx: number; cy: number }) => {
    const { payload, x, y, cx, cy } = props;
    const label = String(payload.value || '');
    const dx = x - cx;
    const dy = y - cy;
    const anchor = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end';
    const offsetX = anchor === 'middle' ? 0 : dx > 0 ? 6 : -6;
    const offsetY = dy > 4 ? 10 : dy < -4 ? -2 : 4;

    // Quebra em 2 linhas se o nome for longo
    const words = label.split(' ');
    let lines: string[] = [label];
    if (label.length > 14 && words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
    }

    return (
      <text
        x={x + offsetX}
        y={y + offsetY}
        textAnchor={anchor}
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={x + offsetX} dy={i === 0 ? 0 : 12}>
            {ln}
          </tspan>
        ))}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart cx="50%" cy="50%" outerRadius="62%" data={dados} margin={{ top: 24, right: 90, bottom: 24, left: 90 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="subject" tick={renderTick as never} tickLine={false} />
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
