/**
 * Painel de visão geral do GRO (Gestão de Riscos Ocupacionais) unificado.
 * GAP-P2: Badge "Reavaliação Pendente" nos riscos com necessita_reavaliacao=true.
 */
import { useState } from "react";
import {
  Shield,
  AlertTriangle,
  Brain,
  Activity,
  Plus,
  Loader2,
  TrendingUp,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGRORiscos } from "@/hooks/useGRORiscos";
import { ExportarRelatorioErgonomia } from "./ExportarRelatorioErgonomia";
import {
  GRO_SUBTIPO_LABELS,
  GRO_NIVEL_RISCO_LABELS,
  GRO_STATUS_LABELS,
  GRO_FONTE_LABELS,
  type GRORisco,
  type GRONivelRisco,
  type GROSubtipo,
} from "@/types/gro";

const NIVEL_COLORS: Record<GRONivelRisco, string> = {
  critico: "bg-red-50 text-red-700 border-red-200",
  alto: "bg-orange-50 text-orange-700 border-orange-200",
  medio: "bg-amber-50 text-amber-700 border-amber-200",
  baixo: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const NIVEL_BORDER: Record<GRONivelRisco, string> = {
  critico: "border-l-red-500",
  alto: "border-l-orange-500",
  medio: "border-l-amber-500",
  baixo: "border-l-emerald-500",
};

interface GROPainelProps {
  onNovo?: () => void;
}

export function GROPainel({ onNovo }: GROPainelProps) {
  const { riscos, isLoading, stats, atualizarStatusGRO } = useGRORiscos();
  const [filtroSubtipo, setFiltroSubtipo] = useState<'todos' | GROSubtipo>('todos');
  const [filtroNivel, setFiltroNivel] = useState<'todos' | GRONivelRisco>('todos');
  const [filtroReavaliacao, setFiltroReavaliacao] = useState(false);

  // GAP-P2: Contar riscos que precisam de reavaliação
  const pendentesReavaliacao = riscos.filter(r => r.necessita_reavaliacao).length;

  const riscosFiltrados = riscos.filter(r => {
    if (filtroSubtipo !== 'todos' && r.subtipo !== filtroSubtipo) return false;
    if (filtroNivel !== 'todos' && r.nivel_risco !== filtroNivel) return false;
    if (filtroReavaliacao && !r.necessita_reavaliacao) return false;
    return true;
  });

  const naoToleraveis = riscos.filter(r => ['alto', 'critico'].includes(r.nivel_risco));
  const semAcao = naoToleraveis.filter(r => !r.acao_id).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total de Riscos</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{stats.fisicos} físicos · {stats.psicossociais} psicossociais</p>
            </CardContent>
          </Card>

          <Card className={cn("border", stats.criticos > 0 ? "border-red-200 bg-red-50/30" : "border-border/50")}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={cn("h-4 w-4", stats.criticos > 0 ? "text-red-600" : "text-muted-foreground")} />
                <span className="text-xs text-muted-foreground">Risco Crítico</span>
              </div>
              <p className={cn("text-2xl font-bold", stats.criticos > 0 ? "text-red-700" : "")}>{stats.criticos}</p>
              <p className="text-xs text-muted-foreground">{stats.altos} alto(s)</p>
            </CardContent>
          </Card>

          <Card className={cn("border", semAcao > 0 ? "border-orange-200 bg-orange-50/30" : "border-border/50")}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className={cn("h-4 w-4", semAcao > 0 ? "text-orange-600" : "text-muted-foreground")} />
                <span className="text-xs text-muted-foreground">Sem Ação</span>
              </div>
              <p className={cn("text-2xl font-bold", semAcao > 0 ? "text-orange-700" : "")}>{semAcao}</p>
              <p className="text-xs text-muted-foreground">riscos não toleráveis</p>
            </CardContent>
          </Card>

          {/* GAP-P2: Card de Reavaliação Pendente */}
          <Card
            className={cn(
              "border cursor-pointer transition-all",
              pendentesReavaliacao > 0 ? "border-violet-200 bg-violet-50/30 hover:bg-violet-50/50" : "border-border/50"
            )}
            onClick={() => setFiltroReavaliacao(prev => !prev)}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className={cn("h-4 w-4", pendentesReavaliacao > 0 ? "text-violet-600" : "text-muted-foreground")} />
                <span className="text-xs text-muted-foreground">Reavaliação</span>
                {filtroReavaliacao && (
                  <Badge className="h-4 px-1 text-[9px] bg-violet-600 text-white ml-auto">Filtrado</Badge>
                )}
              </div>
              <p className={cn("text-2xl font-bold", pendentesReavaliacao > 0 ? "text-violet-700" : "")}>{pendentesReavaliacao}</p>
              <p className="text-xs text-muted-foreground">aguardando revisão</p>
            </CardContent>
          </Card>
        </div>

        {/* GAP-P2: Alerta global quando há reavaliações pendentes */}
        {pendentesReavaliacao > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-violet-200 bg-violet-50/40 text-xs text-violet-800">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-600" />
            <p>
              <strong>{pendentesReavaliacao} risco(s) aguardando reavaliação</strong> — ações corretivas foram concluídas.
              Avalie se o nível de risco foi reduzido e atualize o ciclo GRO para "Revisado". (NR-01 / ISO 45003)
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[10px] text-violet-700 hover:bg-violet-100 ml-auto shrink-0"
              onClick={() => setFiltroReavaliacao(prev => !prev)}
            >
              {filtroReavaliacao ? "Ver todos" : "Filtrar"}
            </Button>
          </div>
        )}

        {/* Tabela consolidada */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Inventário GRO Unificado
                </CardTitle>
                <CardDescription className="text-xs">
                  NR-01 · NR-17 · ISO 45003 — Riscos físicos e psicossociais consolidados
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filtroSubtipo} onValueChange={v => setFiltroSubtipo(v as any)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os subtipos</SelectItem>
                    <SelectItem value="fisico">Físico</SelectItem>
                    <SelectItem value="psicossocial">Psicossocial</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filtroNivel} onValueChange={v => setFiltroNivel(v as any)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os níveis</SelectItem>
                    <SelectItem value="critico">Crítico</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>

                <ExportarRelatorioErgonomia riscos={riscos} />

                {onNovo && (
                  <Button size="sm" onClick={onNovo} className="gap-2 h-8">
                    <Plus className="h-3.5 w-3.5" />
                    Novo Risco
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {riscosFiltrados.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum risco encontrado com os filtros selecionados.</p>
                {stats.total === 0 && (
                  <p className="text-xs mt-1">Registre riscos manualmente ou importe do módulo Psicossocial.</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs pl-4">Risco / Dimensão</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Fonte</TableHead>
                    <TableHead className="text-xs text-center">Nível</TableHead>
                    <TableHead className="text-xs text-center">Ciclo GRO</TableHead>
                    <TableHead className="text-xs text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riscosFiltrados.map((risco) => (
                    <TableRow
                      key={risco.id}
                      className={cn(
                        "border-l-2",
                        NIVEL_BORDER[risco.nivel_risco],
                        risco.necessita_reavaliacao && "bg-violet-50/20"
                      )}
                    >
                      <TableCell className="py-2 pl-4">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm line-clamp-1">{risco.titulo}</p>
                            {risco.setor && (
                              <p className="text-xs text-muted-foreground">{risco.setor}{risco.cargo ? ` · ${risco.cargo}` : ""}</p>
                            )}
                            {risco.dimensao_psicossocial && (
                              <p className="text-xs text-purple-600">{risco.dimensao_psicossocial} — {risco.score_dimensao}%</p>
                            )}
                          </div>
                          {/* GAP-P2: Badge de reavaliação pendente */}
                          {risco.necessita_reavaliacao && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="shrink-0 text-[9px] h-4 px-1.5 bg-violet-100 text-violet-700 border border-violet-300 gap-1 cursor-help">
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  Reavaliar
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-56 text-xs">
                                <p className="font-semibold mb-1">Reavaliação Obrigatória</p>
                                <p>{risco.reavaliacao_motivo ?? "Ação vinculada foi concluída. Avalie se o nível de risco foi reduzido."}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={cn("text-xs", risco.subtipo === 'psicossocial' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                          {risco.subtipo === 'psicossocial' ? <Brain className="h-3 w-3 mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                          {GRO_SUBTIPO_LABELS[risco.subtipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground">{GRO_FONTE_LABELS[risco.fonte]}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <Badge className={cn("text-xs border", NIVEL_COLORS[risco.nivel_risco])}>
                          {GRO_NIVEL_RISCO_LABELS[risco.nivel_risco]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <Select
                          value={risco.status_gro}
                          onValueChange={(val) => atualizarStatusGRO.mutate({ id: risco.id, status_gro: val as GRORisco['status_gro'] })}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(GRO_STATUS_LABELS) as [GRORisco['status_gro'], string][]).map(([key, label]) => (
                              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {risco.acao_id ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Vinculada</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">Sem ação</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
