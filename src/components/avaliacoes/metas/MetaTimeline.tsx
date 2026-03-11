import { useMetasErgonomicas } from "@/hooks/useMetasErgonomicas";
import { 
  Shield, FileText, Zap, CheckCircle2, Edit, Eye, UserCheck, Clock 
} from "lucide-react";
import type { HistoricoTipo } from "@/types/mea";

interface MetaTimelineProps {
  metaId: string;
}

const tipoIcons: Record<HistoricoTipo, React.ElementType> = {
  criacao: FileText,
  ajuste: Edit,
  acao_criada: Zap,
  execucao: Clock,
  evidencia: Eye,
  conclusao: CheckCircle2,
  aem_preenchida: Shield,
  aem_revisada: Shield,
  validacao_colaborador: UserCheck,
};

const tipoColors: Record<HistoricoTipo, string> = {
  criacao: "text-blue-500",
  ajuste: "text-yellow-500",
  acao_criada: "text-purple-500",
  execucao: "text-blue-500",
  evidencia: "text-green-500",
  conclusao: "text-green-600",
  aem_preenchida: "text-teal-500",
  aem_revisada: "text-teal-600",
  validacao_colaborador: "text-indigo-500",
};

export function MetaTimeline({ metaId }: MetaTimelineProps) {
  const { historico, isLoadingHistorico } = useMetasErgonomicas(metaId);

  if (isLoadingHistorico) {
    return <div className="text-sm text-muted-foreground animate-pulse">Carregando histórico...</div>;
  }

  if (historico.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Nenhum evento registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {historico.map((item, idx) => {
        const Icon = tipoIcons[item.tipo as HistoricoTipo] || Clock;
        const color = tipoColors[item.tipo as HistoricoTipo] || "text-muted-foreground";
        const isLast = idx === historico.length - 1;

        return (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`p-1.5 rounded-full bg-muted ${color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
            </div>
            <div className="pb-4 flex-1">
              <p className="text-sm font-medium">{item.descricao || item.tipo}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {item.usuario_nome && <span>{item.usuario_nome}</span>}
                <span>•</span>
                <span>{new Date(item.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
