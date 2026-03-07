import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Brain,
  ClipboardCheck,
  Search,
  Filter,
  Archive,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ErgonomiaAnalise } from "@/hooks/useErgonomiaAnalises";

interface RegistrosErgonomicosProps {
  analises: ErgonomiaAnalise[];
  onArquivar: (id: string) => void;
}

const CLASSIFICACAO_CONFIG = {
  baixo: { label: "Baixo", color: "text-success bg-success/10 border-success/30", icon: "🟢" },
  moderado: { label: "Moderado", color: "text-warning bg-warning/10 border-warning/30", icon: "🟡" },
  alto: { label: "Alto", color: "text-destructive bg-destructive/10 border-destructive/30", icon: "🔴" },
};

const TIPO_CONFIG = {
  ia: { label: "Análise IA", icon: Brain, color: "text-primary bg-primary/10" },
  manual: { label: "Manual", icon: ClipboardCheck, color: "text-muted-foreground bg-muted" },
  checklist: { label: "Checklist", icon: CheckCircle2, color: "text-success bg-success/10" },
};

export function RegistrosErgonomicos({ analises, onArquivar }: RegistrosErgonomicosProps) {
  const [busca, setBusca] = useState("");
  const [filtroClassificacao, setFiltroClassificacao] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [analiseDetalhe, setAnaliseDetalhe] = useState<ErgonomiaAnalise | null>(null);

  const analisesFiltradas = analises.filter((a) => {
    const matchBusca =
      !busca ||
      a.setor.toLowerCase().includes(busca.toLowerCase()) ||
      a.cargo.toLowerCase().includes(busca.toLowerCase()) ||
      (a.atividade || "").toLowerCase().includes(busca.toLowerCase());

    const matchClassificacao =
      filtroClassificacao === "todos" || a.classificacao_risco === filtroClassificacao;

    const matchTipo = filtroTipo === "todos" || a.tipo_analise === filtroTipo;

    return matchBusca && matchClassificacao && matchTipo;
  });

  if (analises.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center">
          <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Base ergonômica vazia</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            As análises realizadas pela IA ou manualmente serão armazenadas aqui
            automaticamente e utilizadas para gerar documentos, mapas de risco e
            indicadores.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por setor, cargo ou atividade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="baixo">🟢 Baixo</SelectItem>
            <SelectItem value="moderado">🟡 Moderado</SelectItem>
            <SelectItem value="alto">🔴 Alto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="ia">Análise IA</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="checklist">Checklist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {analisesFiltradas.length} de {analises.length} registros
      </p>

      {/* Lista */}
      <div className="space-y-3">
        {analisesFiltradas.map((analise, idx) => {
          const tipoConfig = TIPO_CONFIG[analise.tipo_analise];
          const TipoIcon = tipoConfig.icon;
          const classConfig = CLASSIFICACAO_CONFIG[analise.classificacao_risco];

          return (
            <motion.div
              key={analise.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <Card className="border-border/50 hover:shadow-sm transition-all">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn("p-2 rounded-lg shrink-0", tipoConfig.color)}>
                        <TipoIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{analise.cargo}</span>
                          <span className="text-muted-foreground text-xs">—</span>
                          <span className="text-sm text-muted-foreground">{analise.setor}</span>
                          <Badge variant="outline" className={cn("text-xs border", classConfig.color)}>
                            {classConfig.icon} {classConfig.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {tipoConfig.label}
                          </Badge>
                        </div>

                        {analise.atividade && (
                          <p className="text-xs text-muted-foreground mb-1.5">
                            {analise.atividade}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>
                            {(analise.riscos_identificados || []).length} risco(s) identificado(s)
                          </span>
                          <span>•</span>
                          <span>
                            Conformidade: {analise.conformidade_estimada}%
                          </span>
                          <span>•</span>
                          <span>
                            {format(new Date(analise.data_analise), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                          {analise.realizado_por && (
                            <>
                              <span>•</span>
                              <span>{analise.realizado_por}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnaliseDetalhe(analise)}
                        className="gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onArquivar(analise.id)}
                        className="text-muted-foreground gap-1.5"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Modal de detalhe */}
      <Dialog open={!!analiseDetalhe} onOpenChange={(o) => !o && setAnaliseDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {analiseDetalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Registro Ergonômico — {analiseDetalhe.cargo}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* Identificação */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Setor</span>
                    <p className="font-medium">{analiseDetalhe.setor}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Cargo</span>
                    <p className="font-medium">{analiseDetalhe.cargo}</p>
                  </div>
                  {analiseDetalhe.atividade && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Atividade</span>
                      <p className="font-medium">{analiseDetalhe.atividade}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-xs">Tipo de Análise</span>
                    <p className="font-medium capitalize">{analiseDetalhe.tipo_analise}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Data</span>
                    <p className="font-medium">
                      {format(new Date(analiseDetalhe.data_analise), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Resumo */}
                {analiseDetalhe.resumo_geral && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Resumo Geral</h4>
                    <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      {analiseDetalhe.resumo_geral}
                    </p>
                  </div>
                )}

                {/* Riscos */}
                {(analiseDetalhe.riscos_identificados || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Riscos Identificados ({analiseDetalhe.riscos_identificados.length})
                    </h4>
                    <div className="space-y-2">
                      {analiseDetalhe.riscos_identificados.map((risco, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-muted/50 text-sm">
                          <div className="flex flex-wrap gap-2 mb-1">
                            <span className="font-medium">{risco.tipo}</span>
                            <Badge variant="outline" className="text-xs">{risco.eixo}</Badge>
                            <Badge variant="outline" className="text-xs">{risco.severidade}</Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">{risco.descricao}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recomendações */}
                {(analiseDetalhe.recomendacoes || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Recomendações
                    </h4>
                    <ul className="space-y-1.5">
                      {analiseDetalhe.recomendacoes.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
