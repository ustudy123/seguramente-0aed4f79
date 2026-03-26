import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, differenceInDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Plus,
} from "lucide-react";
import { AlertaAcaoModal } from "./AlertaAcaoModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EpiCompleto, EpiEntrega, EpiTipo } from "@/types/epi";

interface EpiAlertasTabProps {
  epis: EpiCompleto[];
  entregas: (EpiEntrega & { epi: EpiCompleto })[];
  tipos: EpiTipo[];
}

interface Alerta {
  id: string;
  tipo: "critico" | "urgente" | "atencao" | "info";
  categoria: string;
  titulo: string;
  descricao: string;
  item: string;
  colaborador?: string;
  diasRestantes?: number;
  dataReferencia?: string;
}


export function EpiAlertasTab({ epis, entregas, tipos }: EpiAlertasTabProps) {
  const [alertaParaAcao, setAlertaParaAcao] = useState<Alerta | null>(null);
  const hoje = new Date();

  const alertas = useMemo(() => {
    const lista: Alerta[] = [];

    // 1. CA Vencido ou próximo do vencimento
    tipos.forEach((tipo) => {
      const caValidade = (tipo as any).ca_validade;
      if (caValidade) {
        const dataCA = new Date(caValidade);
        const dias = differenceInDays(dataCA, hoje);
        if (dias < 0) {
          lista.push({
            id: `ca-vencido-${tipo.id}`,
            tipo: "critico",
            categoria: "CA Vencido",
            titulo: `CA ${(tipo as any).ca_numero || "s/n"} vencido`,
            descricao: `Certificado de Aprovação venceu há ${Math.abs(dias)} dias. Entregas com este EPI são juridicamente inválidas.`,
            item: tipo.nome,
            diasRestantes: dias,
            dataReferencia: caValidade,
          });
        } else if (dias <= 30) {
          lista.push({
            id: `ca-vencendo-${tipo.id}`,
            tipo: "urgente",
            categoria: "CA Vencendo",
            titulo: `CA ${(tipo as any).ca_numero || "s/n"} vence em ${dias} dias`,
            descricao: `Renove o CA antes do vencimento para manter a conformidade legal.`,
            item: tipo.nome,
            diasRestantes: dias,
            dataReferencia: caValidade,
          });
        } else if (dias <= 90) {
          lista.push({
            id: `ca-atencao-${tipo.id}`,
            tipo: "atencao",
            categoria: "CA Atenção",
            titulo: `CA ${(tipo as any).ca_numero || "s/n"} vence em ${dias} dias`,
            descricao: `Planeje a renovação do Certificado de Aprovação.`,
            item: tipo.nome,
            diasRestantes: dias,
            dataReferencia: caValidade,
          });
        }
      }
    });

    // 2. EPIs em estoque com validade vencida ou próxima
    epis.forEach((epi) => {
      if (epi.data_validade) {
        const dataVal = new Date(epi.data_validade);
        const dias = differenceInDays(dataVal, hoje);
        if (dias < 0) {
          lista.push({
            id: `epi-vencido-${epi.id}`,
            tipo: "critico",
            categoria: "EPI Vencido",
            titulo: `${epi.tipo?.nome || "EPI"} com validade expirada`,
            descricao: `Item no estoque venceu há ${Math.abs(dias)} dias. Deve ser descartado e reposto.`,
            item: epi.tipo?.nome || "EPI",
            diasRestantes: dias,
            dataReferencia: epi.data_validade,
          });
        } else if (dias <= 30) {
          lista.push({
            id: `epi-vencendo-${epi.id}`,
            tipo: "urgente",
            categoria: "EPI Vencendo",
            titulo: `${epi.tipo?.nome || "EPI"} vence em ${dias} dias`,
            descricao: `Providencie reposição antes do vencimento.`,
            item: epi.tipo?.nome || "EPI",
            diasRestantes: dias,
            dataReferencia: epi.data_validade,
          });
        } else if (dias <= 90) {
          lista.push({
            id: `epi-atencao-${epi.id}`,
            tipo: "atencao",
            categoria: "EPI Atenção",
            titulo: `${epi.tipo?.nome || "EPI"} vence em ${dias} dias`,
            descricao: `Monitore a validade e prepare reposição.`,
            item: epi.tipo?.nome || "EPI",
            diasRestantes: dias,
            dataReferencia: epi.data_validade,
          });
        }
      }
    });

    // 3. Entregas ativas com validade vencida (colaborador usando EPI vencido)
    entregas
      .filter((e) => e.status === "ativa")
      .forEach((entrega) => {
        if (entrega.data_validade) {
          const dataVal = new Date(entrega.data_validade);
          const dias = differenceInDays(dataVal, hoje);
          if (dias < 0) {
            lista.push({
              id: `entrega-vencida-${entrega.id}`,
              tipo: "critico",
              categoria: "Entrega Vencida",
              titulo: `EPI vencido em uso por ${entrega.colaborador_nome}`,
              descricao: `${entrega.epi?.tipo?.nome || "EPI"} entregue venceu há ${Math.abs(dias)} dias. Substituição imediata obrigatória.`,
              item: entrega.epi?.tipo?.nome || "EPI",
              colaborador: entrega.colaborador_nome,
              diasRestantes: dias,
              dataReferencia: entrega.data_validade,
            });
          } else if (dias <= 15) {
            lista.push({
              id: `entrega-vencendo-${entrega.id}`,
              tipo: "urgente",
              categoria: "Entrega Vencendo",
              titulo: `EPI de ${entrega.colaborador_nome} vence em ${dias} dias`,
              descricao: `Agende a substituição do ${entrega.epi?.tipo?.nome || "EPI"}.`,
              item: entrega.epi?.tipo?.nome || "EPI",
              colaborador: entrega.colaborador_nome,
              diasRestantes: dias,
              dataReferencia: entrega.data_validade,
            });
          }
        }

        // 3b. Calcular validade inteligente baseada em validade_meses do tipo
        if (!entrega.data_validade && entrega.epi?.tipo?.validade_meses) {
          const vidaUtil = entrega.epi.tipo.validade_meses;
          const dataEntrega = new Date(entrega.data_entrega);
          const dataVidaUtilFim = addMonths(dataEntrega, vidaUtil);
          const dias = differenceInDays(dataVidaUtilFim, hoje);
          if (dias < 0) {
            lista.push({
              id: `vida-util-vencida-${entrega.id}`,
              tipo: "urgente",
              categoria: "Vida Útil Expirada",
              titulo: `Vida útil do EPI de ${entrega.colaborador_nome} expirou`,
              descricao: `${entrega.epi.tipo.nome} com vida útil de ${vidaUtil} meses expirou há ${Math.abs(dias)} dias. Substituição recomendada.`,
              item: entrega.epi.tipo.nome,
              colaborador: entrega.colaborador_nome,
              diasRestantes: dias,
              dataReferencia: format(dataVidaUtilFim, "yyyy-MM-dd"),
            });
          } else if (dias <= 30) {
            lista.push({
              id: `vida-util-atencao-${entrega.id}`,
              tipo: "atencao",
              categoria: "Vida Útil Atenção",
              titulo: `EPI de ${entrega.colaborador_nome} com vida útil expirando`,
              descricao: `${entrega.epi.tipo.nome} — vida útil expira em ${dias} dias.`,
              item: entrega.epi.tipo.nome,
              colaborador: entrega.colaborador_nome,
              diasRestantes: dias,
              dataReferencia: format(dataVidaUtilFim, "yyyy-MM-dd"),
            });
          }
        }
      });

    // 4a. Troca periódica atrasada (baseado em periodicidade_troca_dias do tipo)
    entregas
      .filter((e) => e.status === "ativa")
      .forEach((entrega) => {
        const periodicidade = (entrega.epi?.tipo as any)?.periodicidade_troca_dias;
        if (periodicidade && periodicidade > 0) {
          const dataEntrega = new Date(entrega.data_entrega);
          const dataTroca = new Date(dataEntrega);
          dataTroca.setDate(dataTroca.getDate() + periodicidade);
          const diasParaTroca = differenceInDays(dataTroca, hoje);

          if (diasParaTroca < 0) {
            lista.push({
              id: `troca-atrasada-${entrega.id}`,
              tipo: "urgente",
              categoria: "Troca Atrasada",
              titulo: `Troca periódica atrasada — ${entrega.colaborador_nome}`,
              descricao: `${entrega.epi?.tipo?.nome}: troca a cada ${periodicidade} dias, atrasada há ${Math.abs(diasParaTroca)} dias.`,
              item: entrega.epi?.tipo?.nome || "EPI",
              colaborador: entrega.colaborador_nome,
              diasRestantes: diasParaTroca,
              dataReferencia: format(dataTroca, "yyyy-MM-dd"),
            });
          } else if (diasParaTroca <= 15) {
            lista.push({
              id: `troca-proxima-${entrega.id}`,
              tipo: "atencao",
              categoria: "Troca Próxima",
              titulo: `Troca periódica em ${diasParaTroca} dias — ${entrega.colaborador_nome}`,
              descricao: `${entrega.epi?.tipo?.nome}: troca a cada ${periodicidade} dias.`,
              item: entrega.epi?.tipo?.nome || "EPI",
              colaborador: entrega.colaborador_nome,
              diasRestantes: diasParaTroca,
              dataReferencia: format(dataTroca, "yyyy-MM-dd"),
            });
          }
        }
      });

    // 5. Estoque baixo
    epis.forEach((epi) => {
      if (epi.quantidade_estoque <= epi.quantidade_minima) {
        lista.push({
          id: `estoque-baixo-${epi.id}`,
          tipo: epi.quantidade_estoque === 0 ? "critico" : "urgente",
          categoria: "Estoque Baixo",
          titulo: `${epi.tipo?.nome || "EPI"} — estoque ${epi.quantidade_estoque === 0 ? "zerado" : "baixo"}`,
          descricao: `${epi.quantidade_estoque} un. em estoque (mínimo: ${epi.quantidade_minima}). Risco de não conseguir atender entregas.`,
          item: epi.tipo?.nome || "EPI",
          diasRestantes: undefined,
        });
      }
    });

    // Sort: crítico > urgente > atenção > info
    const prioridade = { critico: 0, urgente: 1, atencao: 2, info: 3 };
    lista.sort((a, b) => prioridade[a.tipo] - prioridade[b.tipo]);


    return lista;
  }, [epis, entregas, tipos, hoje]);

  
  const criticos = alertas.filter((a) => a.tipo === "critico");
  const urgentes = alertas.filter((a) => a.tipo === "urgente");
  const atencao = alertas.filter((a) => a.tipo === "atencao");

  const getTipoConfig = (tipo: Alerta["tipo"]) => {
    switch (tipo) {
      case "critico":
        return {
          icon: AlertOctagon,
          color: "text-red-600 dark:text-red-400",
          bg: "bg-red-500/10",
          badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
          label: "Crítico",
        };
      case "urgente":
        return {
          icon: ShieldAlert,
          color: "text-orange-600 dark:text-orange-400",
          bg: "bg-orange-500/10",
          badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
          label: "Urgente",
        };
      case "atencao":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600 dark:text-yellow-400",
          bg: "bg-yellow-500/10",
          badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
          label: "Atenção",
        };
      default:
        return {
          icon: Clock,
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-500/10",
          badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
          label: "Info",
        };
    }
  };

  if (alertas.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-70" />
          <h3 className="text-lg font-semibold mb-2">Tudo em conformidade!</h3>
          <p className="text-muted-foreground">
            Nenhum alerta de validade, CA ou estoque encontrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={criticos.length > 0 ? "border-red-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertOctagon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{criticos.length}</p>
                  <p className="text-sm text-muted-foreground">Críticos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className={urgentes.length > 0 ? "border-orange-500/50" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <ShieldAlert className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{urgentes.length}</p>
                  <p className="text-sm text-muted-foreground">Urgentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{atencao.length}</p>
                  <p className="text-sm text-muted-foreground">Atenção</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alerts table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Alertas Jurídicos e Operacionais ({alertas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="todos">
            <TabsList>
              <TabsTrigger value="todos">Todos ({alertas.length})</TabsTrigger>
              {criticos.length > 0 && (
                <TabsTrigger value="criticos">
                  Críticos ({criticos.length})
                </TabsTrigger>
              )}
              {urgentes.length > 0 && (
                <TabsTrigger value="urgentes">
                  Urgentes ({urgentes.length})
                </TabsTrigger>
              )}
              {atencao.length > 0 && (
                <TabsTrigger value="atencao">
                  Atenção ({atencao.length})
                </TabsTrigger>
              )}
            </TabsList>

            {["todos", "criticos", "urgentes", "atencao"].map((tab) => {
              const items =
                tab === "todos"
                  ? alertas
                  : tab === "criticos"
                    ? criticos
                    : tab === "urgentes"
                      ? urgentes
                      : atencao;

              return (
                <TabsContent key={tab} value={tab}>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Nível</TableHead>
                          <TableHead className="w-[140px]">Categoria</TableHead>
                          <TableHead>Alerta</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Colaborador</TableHead>
                          <TableHead className="w-[120px]">Data Ref.</TableHead>
                          <TableHead className="w-[80px]">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((alerta, index) => {
                          const config = getTipoConfig(alerta.tipo);
                          const Icon = config.icon;
                          return (
                            <motion.tr
                              key={alerta.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              className="border-b transition-colors hover:bg-muted/50"
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${config.color}`} />
                                  <Badge className={config.badge}>
                                    {config.label}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {alerta.categoria}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{alerta.titulo}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {alerta.descricao}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {alerta.item}
                              </TableCell>
                              <TableCell className="text-sm">
                                {alerta.colaborador || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {alerta.dataReferencia
                                  ? format(
                                      new Date(alerta.dataReferencia),
                                      "dd/MM/yyyy",
                                      { locale: ptBR }
                                    )
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  title="Criar ação no Plano de Ação"
                                  onClick={() => setAlertaParaAcao(alerta)}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {alertaParaAcao && (
        <AlertaAcaoModal
          open={!!alertaParaAcao}
          onOpenChange={(open) => !open && setAlertaParaAcao(null)}
          alerta={alertaParaAcao}
        />
      )}
    </div>
  );
}
