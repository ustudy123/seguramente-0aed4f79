import { Clock, MapPin, Video, Building2, FileText, Star, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MarketplaceServico } from "@/hooks/useMarketplace";

interface ServicoCardProps {
  servico: MarketplaceServico;
  onContratar?: (servico: MarketplaceServico) => void;
}

const modalidadeConfig: Record<string, { icon: React.ElementType; label: string; class: string }> = {
  presencial: { icon: Building2, label: "Presencial", class: "text-blue-700 bg-blue-50" },
  online: { icon: Video, label: "Online", class: "text-green-700 bg-green-50" },
  hibrido: { icon: MapPin, label: "Híbrido", class: "text-purple-700 bg-purple-50" },
};

export function ServicoCard({ servico, onContratar }: ServicoCardProps) {
  const mod = modalidadeConfig[servico.modalidade] || modalidadeConfig.presencial;
  const ModIcon = mod.icon;
  const prof = servico.profissional;

  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:border-indigo-200">
      {/* Header gradient */}
      <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

      <div className="p-5 space-y-4">
        {/* Service name + category */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">{servico.nome}</h3>
            <Badge className={mod.class} variant="secondary">
              <ModIcon className="h-3 w-3 mr-1" />
              {mod.label}
            </Badge>
          </div>
          {servico.categoria && (
            <p className="text-xs text-muted-foreground mt-1">{servico.categoria.nome}</p>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">{servico.descricao}</p>

        {/* Base legal */}
        {servico.base_legal && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>{servico.base_legal}</span>
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm">
          {servico.duracao_estimada_minutos && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{servico.duracao_estimada_minutos} min</span>
            </div>
          )}
          {servico.preco_referencia && (
            <div className="font-semibold text-foreground">
              R$ {servico.preco_referencia.toFixed(2)}
            </div>
          )}
        </div>

        {/* Professional */}
        {prof && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            {prof.foto_url ? (
              <img src={prof.foto_url} alt={prof.nome_completo} className="w-9 h-9 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {prof.nome_completo.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{prof.nome_completo}</span>
                {prof.selo_verificado && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{prof.conselho}</span>
                <span>•</span>
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                <span>{prof.nota_media.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <Button
          className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-700"
          onClick={() => onContratar?.(servico)}
        >
          Solicitar Serviço
        </Button>
      </div>
    </div>
  );
}
