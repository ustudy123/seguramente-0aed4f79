import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Wand2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface GerarFuncaoIAModalProps {
  open: boolean;
  onClose: () => void;
  cargoId: string;
  cargoNome: string;
  onSuccess?: () => void;
}

export function GerarFuncaoIAModal({ open, onClose, cargoId, cargoNome, onSuccess }: GerarFuncaoIAModalProps) {
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const qc = useQueryClient();

  const handleGerar = async () => {
    const texto = descricao.trim() || cargoNome;
    if (texto.length < 3) {
      toast.error("Descreva a função com pelo menos 3 caracteres.");
      return;
    }

    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-gerar-funcao-completa", {
        body: { descricao_livre: texto, cargo_id: cargoId },
      });

      if (error) {
        // Try to extract JSON error message from FunctionsHttpError
        let msg = error.message || "Erro ao gerar função com IA";
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      setResultado(data.resultado);

      // Invalidate all related queries
      qc.invalidateQueries({ queryKey: ["cargos"] });
      qc.invalidateQueries({ queryKey: ["funcao_atividades", cargoId] });
      qc.invalidateQueries({ queryKey: ["funcao_competencias", cargoId] });
      qc.invalidateQueries({ queryKey: ["funcao_indicadores", cargoId] });
      qc.invalidateQueries({ queryKey: ["funcao_responsabilidades"] });

      toast.success("Função gerada com sucesso pela IA! Atividades, competências e indicadores foram criados.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar função com IA");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDescricao("");
    setResultado(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Gerar Função Completa com IA
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">


        {!resultado ? (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Descreva a função em linguagem natural. A IA irá gerar automaticamente:
                atividades, competências, indicadores (KPIs), responsabilidades, requisitos de formação e experiência, escopo e muito mais.

              </p>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Quanto mais detalhes você fornecer, melhor será o resultado. 
                O contexto da sua empresa será usado automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descreva a função</Label>
              <Textarea
                placeholder={`Ex: "${cargoNome} responsável por gestão financeira, contas a pagar e receber, conciliação bancária e relatórios gerenciais no setor industrial"`}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[200px] resize-y"
                maxLength={30000}
                disabled={loading}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Deixe vazio para usar apenas o nome do cargo: "{cargoNome}"</span>
                <span className={descricao.length > 27000 ? "text-destructive font-medium" : ""}>{descricao.length.toLocaleString("pt-BR")}/30.000</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleGerar} disabled={loading} className="gap-2">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading ? "Gerando função completa..." : "Gerar com IA"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Função gerada e salva com sucesso!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resultado.atividades?.length || 0} atividades, {resultado.competencias?.length || 0} competências
                  e {resultado.indicadores?.length || 0} indicadores foram criados automaticamente.
                </p>
              </div>
            </div>

            {resultado.objetivo_funcao && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium text-foreground mb-1">🎯 Objetivo</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resultado.objetivo_funcao}</p>
              </div>
            )}

            {resultado.escopo_geral && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium text-foreground mb-1">📋 Escopo</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resultado.escopo_geral}</p>
              </div>
            )}

            {resultado.atividades?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium text-foreground mb-3">📌 Atividades ({resultado.atividades.length})</p>
                <div className="space-y-2">
                  {resultado.atividades.map((a: any, i: number) => (
                    <div key={i} className="rounded-md border bg-background p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground">{i + 1}. {a.nome}</p>
                        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                          {a.frequencia && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{a.frequencia}</span>}
                          {a.complexidade && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">{a.complexidade}</span>}
                          {a.classificacao && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">{a.classificacao}</span>}
                        </div>
                      </div>
                      {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.competencias?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium text-foreground mb-3">🧠 Competências ({resultado.competencias.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resultado.competencias.map((c: any, i: number) => (
                    <div key={i} className="rounded-md border bg-background p-2">
                      <p className="text-sm text-foreground">{c.nome || c.competencia || c.titulo}</p>
                      {c.tipo && <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{c.tipo}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.indicadores?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium text-foreground mb-3">📊 Indicadores ({resultado.indicadores.length})</p>
                <ul className="space-y-1.5">
                  {resultado.indicadores.map((ind: any, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      • <span className="text-foreground">{ind.nome || ind.indicador || ind.titulo}</span>
                      {ind.meta && <span className="text-xs opacity-70"> — meta: {ind.meta}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.responsabilidades?.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <p className="font-medium text-foreground mb-3">✅ Responsabilidades ({resultado.responsabilidades.length})</p>
                <ul className="space-y-1 list-disc ml-5">
                  {resultado.responsabilidades.map((r: any, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">{typeof r === "string" ? r : (r.descricao || r.nome)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end sticky bottom-0 bg-background pt-2 -mx-6 px-6 border-t">
              <Button onClick={handleClose}>Fechar e ver detalhes</Button>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
