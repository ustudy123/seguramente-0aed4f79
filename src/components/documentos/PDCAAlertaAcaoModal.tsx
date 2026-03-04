import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PDCAAlerta {
  tipo: string;
  titulo: string;
  descricao: string;
  severidade: "destructive" | "warning" | "info";
}

interface W5H2 {
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  howMuch: string;
}

interface Sugestao {
  titulo: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  w5h2?: W5H2;
}

interface Props {
  open: boolean;
  onClose: () => void;
  alerta: PDCAAlerta | null;
}

const PRIORIDADE_MAP: Record<string, string> = {
  baixa: "baixo",
  media: "medio",
  alta: "urgente",
  urgente: "imediato",
};

export function PDCAAlertaAcaoModal({ open, onClose, alerta }: Props) {
  const { tenantId, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [sugestaoExpandida, setSugestaoExpandida] = useState<number | null>(null);
  const [editando, setEditando] = useState<Partial<Sugestao & { prazo: string; responsavel: string }>>({});
  const [gerado, setGerado] = useState(false);

  const gerarSugestoes = async () => {
    if (!alerta) return;
    setLoading(true);
    setSugestoes([]);
    setGerado(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "sugerir",
          contexto: `${alerta.titulo}: ${alerta.descricao}`,
          dados: { origem: "pdca_documentos", risco: alerta.titulo },
        },
      });
      if (error) throw error;
      if (data?.sugestoes?.length) {
        setSugestoes(data.sugestoes);
        setGerado(true);
      } else {
        toast.error("IA não retornou sugestões. Tente novamente.");
      }
    } catch (e: any) {
      if (e?.message?.includes("429")) {
        toast.error("Limite de IA atingido. Tente em instantes.");
      } else {
        toast.error("Erro ao gerar sugestões de IA.");
      }
    } finally {
      setLoading(false);
    }
  };

  const expandirSugestao = async (idx: number) => {
    if (sugestaoExpandida === idx) {
      setSugestaoExpandida(null);
      return;
    }
    setSugestaoExpandida(idx);
    const s = sugestoes[idx];
    if (!s.w5h2) {
      // gerar 5W2H para essa sugestão específica
      try {
        const { data } = await supabase.functions.invoke("ai-plano-acao", {
          body: {
            tipo: "gerar_5w2h",
            contexto: s.descricao,
            dados: { titulo: s.titulo, origem: "pdca_documentos", descricao: s.descricao },
          },
        });
        if (data?.w5h2) {
          const updated = [...sugestoes];
          updated[idx] = { ...updated[idx], w5h2: data.w5h2 };
          setSugestoes(updated);
        }
      } catch {}
    }
    setEditando({
      titulo: s.titulo,
      descricao: s.descricao,
      prioridade: s.prioridade,
      prazo: "",
      responsavel: "",
    });
  };

  const criarAcao = async (idx: number) => {
    if (!tenantId) return;
    const s = sugestoes[idx];
    setSaving(idx);
    try {
      const prioridadeDB = PRIORIDADE_MAP[editando.prioridade || s.prioridade] || "medio";
      const titulo = editando.titulo || s.titulo;
      const w5h2 = s.w5h2;

      const { error } = await supabase.from("plano_acoes").insert({
        tenant_id: tenantId,
        titulo,
        descricao: editando.descricao || s.descricao,
        tipo: s.tipo === "corretiva" ? "corretiva" : s.tipo === "preventiva" ? "preventiva" : "melhoria",
        origem_modulo: "documentos",
        status: "pendente" as any,
        prioridade: prioridadeDB as any,
        prazo: editando.prazo || null,
        responsavel_nome: editando.responsavel || null,
        criado_por: user?.id || null,
        criado_por_nome: user?.email || null,
        // 5W2H fields
        o_que: w5h2?.what || titulo,
        por_que: w5h2?.why || s.descricao,
        onde: w5h2?.where || null,
        quando: editando.prazo || w5h2?.when || null,
        quem: editando.responsavel || w5h2?.who || null,
        como: w5h2?.how || null,
        quanto: w5h2?.howMuch || null,
      });

      if (error) throw error;

      toast.success("Ação criada no Plano de Ação!", {
        description: `"${titulo}" adicionada com sucesso.`,
      });

      // mark as saved
      const updated = [...sugestoes];
      updated[idx] = { ...updated[idx], tipo: "__salvo__" };
      setSugestoes(updated);
      setSugestaoExpandida(null);
    } catch (e: any) {
      toast.error("Erro ao criar ação: " + (e?.message || "Erro desconhecido"));
    } finally {
      setSaving(null);
    }
  };

  const handleClose = () => {
    setSugestoes([]);
    setGerado(false);
    setSugestaoExpandida(null);
    setEditando({});
    onClose();
  };

  if (!alerta) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Sugestões de Ação para Alerta PDCA
          </DialogTitle>
        </DialogHeader>

        {/* Alerta original */}
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">{alerta.titulo}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{alerta.descricao}</p>
          </div>
        </div>

        {!gerado && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-muted-foreground text-center">
              Utilize a IA para gerar sugestões de ações 5W2H baseadas neste alerta.
            </p>
            <Button onClick={gerarSugestoes} disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando sugestões...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Gerar Sugestões com IA</>
              )}
            </Button>
          </div>
        )}

        {gerado && sugestoes.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {sugestoes.length} sugestões geradas — clique para expandir e criar
            </p>
            {sugestoes.map((s, idx) => {
              const salvo = s.tipo === "__salvo__";
              const expandido = sugestaoExpandida === idx;
              return (
                <div key={idx} className="border border-border rounded-lg overflow-hidden">
                  <button
                    className="w-full p-3 text-left flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors"
                    onClick={() => !salvo && expandirSugestao(idx)}
                    disabled={salvo}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">{s.titulo}</span>
                        <Badge variant={salvo ? "secondary" : s.prioridade === "urgente" || s.prioridade === "alta" ? "destructive" : "outline"} className="text-xs shrink-0">
                          {salvo ? "✓ Criada" : s.prioridade}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.descricao}</p>
                    </div>
                    {salvo ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </button>

                  {expandido && !salvo && (
                    <div className="p-4 border-t border-border bg-muted/20 space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <Label className="text-xs">Título da Ação</Label>
                          <Input
                            value={editando.titulo ?? s.titulo}
                            onChange={(e) => setEditando(p => ({ ...p, titulo: e.target.value }))}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Descrição</Label>
                          <Textarea
                            value={editando.descricao ?? s.descricao}
                            onChange={(e) => setEditando(p => ({ ...p, descricao: e.target.value }))}
                            className="mt-1 text-sm min-h-[60px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Prioridade</Label>
                            <Select
                              value={editando.prioridade ?? s.prioridade}
                              onValueChange={(v) => setEditando(p => ({ ...p, prioridade: v }))}
                            >
                              <SelectTrigger className="mt-1 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="baixa">Baixa</SelectItem>
                                <SelectItem value="media">Média</SelectItem>
                                <SelectItem value="alta">Alta</SelectItem>
                                <SelectItem value="urgente">Urgente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Prazo</Label>
                            <Input
                              type="date"
                              value={editando.prazo ?? ""}
                              onChange={(e) => setEditando(p => ({ ...p, prazo: e.target.value }))}
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Responsável</Label>
                          <Input
                            placeholder="Nome do responsável"
                            value={editando.responsavel ?? ""}
                            onChange={(e) => setEditando(p => ({ ...p, responsavel: e.target.value }))}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      </div>

                      {s.w5h2 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">5W2H gerado pela IA</p>
                            <div className="grid grid-cols-1 gap-1.5 text-xs">
                              {[
                                ["O quê", s.w5h2.what],
                                ["Por quê", s.w5h2.why],
                                ["Onde", s.w5h2.where],
                                ["Quando", s.w5h2.when],
                                ["Quem", s.w5h2.who],
                                ["Como", s.w5h2.how],
                                ["Quanto", s.w5h2.howMuch],
                              ].map(([label, val]) => val && (
                                <div key={label} className="flex gap-2">
                                  <span className="text-muted-foreground w-14 shrink-0 font-medium">{label}:</span>
                                  <span className="text-foreground">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => setSugestaoExpandida(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => criarAcao(idx)} disabled={saving === idx}>
                          {saving === idx ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Criando...</>
                          ) : (
                            <><Plus className="w-3.5 h-3.5 mr-1.5" /> Criar no Plano de Ação</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <Button variant="outline" size="sm" className="w-full" onClick={gerarSugestoes} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Gerar novas sugestões
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
