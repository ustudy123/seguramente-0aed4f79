import { Star, MapPin, BadgeCheck, Video, Building2, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MarketplaceProfissional } from "@/hooks/useMarketplace";

interface ProfissionalCardProps {
  profissional: MarketplaceProfissional;
  onVerServicos?: (id: string) => void;
}

const planoLabels: Record<string, { label: string; class: string }> = {
  base: { label: "Base", class: "bg-muted text-muted-foreground" },
  profissional: { label: "Profissional", class: "bg-indigo-100 text-indigo-700" },
  parceiro: { label: "Parceiro Premium", class: "bg-gradient-to-r from-amber-400 to-orange-500 text-white" },
};

export function ProfissionalCard({ profissional, onVerServicos }: ProfissionalCardProps) {
  const plano = planoLabels[profissional.plano] || planoLabels.base;

  return (
    <div className="group relative bg-card border border-border rounded-2xl p-5 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:border-indigo-200">
      {/* Selo verificado */}
      {profissional.selo_verificado && (
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">
            <BadgeCheck className="h-3.5 w-3.5" />
            Verificado
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg shadow-indigo-500/20">
          {profissional.nome_completo.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{profissional.nome_completo}</h3>
          <p className="text-sm text-muted-foreground">{profissional.conselho} - {profissional.registro_profissional}</p>

          {/* Location */}
          {(profissional.cidade || profissional.estado) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              {[profissional.cidade, profissional.estado].filter(Boolean).join(", ")}
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-medium">{profissional.nota_media.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({profissional.total_avaliacoes})</span>
            </div>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{profissional.total_servicos_executados} serviços</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {profissional.bio && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{profissional.bio}</p>
      )}

      {/* Especialidades */}
      {profissional.especialidades && profissional.especialidades.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {profissional.especialidades.slice(0, 3).map((esp, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {esp}
            </Badge>
          ))}
          {profissional.especialidades.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{profissional.especialidades.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Modalidades */}
      <div className="flex items-center gap-2 mt-3">
        {profissional.modalidades_atendimento?.includes("presencial") && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" /> Presencial
          </div>
        )}
        {profissional.modalidades_atendimento?.includes("online") && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Video className="h-3 w-3" /> Online
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <Badge className={plano.class}>{plano.label}</Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onVerServicos?.(profissional.id)}
          className="hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
        >
          Ver Serviços
        </Button>
      </div>
    </div>
  );
}
