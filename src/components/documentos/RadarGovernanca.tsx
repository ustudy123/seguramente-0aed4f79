import { useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DocumentoPastaNode, DocumentoItem } from "@/types/documentoPasta";

const DIMENSOES = [
  { nome: "Governança", chave: "Governança e Administração" },
  { nome: "SST", chave: "SST" },
  { nome: "Ambiental", chave: "Gestão Ambiental" },
  { nome: "Processos", chave: "Processos Organizacionais" },
  { nome: "Pessoas", chave: "Gestão de Pessoas" },
  { nome: "Riscos", chave: "Gestão de Riscos" },
  { nome: "Auditorias", chave: "Auditorias e Melhoria Contínua" },
];

// Quantidade esperada de documentos por dimensão (para calcular score)
const DOCS_ESPERADOS_COUNT: Record<string, number> = {
  "Governança e Administração": 20,
  "SST": 12,
  "Gestão Ambiental": 8,
  "Processos Organizacionais": 10,
  "Gestão de Pessoas": 6,
  "Gestão de Riscos": 8,
  "Auditorias e Melhoria Contínua": 8,
};

function countDocsInTree(nodes: DocumentoPastaNode[]): number {
  let total = 0;
  for (const n of nodes) {
    total += (n.documentos || []).length;
    if (n.children?.length) total += countDocsInTree(n.children);
  }
  return total;
}

function findSecao(nodes: DocumentoPastaNode[], nome: string): DocumentoPastaNode | undefined {
  return nodes.find(n => n.nome.toLowerCase().includes(nome.toLowerCase().substring(0, 10)));
}

interface Props {
  tree: DocumentoPastaNode[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { nome: string } }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const { value, payload: item } = payload[0];
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-semibold">{item.nome}</p>
        <p className="text-primary font-bold">{value}%</p>
      </div>
    );
  }
  return null;
};

export function RadarGovernanca({ tree }: Props) {
  const data = useMemo(() => {
    return DIMENSOES.map(({ nome, chave }) => {
      const secao = findSecao(tree, chave);
      const totalDocs = secao ? countDocsInTree([secao]) : 0;
      const esperados = DOCS_ESPERADOS_COUNT[chave] || 10;
      // Score: % de documentos preenchidos vs esperados, max 100
      const score = Math.min(100, Math.round((totalDocs / esperados) * 100));
      return { nome, score, totalDocs, esperados };
    });
  }, [tree]);

  const mediaGeral = useMemo(() => {
    const soma = data.reduce((s, d) => s + d.score, 0);
    return Math.round(soma / data.length);
  }, [data]);

  const maturidadeLabel = (score: number) => {
    if (score >= 80) return { label: "Avançado", color: "text-green-600" };
    if (score >= 60) return { label: "Em Desenvolvimento", color: "text-primary" };
    if (score >= 40) return { label: "Básico", color: "text-warning" };
    return { label: "Inicial", color: "text-destructive" };
  };

  const { label, color } = maturidadeLabel(mediaGeral);

  return (
    <div className="bg-card rounded-xl border p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Radar de Governança Empresarial</h3>
          <p className="text-xs text-muted-foreground">Maturidade documental por dimensão</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${color}`}>{mediaGeral}%</p>
          <p className={`text-xs font-medium ${color}`}>{label}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="nome"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legenda com valores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {data.map(({ nome, score, totalDocs, esperados }) => {
          const { color: c } = maturidadeLabel(score);
          return (
            <div key={nome} className="rounded-lg border bg-muted/30 p-2 text-center">
              <p className={`text-base font-bold ${c}`}>{score}%</p>
              <p className="text-xs font-medium text-foreground">{nome}</p>
              <p className="text-[10px] text-muted-foreground">{totalDocs}/{esperados} docs</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
