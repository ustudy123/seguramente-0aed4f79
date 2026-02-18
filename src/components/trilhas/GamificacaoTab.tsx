import { Trophy, Award, GraduationCap, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MedalhasGaleria } from "./MedalhasGaleria";
import { CertificadosList } from "./CertificadosList";
import { RankingBoard } from "./RankingBoard";
import { useGamificacao } from "@/hooks/useGamificacao";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBanner } from "./DemoBanner";

export function GamificacaoTab() {
  const { minhasMedalhas, meusCertificados, ranking, isDemo } = useGamificacao();

  return (
    <div className="space-y-6">
      {isDemo && <DemoBanner />}
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Trophy className="w-5 h-5 text-warning" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{minhasMedalhas.length}</p>
              <p className="text-xs text-muted-foreground">Medalhas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{meusCertificados.length}</p>
              <p className="text-xs text-muted-foreground">Certificados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <TrendingUp className="w-5 h-5 text-info" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{ranking.length}</p>
              <p className="text-xs text-muted-foreground">Participantes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="medalhas" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-sm">
          <TabsTrigger value="medalhas">Medalhas</TabsTrigger>
          <TabsTrigger value="certificados">Certificados</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>
        <TabsContent value="medalhas" className="mt-4">
          <MedalhasGaleria />
        </TabsContent>
        <TabsContent value="certificados" className="mt-4">
          <CertificadosList />
        </TabsContent>
        <TabsContent value="ranking" className="mt-4">
          <RankingBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
