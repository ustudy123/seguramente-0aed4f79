import { Heart, Target, Eye, ThumbsUp, ThumbsDown, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEstrategia } from "@/hooks/useEstrategia";

export function CulturaValoresModule() {
  const { cultura, loadingCultura } = useEstrategia();

  if (loadingCultura) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!cultura) {
    return (
      <div className="bg-muted/30 rounded-lg p-6 border border-border text-center">
        <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Os dados de cultura da empresa ainda não foram configurados.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Peça ao RH para preencher a seção Cultura em Estratégia & Governança.
        </p>
      </div>
    );
  }

  const valores = Array.isArray(cultura.valores) ? cultura.valores : [];
  const principios = Array.isArray(cultura.principios) ? cultura.principios : [];
  const comportamentosEsperados = Array.isArray(cultura.comportamentos_esperados) ? cultura.comportamentos_esperados : [];
  const comportamentosNaoTolerados = Array.isArray(cultura.comportamentos_nao_tolerados) ? cultura.comportamentos_nao_tolerados : [];

  return (
    <div className="space-y-5">
      {/* Missão */}
      {cultura.missao && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Nossa Missão</h4>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{cultura.missao}</p>
          </CardContent>
        </Card>
      )}

      {/* Visão */}
      {cultura.visao && (
        <Card className="border-accent bg-accent/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-5 h-5 text-accent-foreground" />
              <h4 className="font-semibold text-foreground">Nossa Visão</h4>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{cultura.visao}</p>
          </CardContent>
        </Card>
      )}

      {/* Valores */}
      {valores.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-rose-500" />
              <h4 className="font-semibold text-foreground">Nossos Valores</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {valores.map((v: string, i: number) => (
                <Badge key={i} className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">
                  {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Princípios */}
      {principios.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h4 className="font-semibold text-foreground">Princípios Culturais</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {principios.map((p: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-accent text-accent-foreground text-sm px-3 py-1">
                  {p}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comportamentos Esperados */}
      {comportamentosEsperados.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="w-5 h-5 text-emerald-500" />
              <h4 className="font-semibold text-foreground">O que Esperamos</h4>
            </div>
            <ul className="space-y-1.5">
              {comportamentosEsperados.map((c: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Comportamentos Não Tolerados */}
      {comportamentosNaoTolerados.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="w-5 h-5 text-destructive" />
              <h4 className="font-semibold text-foreground">O que Não Toleramos</h4>
            </div>
            <ul className="space-y-1.5">
              {comportamentosNaoTolerados.map((c: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-destructive mt-0.5">✕</span>
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
