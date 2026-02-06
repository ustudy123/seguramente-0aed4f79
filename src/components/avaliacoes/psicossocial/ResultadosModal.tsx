import { 
  BarChart3, 
  AlertTriangle, 
  Brain, 
  Heart, 
  TrendingUp, 
  Users,
  Download,
  FileText
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { BLOCOS_PSICOSSOCIAL } from "@/types/psicossocial";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

interface ResultadosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: CampanhaPsicossocial;
}

export function ResultadosModal({ open, onOpenChange, campanha }: ResultadosModalProps) {
  const { useEstatisticasCampanha, useRespostasCampanha } = usePsicossocial();
  const { data: stats, isLoading: loadingStats } = useEstatisticasCampanha(campanha.id);
  const { data: respostas = [], isLoading: loadingRespostas } = useRespostasCampanha(campanha.id);

  const getNivelIndicador = (valor?: number): { label: string; color: string } => {
    if (!valor) return { label: "—", color: "text-muted-foreground" };
    if (valor <= 2) return { label: "Baixo", color: "text-emerald-600" };
    if (valor <= 3) return { label: "Moderado", color: "text-amber-600" };
    if (valor <= 4) return { label: "Alto", color: "text-orange-600" };
    return { label: "Crítico", color: "text-red-600" };
  };

  const getProgressColor = (valor?: number): string => {
    if (!valor) return "bg-muted";
    if (valor <= 2) return "bg-emerald-500";
    if (valor <= 3) return "bg-amber-500";
    if (valor <= 4) return "bg-orange-500";
    return "bg-red-500";
  };

  // Calcular médias por bloco
  const mediasPorBloco = BLOCOS_PSICOSSOCIAL.map(bloco => {
    const respostasBloco = respostas
      .filter(r => r.indicadores?.detalhes)
      .map(r => r.indicadores?.detalhes?.find(d => d.bloco === bloco.titulo)?.media || 0);
    
    const media = respostasBloco.length > 0 
      ? respostasBloco.reduce((a, b) => a + b, 0) / respostasBloco.length 
      : 0;
    
    return {
      bloco: bloco.titulo,
      media: Number(media.toFixed(2)),
    };
  });

  const isLoading = loadingStats || loadingRespostas;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Resultados da Campanha
          </DialogTitle>
          <DialogDescription>
            {campanha.nome} • {stats?.concluidos || 0} respostas de {stats?.total_convites || 0} convites
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : stats?.concluidos === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma resposta ainda</h3>
            <p className="text-muted-foreground">
              Aguardando colaboradores responderem o questionário
            </p>
          </div>
        ) : (
          <Tabs defaultValue="indicadores" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
              <TabsTrigger value="blocos">Por Bloco</TabsTrigger>
              <TabsTrigger value="participacao">Participação</TabsTrigger>
            </TabsList>

            {/* Indicadores Principais */}
            <TabsContent value="indicadores" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-5">
                {/* IRP-S */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-red-100">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <CardTitle className="text-sm">IRP-S</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Risco Psicossocial
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.media_IRP_S?.toFixed(1) || "—"}</div>
                    <Badge variant="outline" className={getNivelIndicador(stats?.media_IRP_S).color}>
                      {getNivelIndicador(stats?.media_IRP_S).label}
                    </Badge>
                    <Progress 
                      value={(stats?.media_IRP_S || 0) * 20} 
                      className={`h-2 mt-2 ${getProgressColor(stats?.media_IRP_S)}`} 
                    />
                  </CardContent>
                </Card>

                {/* IBO-S */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-orange-100">
                        <Brain className="h-4 w-4 text-orange-600" />
                      </div>
                      <CardTitle className="text-sm">IBO-S</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Burnout
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.media_IBO_S?.toFixed(1) || "—"}</div>
                    <Badge variant="outline" className={getNivelIndicador(stats?.media_IBO_S).color}>
                      {getNivelIndicador(stats?.media_IBO_S).label}
                    </Badge>
                    <Progress 
                      value={(stats?.media_IBO_S || 0) * 20} 
                      className={`h-2 mt-2 ${getProgressColor(stats?.media_IBO_S)}`} 
                    />
                  </CardContent>
                </Card>

                {/* IBD-S */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-purple-100">
                        <Heart className="h-4 w-4 text-purple-600" />
                      </div>
                      <CardTitle className="text-sm">IBD-S</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Boreout
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.media_IBD_S?.toFixed(1) || "—"}</div>
                    <Badge variant="outline" className={getNivelIndicador(stats?.media_IBD_S).color}>
                      {getNivelIndicador(stats?.media_IBD_S).label}
                    </Badge>
                    <Progress 
                      value={(stats?.media_IBD_S || 0) * 20} 
                      className={`h-2 mt-2 ${getProgressColor(stats?.media_IBD_S)}`} 
                    />
                  </CardContent>
                </Card>

                {/* IREC-S */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-blue-100">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      </div>
                      <CardTitle className="text-sm">IREC-S</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Recuperação
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.media_IREC_S?.toFixed(1) || "—"}</div>
                    <Badge variant="outline" className={getNivelIndicador(stats?.media_IREC_S).color}>
                      {getNivelIndicador(stats?.media_IREC_S).label}
                    </Badge>
                    <Progress 
                      value={(stats?.media_IREC_S || 0) * 20} 
                      className={`h-2 mt-2 ${getProgressColor(stats?.media_IREC_S)}`} 
                    />
                  </CardContent>
                </Card>

                {/* ICOP-S */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-full bg-emerald-100">
                        <BarChart3 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <CardTitle className="text-sm">ICOP-S</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Clareza Organizacional
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.media_ICOP_S?.toFixed(1) || "—"}</div>
                    <Badge variant="outline" className={getNivelIndicador(stats?.media_ICOP_S).color}>
                      {getNivelIndicador(stats?.media_ICOP_S).label}
                    </Badge>
                    <Progress 
                      value={(stats?.media_ICOP_S || 0) * 20} 
                      className={`h-2 mt-2 ${getProgressColor(stats?.media_ICOP_S)}`} 
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Legenda */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Escala de Interpretação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm">Baixo (1-2)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm">Moderado (2-3)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm">Alto (3-4)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">Crítico (4-5)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Por Bloco */}
            <TabsContent value="blocos" className="space-y-4">
              <div className="grid gap-3">
                {mediasPorBloco.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        {index + 1}.
                      </div>
                      <div>
                        <p className="font-medium">{item.bloco}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress 
                        value={item.media * 20} 
                        className={`w-32 h-2 ${getProgressColor(item.media)}`} 
                      />
                      <div className="w-12 text-right font-bold">
                        {item.media.toFixed(1)}
                      </div>
                      <Badge variant="outline" className={getNivelIndicador(item.media).color}>
                        {getNivelIndicador(item.media).label}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Participação */}
            <TabsContent value="participacao" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de Convites</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.total_convites || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Concluídos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{stats?.concluidos || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{stats?.pendentes || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taxa de Participação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.taxa_participacao?.toFixed(0) || 0}%</div>
                    <Progress value={stats?.taxa_participacao || 0} className="h-2 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {stats && stats.concluidos > 0 && (
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
