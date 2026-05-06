import { useState, useEffect, useRef } from "react";
import { Sparkles, Target, CheckCircle2, Loader2, Edit2, Plus, ArrowRight, Calendar, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { usePdi } from "@/hooks/usePdi";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GradientDialogHeader } from "@/components/pdi/GradientDialogHeader";
import { PDI_META_CATEGORIA_LABELS } from "@/types/pdi";
import type { PdiMetaCategoria } from "@/types/pdi";
import type { AvaliacaoResposta } from "@/types/avaliacao";

interface MetaSugerida {
  titulo: string;
  descricao: string;
  categoria: PdiMetaCategoria;
  especifica: string;
  mensuravel: string;
  atingivel: string;
  relevante: string;
  temporal: string;
  indicador_sucesso: string;
  peso: number;
  data_fim_sugerida: string;
}

interface GerarPdiModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resposta: AvaliacaoResposta;
  notas: Record<string, number>;
  dimensoes: Array<{ id: string; nome: string; criterios: Array<{ id: string; nome: string }> }>;
  colaboradorCargo?: string;
  colaboradorDepartamento?: string;
  onPdiGerado?: (pdiId: string) => void;
}

export function GerarPdiModal({
  open,
  onOpenChange,
  resposta,
  notas,
  dimensoes,
  colaboradorCargo,
  colaboradorDepartamento,
  onPdiGerado,
}: GerarPdiModalProps) {
  const { pdis, createPdi, createMeta } = usePdi();

  const [step, setStep] = useState<"loading" | "review" | "done">("loading");
  const [metas, setMetas] = useState<MetaSugerida[]>([]);
  const [tituloPdi, setTituloPdi] = useState("");
  const [descricaoPdi, setDescricaoPdi] = useState("");
  const [metasSelecionadas, setMetasSelecionadas] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const hasLoadedRef = useRef(false);

  // Dispara loadSuggestions quando o modal abre pela primeira vez
  useEffect(() => {
    if (open && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSuggestions();
    }
    if (!open) {
      hasLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadSuggestions = async () => {
    setStep("loading");
    setMetas([]);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-pdi-from-avaliacao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          colaboradorNome: resposta.avaliado_nome,
          colaboradorCargo,
          colaboradorDepartamento,
          cicloNome: (resposta as any).ciclo?.nome,
          notaGeral: resposta.nota_geral,
          pontosFortes: resposta.pontos_fortes,
          areasDesenvolvimento: resposta.areas_desenvolvimento,
          resumo: resposta.comentario_geral,
          notas,
          dimensoes,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMetas(data.metas || []);
      setTituloPdi(data.titulo_pdi || `PDI — Desenvolvimento de ${resposta.avaliado_nome}`);
      setDescricaoPdi(data.descricao_pdi || "");
      setMetasSelecionadas(new Set(data.metas?.map((_: unknown, i: number) => i) || []));
      setStep("review");
    } catch (e: any) {
      console.error("Erro PDI IA:", e);
      const msg = e?.name === "AbortError"
        ? "Tempo limite excedido. Tente novamente."
        : (e.message || "Tente novamente");
      toast.error("Erro ao gerar sugestões: " + msg);
      onOpenChange(false);
    }
  };

  const toggleMeta = (idx: number) => {
    setMetasSelecionadas(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleSave = async () => {
    const selectedMetas = metas.filter((_, i) => metasSelecionadas.has(i));
    if (selectedMetas.length === 0) {
      toast.error("Selecione ao menos uma meta");
      return;
    }
    setIsSaving(true);
    try {
      const existing = pdis.find(
        p => p.colaborador_id === resposta.avaliado_id && ["ativo", "rascunho"].includes(p.status)
      );

      let pdiId: string;
      if (existing) {
        pdiId = existing.id;
        toast.info(`Metas adicionadas ao PDI existente: "${existing.titulo}"`);
      } else {
        const hoje = new Date();
        const dataFim = new Date(hoje);
        dataFim.setMonth(dataFim.getMonth() + 6);

        const created = await createPdi({
          colaborador_id: resposta.avaliado_id,
          colaborador_nome: resposta.avaliado_nome,
          colaborador_cargo: colaboradorCargo,
          colaborador_departamento: colaboradorDepartamento,
          titulo: tituloPdi,
          descricao: descricaoPdi,
          periodo: "semestral",
          data_inicio: hoje.toISOString().split("T")[0],
          data_fim: dataFim.toISOString().split("T")[0],
          gatilho: `avaliacao:${(resposta as any).ciclo?.nome || "ciclo"}`,
          observacoes: `Gerado automaticamente após avaliação de desempenho (${(resposta as any).ciclo?.nome || ""}). IA assistida.`,
        }) as any;
        pdiId = created.id;
      }

      for (const meta of selectedMetas) {
        await createMeta({
          pdi_id: pdiId,
          titulo: meta.titulo,
          descricao: meta.descricao,
          categoria: meta.categoria,
          especifica: meta.especifica,
          mensuravel: meta.mensuravel,
          atingivel: meta.atingivel,
          relevante: meta.relevante,
          temporal: meta.temporal,
          indicador_sucesso: meta.indicador_sucesso,
          peso: meta.peso || 1,
          data_inicio: new Date().toISOString().split("T")[0],
          data_fim: meta.data_fim_sugerida || undefined,
          observacoes: "Meta gerada por IA após avaliação de desempenho. Revise e ajuste conforme necessário.",
        });
      }

      toast.success(`PDI ${existing ? "atualizado" : "criado"} com ${selectedMetas.length} meta(s)!`);
      setStep("done");
      onPdiGerado?.(pdiId);
    } catch (e: any) {
      toast.error("Erro ao salvar PDI: " + (e.message || ""));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar PDI com Inteligência Artificial
          </DialogTitle>
          <DialogDescription>
            Com base na avaliação de <strong>{resposta.avaliado_nome}</strong>, a IA sugere metas SMART para o PDI.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {/* LOADING */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Analisando avaliação...</p>
                <p className="text-sm text-muted-foreground">A IA está gerando metas SMART personalizadas</p>
              </div>
            </div>
          )}

          {/* REVIEW */}
          {step === "review" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  <Target className="h-4 w-4" />
                  Dados do PDI
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Título do PDI</Label>
                    <Input value={tituloPdi} onChange={e => setTituloPdi(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição / Foco</Label>
                    <Textarea value={descricaoPdi} onChange={e => setDescricaoPdi(e.target.value)} rows={2} className="mt-1 resize-none" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    <Edit2 className="h-4 w-4" />
                    Metas Sugeridas ({metas.length})
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {metasSelecionadas.size} selecionada(s)
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Selecione as metas que deseja incluir. Você poderá editar os detalhes no PDI.</p>

                <div className="space-y-3">
                  {metas.map((meta, idx) => {
                    const selecionada = metasSelecionadas.has(idx);
                    return (
                      <Card
                        key={idx}
                        className={`cursor-pointer transition-all ${
                          selecionada ? "border-primary/50 bg-primary/5 shadow-sm" : "opacity-60 hover:opacity-80"
                        }`}
                        onClick={() => toggleMeta(idx)}
                      >
                        <CardContent className="p-4 space-y-2.5">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              selecionada ? "border-primary bg-primary" : "border-muted-foreground"
                            }`}>
                              {selecionada && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm leading-tight">{meta.titulo}</p>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {PDI_META_CATEGORIA_LABELS[meta.categoria] || meta.categoria}
                                </Badge>
                              </div>
                              {meta.descricao && (
                                <p className="text-xs text-muted-foreground">{meta.descricao}</p>
                              )}
                              <div className="grid grid-cols-1 gap-1 mt-2">
                                {[
                                  { key: "S", label: "Específica", value: meta.especifica },
                                  { key: "M", label: "Mensurável", value: meta.mensuravel },
                                  { key: "T", label: "Temporal", value: meta.temporal },
                                ].filter(i => i.value).map(item => (
                                  <div key={item.key} className="flex gap-2 text-xs">
                                    <span className="font-bold text-primary w-4 shrink-0">{item.key}</span>
                                    <span className="text-muted-foreground">{item.value}</span>
                                  </div>
                                ))}
                              </div>
                              {meta.data_fim_sugerida && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  Prazo sugerido: {new Date(meta.data_fim_sugerida + "T12:00:00").toLocaleDateString("pt-BR")}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div>
                <p className="font-semibold text-lg">PDI gerado com sucesso!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As metas foram adicionadas ao PDI do colaborador.
                  <br />Acesse o módulo PDI para acompanhar o desenvolvimento.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        {step === "review" && (
          <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-2">
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadSuggestions} disabled={isSaving} className="gap-2 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> Regenerar
              </Button>
              <Button onClick={handleSave} disabled={isSaving || metasSelecionadas.size === 0} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isSaving ? "Salvando..." : `Criar PDI com ${metasSelecionadas.size} meta(s)`}
                {!isSaving && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="px-6 py-4 border-t flex justify-end">
            <Button onClick={() => onOpenChange(false)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
