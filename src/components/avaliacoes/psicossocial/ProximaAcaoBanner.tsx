import { ArrowRight, Link2, BarChart3, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type CampanhaPsicossocial, getMinimoRespostas } from "@/types/psicossocial";

interface ProximaAcaoBannerProps {
  campanhas: CampanhaPsicossocial[];
  onDistribuir: (campanha: CampanhaPsicossocial) => void;
  onVerResultados: (campanha: CampanhaPsicossocial) => void;
}

export function ProximaAcaoBanner({ campanhas, onDistribuir, onVerResultados }: ProximaAcaoBannerProps) {
  const ativas = campanhas.filter(c => c.status === 'ativa');
  const rascunhos = campanhas.filter(c => c.status === 'rascunho');
  
  const ativaComPoucasRespostas = ativas.find(c => (c.total_respostas || 0) < getMinimoRespostas(c));
  const ativaComRespostas = ativas.find(c => (c.total_respostas || 0) >= getMinimoRespostas(c));

  // Rascunho pendente de ativação
  if (rascunhos.length > 0 && ativas.length === 0) {
    return (
      <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 bg-amber-50/60",
        "flex-col sm:flex-row"
      )}>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-amber-100 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-amber-800">
              Campanha em rascunho — Pronta para ativar!
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Ative a campanha "{rascunhos[0].nome}" para começar a coletar respostas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-700 font-medium shrink-0">
          Vá em <strong className="mx-1">Campanhas</strong> → menu ⋮ → Ativar
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </div>
      </div>
    );
  }

  // Campanha ativa, mas sem respostas suficientes
  if (ativaComPoucasRespostas) {
    const respostas = ativaComPoucasRespostas.total_respostas || 0;
    const minimo = getMinimoRespostas(ativaComPoucasRespostas);
    const faltam = minimo - respostas;
    return (
      <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/60",
        "flex-col sm:flex-row"
      )}>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-blue-100 shrink-0">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-blue-800">
              Aguardando respostas — faltam {faltam} para liberar análise
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Campanha <strong>"{ativaComPoucasRespostas.nome}"</strong> tem {respostas} resposta{respostas !== 1 ? 's' : ''}. 
              Mínimo de {minimo} garante o anonimato.
            </p>
          </div>
        </div>
        <Button
          id="btn-enviar-link-banner"
          size="sm"
          variant="outline"
          className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-2 shrink-0"
          onClick={() => onDistribuir(ativaComPoucasRespostas)}
        >
          <Link2 className="h-4 w-4" />
          Enviar Link
        </Button>
      </div>
    );
  }

  // Campanha ativa com respostas suficientes
  if (ativaComRespostas) {
    return (
      <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/60",
        "flex-col sm:flex-row"
      )}>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-emerald-100 shrink-0">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-emerald-800">
              ✅ Análise disponível — {ativaComRespostas.total_respostas} respostas coletadas!
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              O IPS e todos os índices de <strong>"{ativaComRespostas.nome}"</strong> estão prontos para visualização.
            </p>
          </div>
        </div>
        <Button
          id="btn-ver-resultados-banner"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
          onClick={() => onVerResultados(ativaComRespostas)}
        >
          <BarChart3 className="h-4 w-4" />
          Ver Resultados
        </Button>
      </div>
    );
  }

  return null;
}
