import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, FileText, AlertTriangle, Target, UserCheck,
  ArrowRight, RotateCcw, Sparkles, BarChart2, Building2
} from "lucide-react";
import { ImportacaoState } from "./ImportacaoInteligente";
import { useNavigate } from "react-router-dom";

interface Props {
  state: ImportacaoState;
  resetar: () => void;
  onVerDocumentos?: () => void;
}

export function EtapaConsolidacao({ state, resetar, onVerDocumentos }: Props) {
  const navigate = useNavigate();
  const dados = state.dadosExtraidos;

  const stats = [
    {
      icon: AlertTriangle,
      label: "Riscos identificados",
      value: dados?.inventario_riscos?.length || 0,
      color: "text-amber-600",
    },
    {
      icon: Target,
      label: "Ações no plano",
      value: dados?.plano_acao?.length || 0,
      color: "text-primary",
    },
    {
      icon: UserCheck,
      label: "Responsáveis técnicos",
      value: dados?.responsaveis_tecnicos?.length || 0,
      color: "text-green-600",
    },
    {
      icon: Building2,
      label: "Setores mapeados",
      value: dados?.estrutura_organizacional?.setores?.length || 0,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Sucesso */}
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
          <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-2xl mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Documento Importado com Sucesso!</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            O documento <strong>{state.arquivo?.name}</strong> foi processado e todos os dados estruturados
            foram salvos no sistema.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary">{state.tipoDetectado}</Badge>
            {dados?.score_qualidade && (
              <Badge variant="outline" className={`${
                dados.score_qualidade.geral >= 70 ? "border-green-300 text-green-700" :
                dados.score_qualidade.geral >= 40 ? "border-amber-300 text-amber-700" :
                "border-destructive/30 text-destructive"
              }`}>
                Score: {dados.score_qualidade.geral}%
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo da extração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Resumo da Importação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="p-3 rounded-xl border bg-muted/30 text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Próximos passos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos Passos Recomendados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: Sparkles, label: "Executar análise IA de conformidade", action: () => {}, badge: "Recomendado" },
            { icon: Target, label: "Revisar e importar ações para o Plano de Ação", action: () => navigate("/plano-acao"), badge: null },
            { icon: AlertTriangle, label: "Verificar alertas de conformidade", action: () => {}, badge: null },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={item.action}>
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm flex-1">{item.label}</span>
                {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={resetar}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Importar Outro Documento
        </Button>
        {onVerDocumentos && (
          <Button variant="secondary" onClick={onVerDocumentos}>
            <FileText className="w-4 h-4 mr-2" />
            Ver Documentos Importados
          </Button>
        )}
        <Button onClick={() => navigate("/plano-acao")}>
          Ver Plano de Ação
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
