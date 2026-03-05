import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Star, CheckCircle2, Target, Clock, TrendingUp } from "lucide-react";

export function PerformanceDashboard() {
  const { user } = useAuth();

  const { data: realProfissional } = useQuery({
    queryKey: ["marketplace-meu-perfil-perf", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("marketplace_profissionais")
        .select("id, nome_completo, nota_media, total_avaliacoes, total_servicos_executados, plano, selo_verificado")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (!realProfissional) {
    return (
      <div className="bg-card border rounded-2xl p-8 text-center">
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Sem dados reais de performance para exibir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{realProfissional.nome_completo}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-warning fill-warning" />
            {Number(realProfissional.nota_media || 0).toFixed(1)} ({realProfissional.total_avaliacoes || 0} avaliações)
            {realProfissional.selo_verificado && (
              <Badge className="bg-success/10 text-success text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verificado
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-success mb-1" />
          <p className="text-2xl font-bold">{realProfissional.total_servicos_executados || 0}</p>
          <p className="text-[11px] text-muted-foreground">Serviços Executados</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <Target className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">0</p>
          <p className="text-[11px] text-muted-foreground">Este Mês</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-warning mb-1" />
          <p className="text-2xl font-bold">0%</p>
          <p className="text-[11px] text-muted-foreground">Taxa de Conclusão</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 mx-auto text-info mb-1" />
          <p className="text-2xl font-bold">0h</p>
          <p className="text-[11px] text-muted-foreground">Tempo Médio Resposta</p>
        </div>
      </div>
    </div>
  );
}
