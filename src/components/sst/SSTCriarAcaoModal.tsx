import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, CheckCircle2, PenLine, AlertTriangle, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SSTDocumento } from "@/hooks/useSSTDocumentos";

interface SSTAchado {
  titulo: string;
  descricao: string;
  norma?: string;
  severidade: "critico" | "alerta" | "atencao";
}

interface SSTCriarAcaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achado: SSTAchado | null;
  documento: SSTDocumento | null;
}

interface Sugestao {
  titulo: string;
  descricao: string;
  como: string;
  porque: string;
  onde: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
}

const mapPrioridade = (p: string): "baixo" | "medio" | "urgente" | "imediato" => {
  if (p === "critica") return "imediato";
  if (p === "alta") return "urgente";
  if (p === "media") return "medio";
  return "baixo";
};

const severidadeColor: Record<string, string> = {
  critico: "bg-red-100 text-red-700 border-red-300",
  alerta: "bg-amber-100 text-amber-700 border-amber-300",
  atencao: "bg-yellow-100 text-yellow-700 border-yellow-300",
  alta: "bg-amber-100 text-amber-700 border-amber-300",
  media: "bg-blue-100 text-blue-700 border-blue-300",
  baixa: "bg-green-100 text-green-700 border-green-300",
};

export function SSTCriarAcaoModal({ open, onOpenChange, achado, documento }: SSTCriarAcaoModalProps) {
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [iaCarregada, setIaCarregada] = useState(false);

  const gerarSugestoesIA = async () => {
    if (!achado || !documento) return;
    setLoadingIA(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sst-acao-sugestao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            achado_titulo: achado.titulo,
            achado_descricao: achado.descricao,
            norma: achado.norma || "",
            documento_tipo: documento.tipo,
            severidade: achado.severidade,
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        if (data.sugestoes) {
          setSugestoes(data.sugestoes);
          setIaCarregada(true);
        }
      } else {
        // Fallback local
        setSugestoes(gerarSugestoesLocais(achado, documento));
        setIaCarregada(true);
      }
    } catch {
      setSugestoes(gerarSugestoesLocais(achado, documento));
      setIaCarregada(true);
    } finally {
      setLoadingIA(false);
    }
  };

  const gerarSugestoesLocais = (achado: SSTAchado, doc: SSTDocumento): Sugestao[] => {
    const prazo = achado.severidade === "critico" ? "imediato" : achado.severidade === "alerta" ? "30 dias" : "90 dias";
    return [
      {
        titulo: `Adequar ${doc.tipo} — ${achado.titulo}`,
        descricao: `Regularizar a conformidade do documento ${doc.tipo} para atender ao requisito: ${achado.descricao}`,
        como: `1. Identificar o responsável técnico pelo ${doc.tipo}\n2. Solicitar revisão e atualização do documento\n3. Incluir evidências de atendimento ao requisito\n4. Validar com profissional habilitado\n5. Arquivar nova versão no sistema`,
        porque: achado.norma
          ? `Exigência da ${achado.norma} — ${achado.descricao}`
          : `Conformidade legal obrigatória: ${achado.descricao}`,
        onde: `Área de SST / ${doc.empresa_emissora || "Empresa"}`,
        prioridade: achado.severidade === "critico" ? "critica" : achado.severidade === "alerta" ? "alta" : "media",
      },
      {
        titulo: `Contratar Profissional para Revisão do ${doc.tipo}`,
        descricao: `Contratar ou acionar profissional habilitado para revisão e adequação do documento à não-conformidade identificada.`,
        como: `1. Contatar profissional habilitado (${doc.profissional_responsavel || "Técnico de SST/Médico do Trabalho"})\n2. Apresentar a não-conformidade identificada\n3. Solicitar laudo de adequação\n4. Definir prazo: ${prazo}\n5. Validar e arquivar documentação`,
        porque: `A não-conformidade identificada pela auditoria pode gerar passivo jurídico e multas.`,
        onde: doc.empresa_emissora || "Prestador de serviços SST",
        prioridade: achado.severidade === "critico" ? "alta" : "media",
      },
    ];
  };

  const handleCriarAcao = async (sugestao: Sugestao) => {
    if (!tenantId || !user || !achado || !documento) return;
    setCriando(true);
    try {
      const prazo = new Date();
      prazo.setDate(prazo.getDate() + (achado.severidade === "critico" ? 7 : achado.severidade === "alerta" ? 30 : 90));

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        titulo: sugestao.titulo,
        descricao: sugestao.descricao,
        porque: sugestao.porque,
        onde: sugestao.onde,
        prazo: prazo.toISOString().split("T")[0],
        como: sugestao.como,
        responsavel_nome: profile?.nome_completo || user.email || "Não definido",
        prioridade: mapPrioridade(sugestao.prioridade),
        status: "pendente",
        origem_modulo: "compliance_sst",
        origem_descricao: `Compliance SST → ${documento.tipo}: ${achado.titulo}`,
        criado_por: user.id,
        criado_por_nome: profile?.nome_completo || user.email,
      };

      const { error } = await supabase.from("plano_acoes").insert(payload as never);
      if (error) throw error;

      toast.success("Ação criada no Plano de Ação!", {
        action: {
          label: "Ver Plano de Ação",
          onClick: () => navigate("/plano-acao"),
        },
      });
      onOpenChange(false);
      setSelectedIndex(null);
      setSugestoes([]);
      setIaCarregada(false);
    } catch (err: any) {
      toast.error("Erro ao criar ação: " + err.message);
    } finally {
      setCriando(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedIndex(null);
      setSugestoes([]);
      setIaCarregada(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Ação — Compliance SST
          </DialogTitle>
          <DialogDescription>
            Gere sugestões de ação com IA para resolver a não-conformidade identificada.
          </DialogDescription>
        </DialogHeader>

        {achado && (
          <div className={`p-3 rounded-lg border text-sm mb-2 ${
            achado.severidade === "critico"
              ? "bg-destructive/10 border-destructive/30"
              : achado.severidade === "alerta"
              ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
              : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="font-medium">{achado.titulo}</p>
              {achado.norma && <Badge variant="outline" className="text-xs">{achado.norma}</Badge>}
            </div>
            <p className="text-muted-foreground">{achado.descricao}</p>
          </div>
        )}

        {!iaCarregada ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-primary/10">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Gerar sugestões com IA</p>
              <p className="text-sm text-muted-foreground mt-1">
                A IA irá sugerir ações 5W2H específicas para resolver esta não-conformidade conforme as NRs.
              </p>
            </div>
            <Button onClick={gerarSugestoesIA} disabled={loadingIA} size="lg">
              {loadingIA ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando sugestões...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Gerar Sugestões com IA</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Sugestões geradas pela IA
              </p>
              {sugestoes.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedIndex(i === selectedIndex ? null : i)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedIndex === i
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-sm">{s.titulo}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${severidadeColor[s.prioridade] || ""}`}
                        >
                          {s.prioridade}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.descricao}</p>
                      {selectedIndex === i && (
                        <div className="mt-3 space-y-2 text-xs">
                          <div><span className="font-medium text-foreground">Por quê:</span> <span className="text-muted-foreground">{s.porque}</span></div>
                          <div><span className="font-medium text-foreground">Onde:</span> <span className="text-muted-foreground">{s.onde}</span></div>
                          <div>
                            <span className="font-medium text-foreground">Como:</span>
                            <pre className="text-muted-foreground whitespace-pre-wrap font-sans mt-0.5">{s.como}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedIndex === i && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => { handleClose(false); navigate("/plano-acao"); }}
              >
                <PenLine className="h-4 w-4" />
                Criar manualmente
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={selectedIndex === null || criando}
                onClick={() => selectedIndex !== null && handleCriarAcao(sugestoes[selectedIndex])}
              >
                {criando ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Criar ação selecionada</>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
