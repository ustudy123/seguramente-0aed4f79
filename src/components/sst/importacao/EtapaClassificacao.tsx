import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Brain, CheckCircle2, AlertCircle, Loader2, FileQuestion } from "lucide-react";
import { ImportacaoState } from "./ImportacaoInteligente";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIPOS_DOCUMENTO = [
  { value: "PGR", label: "PGR — Programa de Gerenciamento de Riscos" },
  { value: "PCMSO", label: "PCMSO — Programa de Controle Médico de Saúde Ocupacional" },
  { value: "LTCAT", label: "LTCAT — Laudo Técnico das Condições Ambientais" },
  { value: "PPP", label: "PPP — Perfil Profissiográfico Previdenciário" },
  { value: "APR", label: "APR — Análise Preliminar de Risco" },
  { value: "NR12", label: "NR-12 — Análise de Risco de Máquinas" },
  { value: "AEP", label: "AEP — Análise Ergonômica Preliminar" },
  { value: "AET", label: "AET — Análise Ergonômica do Trabalho" },
  { value: "LAUDO_INSALUBRIDADE", label: "Laudo de Insalubridade" },
  { value: "LAUDO_PERICULOSIDADE", label: "Laudo de Periculosidade" },
  { value: "AVALIACAO_AMBIENTAL", label: "Avaliação Ambiental / Higiene Ocupacional" },
  { value: "RELATORIO_MEDICOES", label: "Relatório de Medições" },
  { value: "RELATORIO_AUDITORIA", label: "Relatório de Auditoria SST" },
  { value: "PARECER_TECNICO", label: "Parecer Técnico" },
  { value: "OUTROS", label: "Outros" },
];

interface Props {
  state: ImportacaoState;
  updateState: (partial: Partial<ImportacaoState>) => void;
}

export function EtapaClassificacao({ state, updateState }: Props) {
  const [classificando, setClassificando] = useState(false);
  const [tipoManual, setTipoManual] = useState("");
  const [modoManual, setModoManual] = useState(false);

  useEffect(() => {
    if (!state.tipoDetectado) {
      classificarDocumento();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classificarDocumento = async () => {
    setClassificando(true);
    updateState({ processando: true, erro: null });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sst-importacao`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "classificar",
            documento_texto: state.textoExtraido,
            documento_nome: state.arquivo?.name || "",
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      updateState({
        tipoDetectado: data.tipo || "OUTROS",
        confiancaClassificacao: data.confianca || 0,
        justificativaClassificacao: data.justificativa || "",
        processando: false,
      });
    } catch (err: any) {
      updateState({ erro: err.message, processando: false });
      toast.error("Erro na classificação: " + err.message);
      setModoManual(true);
    } finally {
      setClassificando(false);
    }
  };

  const handleConfirmar = () => {
    const tipo = modoManual ? tipoManual : state.tipoDetectado;
    if (!tipo) {
      toast.error("Selecione o tipo do documento");
      return;
    }
    updateState({ tipoDetectado: tipo, etapa: 3 });
  };

  const confiancaColor = state.confiancaClassificacao >= 80
    ? "text-green-600" : state.confiancaClassificacao >= 60
    ? "text-amber-600" : "text-red-600";

  const labelTipo = TIPOS_DOCUMENTO.find(t => t.value === state.tipoDetectado)?.label || state.tipoDetectado;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5 text-primary" />
            Classificação Automática do Documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {classificando ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando conteúdo do documento...</p>
              <p className="text-xs text-muted-foreground">A IA está identificando o tipo e estrutura</p>
            </div>
          ) : state.tipoDetectado && !modoManual ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Tipo identificado</p>
                  <p className="font-semibold text-foreground text-lg">{labelTipo}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">Confiança:</span>
                    <span className={`text-sm font-bold ${confiancaColor}`}>
                      {state.confiancaClassificacao}%
                    </span>
                    {state.confiancaClassificacao >= 80 ? (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Alta confiança</Badge>
                    ) : state.confiancaClassificacao >= 60 ? (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">Confiança média</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Baixa confiança</Badge>
                    )}
                  </div>
                  {state.justificativaClassificacao && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      "{state.justificativaClassificacao}"
                    </p>
                  )}
                </div>
              </div>

              {state.confiancaClassificacao < 70 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      Confiança baixa — confirme o tipo
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Recomendamos verificar se o tipo identificado está correto antes de prosseguir.
                    </p>
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => setModoManual(true)}>
                <FileQuestion className="w-4 h-4 mr-2" />
                Corrigir tipo manualmente
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {state.erro
                    ? "Não foi possível classificar automaticamente. Selecione o tipo manualmente."
                    : "Selecione o tipo do documento."}
                </p>
              </div>
              <div>
                <Label>Tipo de Documento</Label>
                <Select value={tipoManual || state.tipoDetectado} onValueChange={setTipoManual}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!state.erro && (
                <Button variant="outline" size="sm" onClick={() => { setModoManual(false); classificarDocumento(); }}>
                  <Brain className="w-4 h-4 mr-2" />
                  Tentar classificação automática
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleConfirmar}
          disabled={classificando || (!state.tipoDetectado && !tipoManual)}
          size="lg"
        >
          Confirmar e Extrair Dados
        </Button>
      </div>
    </div>
  );
}
