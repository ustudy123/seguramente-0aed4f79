import { useMemo } from "react";
import { motion } from "framer-motion";
import { EIXOS_CONFIG, type BemEstarEixo } from "@/hooks/useBemEstar";

interface RadarPoint {
  eixo: BemEstarEixo;
  valor: number;
  total: number;
}

interface BemEstarRadarProps {
  data: RadarPoint[];
  onEixoClick: (eixo: BemEstarEixo) => void;
  getStatusLabel: (valor: number) => string;
  getStatusColor: (valor: number) => string;
}

export function BemEstarRadar({ data, onEixoClick, getStatusLabel, getStatusColor }: BemEstarRadarProps) {
  const size = 320;
  const center = size / 2;
  const maxRadius = 130;
  const levels = 5;

  const points = useMemo(() => {
    return data.map((d, i) => {
      const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
      const r = (d.valor / 5) * maxRadius;
      return {
        ...d,
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        labelX: center + (maxRadius + 30) * Math.cos(angle),
        labelY: center + (maxRadius + 30) * Math.sin(angle),
        angle,
      };
    });
  }, [data]);

  const polygonPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Background circles */}
        {Array.from({ length: levels }).map((_, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={(maxRadius / levels) * (i + 1)}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}

        {/* Axis lines */}
        {points.map((p, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + maxRadius * Math.cos(p.angle)}
            y2={center + maxRadius * Math.sin(p.angle)}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}

        {/* Filled polygon */}
        <motion.path
          d={polygonPath}
          fill="hsl(var(--primary) / 0.15)"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={6}
            fill={EIXOS_CONFIG[p.eixo].cor}
            stroke="hsl(var(--background))"
            strokeWidth={2}
            className="cursor-pointer hover:r-8"
            onClick={() => onEixoClick(p.eixo)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1, type: "spring" }}
          />
        ))}
      </svg>

      {/* Legend below radar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 w-full max-w-xl">
        {data.map((d) => {
          const config = EIXOS_CONFIG[d.eixo];
          return (
            <button
              key={d.eixo}
              onClick={() => onEixoClick(d.eixo)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: config.cor }}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{config.label.split(" & ")[0]}</p>
                <p className={`text-xs ${getStatusColor(d.valor)}`}>{getStatusLabel(d.valor)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
