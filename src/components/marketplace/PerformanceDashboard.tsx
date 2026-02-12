import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Star, TrendingUp, CheckCircle2, Clock, Award, AlertTriangle, Users, Target } from "lucide-react";

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

  const demoData = {
    profissional: {
      id: "demo", nome_completo: "Mariana Silva", nota_media: 4.7,
      total_avaliacoes: 23, total_servicos_executados: 31, plano: "profissional", selo_verificado: true,
    },
    servicos_mes: 8,
    taxa_conclusao: 96.8,
    tempo_medio_resposta_h: 2.4,
    receita_total: 18750,
    receita_mes: 4200,
    top_servicos: [
      { nome: "Análise Ergonômica (AET)", quantidade: 12, receita: 7200 },
      { nome: "Laudo Ergonômico", quantidade: 8, receita: 4800 },
      { nome: "Treinamento NR-17", quantidade: 6, receita: 3600 },
      { nome: "Avaliação Psicossocial", quantidade: 5, receita: 3150 },
    ],
    avaliacoes_recentes: [
      { criterio: "Pontualidade", media: 4.8 },
      { criterio: "Clareza", media: 4.6 },
      { criterio: "Aderência ao Escopo", media: 4.9 },
      { criterio: "Profissionalismo", media: 4.5 },
    ],
    evolucao_mensal: [
      { mes: "Set", servicos: 3, receita: 1800 },
      { mes: "Out", servicos: 5, receita: 3000 },
      { mes: "Nov", servicos: 6, receita: 3600 },
      { mes: "Dez", servicos: 5, receita: 2950 },
      { mes: "Jan", servicos: 7, receita: 4200 },
      { mes: "Fev", servicos: 8, receita: 4200 },
    ],
  };

  const prof = realProfissional || demoData.profissional;
  const isDemo = !realProfissional;

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>Modo Demonstração</strong> — dados fictícios. Cadastre-se como profissional para ver seu relatório real.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{prof.nome_completo}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            {prof.nota_media.toFixed(1)} ({prof.total_avaliacoes} avaliações)
            {prof.selo_verificado && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verificado
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold">{prof.total_servicos_executados}</p>
          <p className="text-[11px] text-muted-foreground">Serviços Executados</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <Target className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{isDemo ? demoData.servicos_mes : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Este Mês</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{isDemo ? `${demoData.taxa_conclusao}%` : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Taxa de Conclusão</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 mx-auto text-indigo-500 mb-1" />
          <p className="text-2xl font-bold">{isDemo ? `${demoData.tempo_medio_resposta_h}h` : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Tempo Médio Resposta</p>
        </div>
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-semibold text-emerald-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Receita
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-emerald-700">Este mês</p>
              <p className="text-xl font-bold text-emerald-900">R$ {isDemo ? demoData.receita_mes.toLocaleString("pt-BR") : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-700">Total acumulado</p>
              <p className="text-xl font-bold text-emerald-900">R$ {isDemo ? demoData.receita_total.toLocaleString("pt-BR") : "—"}</p>
            </div>
          </div>
        </div>

        {/* Rating breakdown */}
        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" /> Avaliações por Critério
          </h4>
          <div className="space-y-2">
            {(isDemo ? demoData.avaliacoes_recentes : []).map((a) => (
              <div key={a.criterio} className="flex items-center justify-between">
                <span className="text-sm">{a.criterio}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(a.media / 5) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{a.media}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top services */}
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" /> Serviços Mais Executados
        </h4>
        <div className="space-y-2">
          {(isDemo ? demoData.top_servicos : []).map((s, i) => (
            <div key={s.nome} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
              <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.nome}</p>
                <p className="text-xs text-muted-foreground">{s.quantidade} execuções</p>
              </div>
              <p className="text-sm font-semibold">R$ {s.receita.toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly evolution */}
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Evolução Mensal
        </h4>
        <div className="flex items-end gap-2 h-32">
          {(isDemo ? demoData.evolucao_mensal : []).map((m) => {
            const maxServ = Math.max(...demoData.evolucao_mensal.map((x) => x.servicos));
            const pct = maxServ > 0 ? (m.servicos / maxServ) * 100 : 0;
            return (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium">{m.servicos}</span>
                <div className="w-full bg-muted rounded-t-lg overflow-hidden" style={{ height: `${Math.max(pct, 8)}%` }}>
                  <div className="w-full h-full bg-gradient-to-t from-primary/80 to-primary/40 rounded-t-lg" />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.mes}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Premium upsell (P8) */}
      {(prof.plano === "base" || prof.plano === "profissional") && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 rounded-2xl p-6 text-white space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            <h4 className="font-bold text-lg">Plano Parceiro Premium</h4>
          </div>
          <p className="text-indigo-200 text-sm">
            Eleve seu perfil com benefícios exclusivos para profissionais de destaque.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { icon: "🏷️", text: "Taxas reduzidas" },
              { icon: "✅", text: "Selo de verificação Seguramente" },
              { icon: "🏢", text: "Acesso a empresas estratégicas" },
              { icon: "📢", text: "Co-marketing e divulgação" },
              { icon: "🔝", text: "Prioridade nas sugestões" },
              { icon: "📊", text: "Relatórios avançados" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-2 text-indigo-200">
                <span>{b.icon}</span> {b.text}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Badge className="bg-amber-400/20 text-amber-300 text-xs border border-amber-400/30">Em breve</Badge>
            <p className="text-xs text-indigo-300">Funcionalidades premium serão ativadas em breve.</p>
          </div>
        </div>
      )}
    </div>
  );
}
