import { motion } from "framer-motion";
import {
  Loader2, User, Clock, CheckCircle2, XCircle, PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useOnboardingProcessos } from "@/hooks/useOnboarding";
import { PROCESSO_STATUS_LABELS, type OnboardingProcesso } from "@/types/onboarding";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Info } from "lucide-react";

const DEMO_PROCESSOS: OnboardingProcesso[] = [
  { id: "d1", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Ana Clara Souza", colaborador_cpf: "000.000.000-01", status: "concluido", data_inicio: "2026-01-10", data_conclusao: "2026-01-25", progresso: 100, pontos_obtidos: 450, certificado_emitido: true, pdi_alimentado: true, created_at: "2026-01-10T10:00:00Z", updated_at: "2026-01-25T10:00:00Z" },
  { id: "d2", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Carlos Eduardo Lima", colaborador_cpf: "000.000.000-02", status: "em_andamento", data_inicio: "2026-02-01", data_conclusao: null, progresso: 65, pontos_obtidos: 280, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-02-15T10:00:00Z" },
  { id: "d3", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Mariana Ferreira Costa", colaborador_cpf: "000.000.000-03", status: "em_andamento", data_inicio: "2026-02-05", data_conclusao: null, progresso: 40, pontos_obtidos: 160, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-05T10:00:00Z", updated_at: "2026-02-16T10:00:00Z" },
  { id: "d4", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "João Pedro Alves", colaborador_cpf: "000.000.000-04", status: "pendente", data_inicio: null, data_conclusao: null, progresso: 0, pontos_obtidos: 0, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-14T10:00:00Z", updated_at: "2026-02-14T10:00:00Z" },
  { id: "d5", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Beatriz Santos Oliveira", colaborador_cpf: "000.000.000-05", status: "concluido", data_inicio: "2026-01-15", data_conclusao: "2026-02-02", progresso: 100, pontos_obtidos: 420, certificado_emitido: true, pdi_alimentado: true, created_at: "2026-01-15T10:00:00Z", updated_at: "2026-02-02T10:00:00Z" },
  { id: "d6", tenant_id: "", admissao_id: "", template_id: null, trilha_id: null, colaborador_nome: "Rafael Mendes", colaborador_cpf: "000.000.000-06", status: "pendente", data_inicio: null, data_conclusao: null, progresso: 0, pontos_obtidos: 0, certificado_emitido: false, pdi_alimentado: false, created_at: "2026-02-17T10:00:00Z", updated_at: "2026-02-17T10:00:00Z" },
];

const statusConfig: Record<string, { icon: React.ElementType; color: string }> = {
  pendente: { icon: Clock, color: "bg-muted text-muted-foreground" },
  em_andamento: { icon: PlayCircle, color: "bg-info/10 text-info" },
  concluido: { icon: CheckCircle2, color: "bg-success/10 text-success" },
  cancelado: { icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

export function OnboardingProcessosList() {
  const { processos: realProcessos, isLoading } = useOnboardingProcessos();

  const isDemo = realProcessos.length === 0;
  const processos = isDemo ? DEMO_PROCESSOS : realProcessos;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Stats
  const stats = {
    total: processos.length,
    pendentes: processos.filter((p) => p.status === "pendente").length,
    emAndamento: processos.filter((p) => p.status === "em_andamento").length,
    concluidos: processos.filter((p) => p.status === "concluido").length,
  };

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-lg px-4 py-2.5 text-sm text-warning">
          <Info className="w-4 h-4 shrink-0" />
          <span>Modo demonstração — dados fictícios para visualização. Admita colaboradores para ver dados reais.</span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Clock className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <PlayCircle className="w-5 h-5 text-info" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.concluidos}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-3">
        {processos.map((p, i) => {
          const cfg = statusConfig[p.status] || statusConfig.pendente;
          const StatusIcon = cfg.icon;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="border-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${cfg.color}`}>
                    <StatusIcon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm">{p.colaborador_nome}</h4>
                    <p className="text-xs text-muted-foreground">
                      Iniciado em {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{p.progresso}%</span>
                      <span className="text-muted-foreground">{p.pontos_obtidos}pts</span>
                    </div>
                    <Progress value={p.progresso} className="h-1.5" />
                  </div>
                  <Badge className={`text-[10px] ${cfg.color}`}>
                    {PROCESSO_STATUS_LABELS[p.status]}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
