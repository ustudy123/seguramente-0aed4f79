import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";
import type { AvaliacaoCiclo, AvaliacaoRespostaInsert } from "@/types/avaliacao";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Users, Play, AlertCircle, UserCheck, CheckCircle2 } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GradientDialogHeader } from "@/components/pdi/GradientDialogHeader";

interface IniciarCicloDialogProps {
  ciclo: AvaliacaoCiclo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function IniciarCicloDialog({ ciclo, open, onOpenChange, onSuccess }: IniciarCicloDialogProps) {
  const { tenantId, user, profile } = useAuth();
  const { colaboradores, isLoading: isLoadingColab } = useColaboradores();
  const queryClient = useQueryClient();

  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"review" | "generating" | "done">("review");
  const [gerados, setGerados] = useState(0);

  // Detectar recém-admitidos (menos de 30 dias)
  const isRecentAdmissao = (dataAdmissao: string | null) => {
    if (!dataAdmissao) return false;
    const diff = Date.now() - new Date(dataAdmissao).getTime();
    return diff < 30 * 24 * 60 * 60 * 1000;
  };

  const elegíveis = colaboradores.filter(c => !excluidos.has(c.id));
  const recentAdmissoes = colaboradores.filter(c => isRecentAdmissao(c.data_admissao));

  const toggleExcluido = (id: string) => {
    setExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const iniciarMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      setStep("generating");

      // 1. Criar respostas para cada colaborador elegível
      const respostas: AvaliacaoRespostaInsert[] = [];

      for (const colab of elegíveis) {
        // Autoavaliação (se config_360.auto)
        if (ciclo.config_360?.auto) {
          respostas.push({
            ciclo_id: ciclo.id,
            avaliado_id: colab.id,
            avaliado_nome: colab.nome_completo,
            avaliador_id: colab.id,
            avaliador_nome: colab.nome_completo,
            tipo_avaliador: "auto",
            status: "pendente",
          });
        }

        // Avaliação pelo gestor (gestor_imediato do colaborador)
        if (ciclo.config_360?.gestor) {
          // Buscar gestor imediato da admissão
          const { data: admissao } = await supabase
            .from("admissoes")
            .select("gestor_imediato")
            .eq("id", colab.id)
            .maybeSingle();

          respostas.push({
            ciclo_id: ciclo.id,
            avaliado_id: colab.id,
            avaliado_nome: colab.nome_completo,
            avaliador_id: admissao?.gestor_imediato || user?.id || colab.id,
            avaliador_nome: admissao?.gestor_imediato ? undefined : profile?.nome_completo,
            tipo_avaliador: "gestor",
            status: "pendente",
          });
        }

        // Cliente interno (avaliador será definido posteriormente pelo RH)
        if (ciclo.config_360?.cliente_interno) {
          respostas.push({
            ciclo_id: ciclo.id,
            avaliado_id: colab.id,
            avaliado_nome: colab.nome_completo,
            avaliador_id: null,
            avaliador_nome: "A definir (Cliente Interno)",
            tipo_avaliador: "cliente_interno",
            status: "pendente",
          });
        }
      }

      // Inserir respostas em lote (batch de 50)
      let count = 0;
      const batchSize = 50;
      for (let i = 0; i < respostas.length; i += batchSize) {
        const batch = respostas.slice(i, i + batchSize).map(r => ({
          ciclo_id: r.ciclo_id,
          avaliado_id: r.avaliado_id,
          avaliado_nome: r.avaliado_nome,
          avaliador_id: r.avaliador_id,
          avaliador_nome: r.avaliador_nome || null,
          tipo_avaliador: r.tipo_avaliador as "auto" | "gestor" | "par" | "subordinado",
          status: r.status || "pendente",
          notas_criterios: {} as unknown as Json,
          tenant_id: tenantId,
        }));
        const { error } = await supabase.from("avaliacao_respostas").insert(batch);
        if (error) throw error;
        count += batch.length;
        setGerados(count);
      }

      // 2. Atualizar status do ciclo para "ativo"
      const { error: cicloError } = await supabase
        .from("avaliacao_ciclos")
        .update({ status: "ativo", notificacoes_enviadas: true })
        .eq("id", ciclo.id);

      if (cicloError) throw cicloError;

      setStep("done");
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-ciclos"] });
      queryClient.invalidateQueries({ queryKey: ["avaliacao-respostas"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-avaliacoes"] });
      toast.success(`Ciclo iniciado! ${count} avaliações geradas automaticamente.`);
    },
    onError: (error) => {
      setStep("review");
      toast.error(`Erro ao iniciar ciclo: ${error.message}`);
    },
  });

  const handleClose = () => {
    if (step === "done") {
      onSuccess();
    }
    onOpenChange(false);
    setStep("review");
    setExcluidos(new Set());
    setGerados(0);
  };

  const totalAvaliacoes = elegíveis.length * ((ciclo.config_360?.auto ? 1 : 0) + (ciclo.config_360?.gestor ? 1 : 0));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Iniciar Ciclo: {ciclo.nome}</DialogTitle>
          <DialogDescription>O sistema gerará automaticamente as avaliações para todos os colaboradores elegíveis.</DialogDescription>
        </VisuallyHidden>
        <div className="px-6 pt-6">
          <GradientDialogHeader
            icon={Play}
            title={`Iniciar Ciclo: ${ciclo.nome}`}
            description="O sistema gerará automaticamente as avaliações dos colaboradores elegíveis e enviará as notificações."
            gradient="from-emerald-500 via-teal-500 to-cyan-600"
            glow="shadow-emerald-500/40"
            step={{
              current: step === "review" ? 0 : step === "processing" ? 1 : 2,
              total: 3,
              labels: ["Revisar", "Gerando", "Concluído"],
            }}
          />
        </div>

        {step === "review" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{colaboradores.length}</p>
                  <p className="text-xs text-muted-foreground">Colaboradores</p>
                </div>
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-success">{elegíveis.length}</p>
                  <p className="text-xs text-muted-foreground">Elegíveis</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalAvaliacoes}</p>
                  <p className="text-xs text-muted-foreground">Avaliações a gerar</p>
                </div>
              </div>

              {/* Aviso recém-admitidos */}
              {recentAdmissoes.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">
                      {recentAdmissoes.length} colaborador(es) admitido(s) há menos de 30 dias.
                    </span>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Considere excluí-los desta rodada ou usar um template de avaliação light para integração.
                    </p>
                  </div>
                </div>
              )}

              {/* Tipos de avaliação que serão criadas */}
              <div className="flex flex-wrap gap-2 text-xs">
                {ciclo.config_360?.auto && <Badge variant="secondary">✓ Autoavaliação</Badge>}
                {ciclo.config_360?.gestor && <Badge variant="secondary">✓ Avaliação pelo Gestor</Badge>}
                {(ciclo.config_360?.pares || 0) > 0 && <Badge variant="secondary">✓ Avaliação de Pares</Badge>}
                {ciclo.config_360?.subordinados && <Badge variant="secondary">✓ Avaliação de Subordinados</Badge>}
                {ciclo.config_360?.cliente_interno && <Badge variant="secondary">✓ Cliente Interno</Badge>}
              </div>

              {/* Lista de colaboradores */}
              <div className="flex-1 min-h-0">
                <p className="text-sm font-medium mb-2">Desmarque para excluir do ciclo:</p>
                <ScrollArea className="h-48 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {isLoadingColab ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Carregando colaboradores...</div>
                    ) : colaboradores.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum colaborador cadastrado para esta empresa.
                      </div>
                    ) : (
                      colaboradores.map(c => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors ${excluidos.has(c.id) ? "opacity-40" : ""}`}
                        >
                          <Checkbox
                            id={`colab-${c.id}`}
                            checked={!excluidos.has(c.id)}
                            onCheckedChange={() => toggleExcluido(c.id)}
                          />
                          <Label htmlFor={`colab-${c.id}`} className="flex-1 cursor-pointer">
                            <span className="font-medium text-sm">{c.nome_completo}</span>
                            <span className="text-xs text-muted-foreground ml-2">{c.cargo}</span>
                            {c.departamento && <span className="text-xs text-muted-foreground ml-1">• {c.departamento}</span>}
                          </Label>
                          {isRecentAdmissao(c.data_admissao) && (
                            <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">Novo</Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 px-6 py-4 border-t shrink-0">
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">Cancelar</Button>
              <Button
                onClick={() => iniciarMutation.mutate()}
                disabled={elegíveis.length === 0 || iniciarMutation.isPending}
                className="gap-2 w-full sm:w-auto"
              >
                <Play className="h-4 w-4" />
                Iniciar e Gerar {totalAvaliacoes} Avaliações
              </Button>
            </div>
          </>
        )}


        {step === "generating" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="p-4 bg-primary/10 rounded-full">
              <Users className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <div className="text-center space-y-2 w-full max-w-sm">
              <h3 className="font-semibold">Gerando avaliações...</h3>
              <p className="text-sm text-muted-foreground">
                {gerados} de {totalAvaliacoes} criadas
              </p>
              <Progress value={(gerados / Math.max(totalAvaliacoes, 1)) * 100} className="h-2" />
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="p-4 bg-success/10 rounded-full">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-lg">Ciclo iniciado com sucesso!</h3>
              <p className="text-sm text-muted-foreground">
                <strong>{gerados}</strong> avaliações foram geradas e distribuídas.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Os avaliadores já podem acessar suas avaliações na aba "Minha Caixa".
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>Ver Ciclos</Button>
              <Button onClick={handleClose} className="gap-2">
                <UserCheck className="h-4 w-4" />
                Ir para Minha Caixa
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
