import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Tag, Clock, MapPin, AlertTriangle, ShoppingBag } from "lucide-react";

interface Pacote {
  id: string;
  nome: string;
  descricao: string | null;
  preco_pacote: number;
  preco_individual_soma: number | null;
  desconto_percentual: number | null;
  duracao_total_minutos: number | null;
  modalidade: string;
  publico_alvo: string | null;
  profissional?: { nome_completo: string; conselho: string; foto_url: string | null };
}

export function PacotesServicos() {
  const { data: realPacotes = [], isLoading } = useQuery({
    queryKey: ["marketplace-pacotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_pacotes")
        .select("*, profissional:marketplace_profissionais(nome_completo, conselho, foto_url)")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pacote[];
    },
  });

  const pacotes = realPacotes;

  if (isLoading) return <div className="text-center py-12 text-muted-foreground text-sm">Carregando pacotes...</div>;

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Pacotes de Serviços
        </h3>
        <Badge variant="secondary" className="text-xs">{pacotes.length} pacote(s)</Badge>
      </div>

      {pacotes.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum pacote disponível</p>
          <p className="text-xs text-muted-foreground mt-1">Profissionais podem criar pacotes combinando seus serviços.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pacotes.map((p) => (
            <div key={p.id} className="bg-card border rounded-2xl p-5 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:border-primary/20 flex flex-col">
              {/* Discount badge */}
              {p.desconto_percentual && p.desconto_percentual > 0 && (
                <div className="flex justify-end mb-2">
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    -{Math.round(p.desconto_percentual)}% OFF
                  </Badge>
                </div>
              )}

              <h4 className="font-semibold text-foreground">{p.nome}</h4>
              {p.descricao && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{p.descricao}</p>
              )}

              {/* Professional */}
              {p.profissional && (
                <div className="flex items-center gap-2 mt-3">
                  {p.profissional.foto_url ? (
                    <img src={p.profissional.foto_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {p.profissional.nome_completo.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium">{p.profissional.nome_completo}</p>
                    <p className="text-[11px] text-muted-foreground">{p.profissional.conselho}</p>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                {p.duracao_total_minutos && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {Math.round(p.duracao_total_minutos / 60)}h
                  </span>
                )}
                <span className="flex items-center gap-1 capitalize">
                  <MapPin className="h-3 w-3" /> {p.modalidade}
                </span>
              </div>

              {p.publico_alvo && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  🎯 {p.publico_alvo}
                </p>
              )}

              {/* Pricing */}
              <div className="mt-auto pt-4 border-t mt-4 flex items-end justify-between">
                <div>
                  {p.preco_individual_soma && (
                    <p className="text-xs text-muted-foreground line-through">R$ {p.preco_individual_soma.toFixed(2)}</p>
                  )}
                  <p className="text-xl font-bold text-foreground">R$ {p.preco_pacote.toFixed(2)}</p>
                </div>
                <Button size="sm" className="gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" /> Contratar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
