import { useState } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Bell,
  Settings2,
  AlertTriangle,
  XCircle,
  Clock,
  CheckCircle,
  Sparkles,
  FileText,
  Calendar,
  ChevronRight,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Documento } from "@/hooks/useDocumentos";
import { PDCAAlertaAcaoModal } from "./PDCAAlertaAcaoModal";

interface NotificacaoConfig {
  dias_antecedencia: number;
}

interface AlertaDocumento {
  documento: Documento;
  diasRestantes: number;
  status: "vencido" | "critico" | "alerta";
}

const DEFAULT_DIAS = 30;
const CONFIG_KEY_PREFIX = "doc_notif_config_";

interface Props {
  documentos: Documento[];
}

export function NotificacoesVencimento({ documentos }: Props) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const configKey = tenantId ? `${CONFIG_KEY_PREFIX}${tenantId}` : null;

  // Carregar config salva (localStorage + DB fallback)
  const [diasConfig, setDiasConfig] = useState<number>(() => {
    if (!configKey) return DEFAULT_DIAS;
    const stored = localStorage.getItem(configKey);
    return stored ? parseInt(stored, 10) : DEFAULT_DIAS;
  });
  const [diasInput, setDiasInput] = useState<string>(String(diasConfig));
  const [editingConfig, setEditingConfig] = useState(false);
  const [alertaParaAcao, setAlertaParaAcao] = useState<AlertaDocumento | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Calcular alertas com base na config
  const alertas: AlertaDocumento[] = documentos
    .filter((d) => d.data_validade)
    .map((d) => {
      const dias = differenceInDays(parseISO(d.data_validade!), new Date());
      let status: AlertaDocumento["status"] | null = null;
      if (dias < 0) status = "vencido";
      else if (dias <= 7) status = "critico";
      else if (dias <= diasConfig) status = "alerta";
      return { documento: d, diasRestantes: dias, status };
    })
    .filter((a) => a.status !== null) as AlertaDocumento[];

  alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

  const vencidos = alertas.filter((a) => a.status === "vencido");
  const criticos = alertas.filter((a) => a.status === "critico");
  const atencao = alertas.filter((a) => a.status === "alerta");

  const salvarConfig = () => {
    const val = parseInt(diasInput, 10);
    if (isNaN(val) || val < 1 || val > 365) {
      toast.error("Informe um valor entre 1 e 365 dias.");
      return;
    }
    setDiasConfig(val);
    if (configKey) localStorage.setItem(configKey, String(val));
    setEditingConfig(false);
    toast.success(`Alertas configurados para ${val} dias antes do vencimento.`);
  };

  const abrirCriarAcao = (alerta: AlertaDocumento) => {
    setAlertaParaAcao(alerta);
    setModalOpen(true);
  };

  const getStatusBadge = (alerta: AlertaDocumento) => {
    if (alerta.status === "vencido") {
      return (
        <Badge variant="destructive" className="text-xs shrink-0">
          Vencido há {Math.abs(alerta.diasRestantes)}d
        </Badge>
      );
    }
    if (alerta.status === "critico") {
      return (
        <Badge className="text-xs shrink-0 bg-destructive/20 text-destructive border-destructive/40">
          Crítico — {alerta.diasRestantes}d
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs shrink-0">
        {alerta.diasRestantes}d restantes
      </Badge>
    );
  };

  const getRowClass = (status: AlertaDocumento["status"]) => {
    if (status === "vencido") return "border-l-4 border-l-destructive bg-destructive/5";
    if (status === "critico") return "border-l-4 border-l-destructive/70 bg-destructive/10";
    return "border-l-4 border-l-warning bg-warning/5";
  };

  const alertaParaModal = alertaParaAcao
    ? {
        tipo: "vencimento_documento",
        titulo: `Renovação necessária: ${alertaParaAcao.documento.tipo}`,
        descricao: `O documento "${alertaParaAcao.documento.nome_original}" de ${alertaParaAcao.documento.colaborador_nome} ${
          alertaParaAcao.status === "vencido"
            ? `está vencido há ${Math.abs(alertaParaAcao.diasRestantes)} dias`
            : `vence em ${alertaParaAcao.diasRestantes} dias (${format(parseISO(alertaParaAcao.documento.data_validade!), "dd/MM/yyyy")})`
        }. É necessário tomar providências para renovação.`,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Config Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Configuração de Alertas</p>
                <p className="text-xs text-muted-foreground">
                  Alertando com <strong>{diasConfig} dias</strong> de antecedência ao vencimento
                </p>
              </div>
            </div>
            {editingConfig ? (
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Dias de antecedência:</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={diasInput}
                  onChange={(e) => setDiasInput(e.target.value)}
                  className="w-20 h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && salvarConfig()}
                />
                <Button size="sm" onClick={salvarConfig} className="h-8 gap-1">
                  <Save className="w-3.5 h-3.5" />
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setDiasInput(String(diasConfig));
                    setEditingConfig(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setEditingConfig(true)}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Configurar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-destructive/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-destructive/10">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{vencidos.length}</p>
                <p className="text-xs text-muted-foreground">Documentos vencidos</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-destructive/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{criticos.length}</p>
                <p className="text-xs text-muted-foreground">Críticos (≤ 7 dias)</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-warning/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{atencao.length}</p>
                <p className="text-xs text-muted-foreground">Atenção (até {diasConfig}d)</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alerts List */}
      {alertas.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="p-4 rounded-full bg-success/10 mb-4">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Tudo em dia! 🎉</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Nenhum documento vencido ou com vencimento próximo nos próximos{" "}
            <strong>{diasConfig} dias</strong>.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {/* Vencidos */}
          {vencidos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">Documentos Vencidos ({vencidos.length})</h3>
              </div>
              {vencidos.map((alerta, idx) => (
                <AlertaRow
                  key={alerta.documento.id}
                  alerta={alerta}
                  onCriarAcao={() => abrirCriarAcao(alerta)}
                  delay={idx * 0.05}
                  rowClass={getRowClass(alerta.status)}
                  badge={getStatusBadge(alerta)}
                />
              ))}
            </div>
          )}

          {/* Críticos */}
          {criticos.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">
                  Vencimento Crítico — até 7 dias ({criticos.length})
                </h3>
              </div>
              {criticos.map((alerta, idx) => (
                <AlertaRow
                  key={alerta.documento.id}
                  alerta={alerta}
                  onCriarAcao={() => abrirCriarAcao(alerta)}
                  delay={idx * 0.05}
                  rowClass={getRowClass(alerta.status)}
                  badge={getStatusBadge(alerta)}
                />
              ))}
            </div>
          )}

          {/* Atenção */}
          {atencao.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold text-warning">
                  Vencimento Próximo — até {diasConfig} dias ({atencao.length})
                </h3>
              </div>
              {atencao.map((alerta, idx) => (
                <AlertaRow
                  key={alerta.documento.id}
                  alerta={alerta}
                  onCriarAcao={() => abrirCriarAcao(alerta)}
                  delay={idx * 0.05}
                  rowClass={getRowClass(alerta.status)}
                  badge={getStatusBadge(alerta)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de criação de ação com IA */}
      <PDCAAlertaAcaoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setAlertaParaAcao(null);
        }}
        alerta={alertaParaModal}
      />
    </div>
  );
}

// Sub-componente de linha de alerta
interface AlertaRowProps {
  alerta: AlertaDocumento;
  onCriarAcao: () => void;
  delay: number;
  rowClass: string;
  badge: React.ReactNode;
}

function AlertaRow({ alerta, onCriarAcao, delay, rowClass, badge }: AlertaRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`rounded-lg p-3 flex items-center gap-3 ${rowClass}`}
    >
      <div className="p-2 rounded-lg bg-background/80 shrink-0">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground truncate">{alerta.documento.nome_original}</p>
          <Badge variant="secondary" className="text-xs shrink-0">
            {alerta.documento.tipo}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {alerta.documento.colaborador_nome}
          </p>
          {alerta.documento.data_validade && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Calendar className="w-3 h-3" />
              {format(parseISO(alerta.documento.data_validade), "dd/MM/yyyy")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
          onClick={onCriarAcao}
        >
          <Sparkles className="w-3 h-3" />
          Criar Ação
        </Button>
      </div>
    </motion.div>
  );
}
