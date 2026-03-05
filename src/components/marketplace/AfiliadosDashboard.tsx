import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Link2, Users, DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function AfiliadosDashboard() {
  const { user } = useAuth();

  const { data: realProfissional } = useQuery({
    queryKey: ["marketplace-meu-perfil", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("marketplace_profissionais")
        .select("id, nome_completo, link_afiliado, codigo_afiliado, plano, selo_verificado")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const profissional = realProfissional;

  const { data: comissoes = [] } = useQuery({
    queryKey: ["marketplace-comissoes", realProfissional?.id],
    queryFn: async () => {
      if (!realProfissional?.id) return [];
      const { data, error } = await supabase
        .from("marketplace_afiliados_comissoes")
        .select("*")
        .eq("profissional_id", realProfissional.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!realProfissional?.id,
  });

  const copyLink = () => {
    if (profissional?.link_afiliado) {
      navigator.clipboard.writeText(profissional.link_afiliado);
      toast.success("Link copiado!");
    }
  };

  if (!profissional) {
    return (
      <div className="text-center py-16">
        <Link2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground font-medium">Programa de Afiliados</p>
        <p className="text-xs text-muted-foreground mt-1">
          Cadastre-se como profissional para acessar seu link de afiliado e ganhar comissões por indicações.
        </p>
      </div>
    );
  }

  const totalComissoes = comissoes.reduce((s, c) => s + (c.valor || 0), 0);
  const comissoesPagas = comissoes.filter((c) => c.status === "pago");
  const comissoesPendentes = comissoes.filter((c) => c.status === "pendente");

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
          <span>⚠️ <strong>Modo Demonstração</strong> — dados fictícios. Cadastre-se como profissional para ver seu painel real.</span>
        </div>
      )}
      {/* Link de afiliado */}
      <div className="p-5 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-indigo-900">Seu Link de Afiliado</h3>
          {profissional.selo_verificado && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verificado
            </Badge>
          )}
        </div>
        <p className="text-xs text-indigo-700">
          Compartilhe seu link exclusivo. Quando uma empresa se cadastrar através dele, você receberá comissão recorrente enquanto o cliente estiver ativo.
        </p>
        <div className="flex gap-2">
          <Input
            readOnly
            value={profissional.link_afiliado || `https://seguramente.app/ref/${profissional.codigo_afiliado || profissional.id.slice(0, 8)}`}
            className="text-xs bg-white"
          />
          <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        {profissional.codigo_afiliado && (
          <p className="text-[11px] text-indigo-600">
            Código: <span className="font-mono font-bold">{profissional.codigo_afiliado}</span>
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
          <p className="text-2xl font-bold">{comissoes.length}</p>
          <p className="text-[11px] text-muted-foreground">Indicações</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold">R$ {totalComissoes.toFixed(0)}</p>
          <p className="text-[11px] text-muted-foreground">Total Ganho</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{comissoesPendentes.length}</p>
          <p className="text-[11px] text-muted-foreground">Pendentes</p>
        </div>
      </div>

      {/* Commission history */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Histórico de Comissões</h4>
        {comissoes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Nenhuma comissão registrada ainda. Compartilhe seu link para começar a ganhar!
          </div>
        ) : (
          <div className="space-y-1.5">
            {comissoes.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                <div>
                  <p className="font-medium capitalize">{c.tipo?.replace(/_/g, " ") || "Indicação"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R$ {(c.valor || 0).toFixed(2)}</p>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${
                      c.status === "pago" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {c.status === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
