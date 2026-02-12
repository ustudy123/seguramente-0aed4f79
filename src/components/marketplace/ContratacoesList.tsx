import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MarketplaceContratacao } from "@/hooks/useMarketplace";

interface ContratacoesListProps {
  contratacoes: MarketplaceContratacao[];
  onConfirmarExecucao?: (contratacao: MarketplaceContratacao) => void;
  onAvaliar?: (contratacao: MarketplaceContratacao) => void;
}

const statusConfig: Record<string, { label: string; class: string }> = {
  solicitada: { label: "Solicitada", class: "bg-blue-100 text-blue-700" },
  aceita: { label: "Aceita", class: "bg-indigo-100 text-indigo-700" },
  em_andamento: { label: "Em Andamento", class: "bg-amber-100 text-amber-700" },
  concluida: { label: "Concluída", class: "bg-emerald-100 text-emerald-700" },
  cancelada: { label: "Cancelada", class: "bg-red-100 text-red-700" },
  recusada: { label: "Recusada", class: "bg-gray-100 text-gray-700" },
};

export function ContratacoesList({ contratacoes, onConfirmarExecucao, onAvaliar }: ContratacoesListProps) {
  if (contratacoes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhuma contratação realizada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contratacoes.map((c) => {
        const st = statusConfig[c.status] || statusConfig.solicitada;
        return (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            {c.profissional?.foto_url ? (
              <img src={c.profissional.foto_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {c.profissional?.nome_completo?.charAt(0) || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{c.servico?.nome || "Serviço"}</p>
              <p className="text-xs text-muted-foreground">{c.profissional?.nome_completo}</p>
              {c.data_agendamento && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(c.data_agendamento), "dd/MM/yyyy", { locale: ptBR })}
                  {c.hora_agendamento && ` às ${c.hora_agendamento}`}
                </p>
              )}
            </div>
            <div className="text-right space-y-1">
              <Badge className={st.class}>{st.label}</Badge>
              {c.valor && <p className="text-sm font-medium">R$ {c.valor.toFixed(2)}</p>}
              {onConfirmarExecucao && (c.status === "aceita" || c.status === "em_andamento") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onConfirmarExecucao(c)}
                  className="mt-1 text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Confirmar
                </Button>
              )}
              {onAvaliar && c.status === "concluida" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAvaliar(c)}
                  className="mt-1 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Avaliar
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
