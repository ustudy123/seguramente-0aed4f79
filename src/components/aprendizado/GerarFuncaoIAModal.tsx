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
                className="min-h-[120px] resize-y"
                maxLength={5000}
                disabled={loading}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Deixe vazio para usar apenas o nome do cargo: "{cargoNome}"</span>
                <span className={descricao.length > 4500 ? "text-destructive font-medium" : ""}>{descricao.length}/5.000</span>
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
          <div className="space-y-4">
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

            <div className="space-y-3 text-sm">
              {resultado.objetivo_funcao && (
                <div>
                  <p className="font-medium text-foreground">🎯 Objetivo</p>
                  <p className="text-muted-foreground">{resultado.objetivo_funcao}</p>
                </div>
              )}
              {resultado.escopo_geral && (
                <div>
                  <p className="font-medium text-foreground">📋 Escopo</p>
                  <p className="text-muted-foreground">{resultado.escopo_geral}</p>
                </div>
              )}
              {resultado.atividades?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground">📌 Atividades ({resultado.atividades.length})</p>
                  <ul className="list-disc ml-5 text-muted-foreground space-y-0.5">
                    {resultado.atividades.slice(0, 5).map((a: any, i: number) => (
                      <li key={i}>{a.nome} <span className="text-xs opacity-70">({a.frequencia})</span></li>
                    ))}
                    {resultado.atividades.length > 5 && (
                      <li className="text-xs opacity-60">+ {resultado.atividades.length - 5} mais...</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar e ver detalhes</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
