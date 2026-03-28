import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, CheckCircle2, Target, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OrigemModulo } from "@/types/planoAcao";

interface SugestaoIA {
  titulo: string;
  descricao: string;
  porque: string;
  onde: string;
  como: string;
  tipo: "corretiva" | "preventiva" | "melhoria";
  gravidade: number;
  urgencia: number;
  tendencia: number;
}

interface CriarAcaoAlertaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertaTitulo: string;
  alertaDescricao: string;
  origemModulo: OrigemModulo;
  origemId?: string;
  contextoExtra?: string;
}

export function CriarAcaoAlertaModal({
  open,
  onOpenChange,
  alertaTitulo,
  alertaDescricao,
  origemModulo,
  origemId,
  contextoExtra,
}: CriarAcaoAlertaModalProps) {
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  const { createAcao } = usePlanoAcao();
  const [sugestoes, setSugestoes] = useState<SugestaoIA[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [criada, setCriada] = useState(false);

  const gerarSugestoes = async () => {
    setLoading(true);
    setSugestoes([]);
    setSelectedIndex(null);
    setCriada(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "sugerir",
          contexto: `${alertaTitulo}: ${alertaDescricao}${contextoExtra ? `\n${contextoExtra}` : ""}`,
          dados: {
            titulo: alertaTitulo,
            descricao: alertaDescricao,
            origem: origemModulo,
          },
        },
      });
      if (error) throw new Error(error.message);

      // Also get 5W2H details
      const enriched: SugestaoIA[] = [];
      const rawSugestoes = data?.sugestoes || [];
      for (const s of rawSugestoes.slice(0, 3)) {
        const { data: w5h2Data } = await supabase.functions.invoke("ai-plano-acao", {
          body: {
            tipo: "gerar_5w2h",
            contexto: s.descricao,
            dados: { titulo: s.titulo, descricao: s.descricao, origem: origemModulo },
          },
        });
        enriched.push({
          titulo: s.titulo,
          descricao: s.descricao,
          porque: w5h2Data?.w5h2?.why || s.descricao,
          onde: w5h2Data?.w5h2?.where || "",
          como: w5h2Data?.w5h2?.how || "",
          tipo: s.tipo || "corretiva",
          gravidade: 3,
          urgencia: 3,
          tendencia: 3,
        });
      }
      setSugestoes(enriched.length > 0 ? enriched : rawSugestoes.map((s: any) => ({
        titulo: s.titulo,
        descricao: s.descricao,
        porque: "",
        onde: "",
        como: "",
        tipo: s.tipo || "corretiva",
        gravidade: 3,
        urgencia: 3,
        tendencia: 3,
      })));
    } catch (err: any) {
      toast.error("Erro ao gerar sugestões: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarAcao = async (sugestao: SugestaoIA) => {
    if (!tenantId || !user) return;
    setCriando(true);
    try {
      await createAcao({
        titulo: sugestao.titulo,
        descricao: sugestao.descricao,
        porque: sugestao.porque,
        onde: sugestao.onde,
        como: sugestao.como,
        tipo: sugestao.tipo,
        origem_modulo: origemModulo,
        origem_id: origemId,
        origem_descricao: alertaTitulo,
        gravidade: sugestao.gravidade,
        urgencia: sugestao.urgencia,
        tendencia: sugestao.tendencia,
        prioridade: sugestao.gravidade >= 4 ? "urgente" : sugestao.gravidade >= 3 ? "medio" : "baixo",
        responsavel_id: user.id,
        responsavel_nome: profile?.nome_completo || user.email || "",
        exige_evidencia: false,
      });
      setCriada(true);
      toast.success("Ação criada no Plano de Ação!");
    } catch (err: any) {
      toast.error("Erro ao criar ação: " + err.message);
    } finally {
      setCriando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Ação — Assistente IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground mb-1">Alerta / Contexto</p>
            <p className="text-sm font-medium">{alertaTitulo}</p>
            {alertaDescricao && <p className="text-xs text-muted-foreground mt-1">{alertaDescricao}</p>}
            <Badge variant="outline" className="mt-2 text-xs">{origemModulo}</Badge>
          </div>

          {!sugestoes.length && !loading && !criada && (
            <Button onClick={gerarSugestoes} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar Sugestões de Ação com IA
            </Button>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Analisando e gerando sugestões 5W2H...</span>
            </div>
          )}

          {criada && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="font-medium">Ação criada com sucesso!</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button onClick={() => { onOpenChange(false); navigate("/plano-acao"); }}>
                  <ArrowRight className="w-4 h-4 mr-1" /> Ver no Plano de Ação
                </Button>
              </div>
            </div>
          )}

          {sugestoes.length > 0 && !criada && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {sugestoes.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedIndex === i
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.titulo}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.descricao}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{s.tipo}</Badge>
                    </div>
                    {(s.porque || s.como || s.onde) && (
                      <>
                        <Separator className="my-2" />
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          {s.porque && (
                            <div><span className="text-muted-foreground">Por quê:</span><br />{s.porque.slice(0, 80)}{s.porque.length > 80 ? "..." : ""}</div>
                          )}
                          {s.onde && (
                            <div><span className="text-muted-foreground">Onde:</span><br />{s.onde}</div>
                          )}
                          {s.como && (
                            <div><span className="text-muted-foreground">Como:</span><br />{s.como.slice(0, 80)}{s.como.length > 80 ? "..." : ""}</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {sugestoes.length > 0 && !criada && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={gerarSugestoes} disabled={loading}>
                <Sparkles className="h-4 w-4 mr-1" /> Regenerar
              </Button>
              <Button
                disabled={selectedIndex === null || criando}
                onClick={() => selectedIndex !== null && handleCriarAcao(sugestoes[selectedIndex])}
              >
                {criando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Target className="h-4 w-4 mr-1" />}
                Criar Ação Selecionada
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
