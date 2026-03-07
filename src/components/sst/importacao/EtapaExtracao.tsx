import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Building2, Users, AlertTriangle, Target, UserCheck, Loader2 } from "lucide-react";
import { ImportacaoState } from "./ImportacaoInteligente";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ETAPAS_EXTRACAO = [
  { icon: Building2, label: "Dados gerais e empresa" },
  { icon: Users, label: "Estrutura organizacional" },
  { icon: AlertTriangle, label: "Inventário de riscos" },
  { icon: Target, label: "Plano de ação" },
  { icon: UserCheck, label: "Responsáveis técnicos" },
];

interface Props {
  state: ImportacaoState;
  updateState: (partial: Partial<ImportacaoState>) => void;
}

export function EtapaExtracao({ state, updateState }: Props) {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!hasRunRef.current) {
      hasRunRef.current = true;
      extrairDados();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extrairDados = async () => {
    updateState({ processando: true, erro: null });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sst-importacao`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: "extrair",
            documento_texto: state.textoExtraido,
            documento_tipo: state.tipoDetectado,
            documento_nome: state.arquivo?.name || "",
          }),
        }
      );

      clearTimeout(timeout);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      const data = await resp.json();
      updateState({ dadosExtraidos: data, etapa: 4, processando: false });
      toast.success("Dados extraídos com sucesso!");
    } catch (err: any) {
      const msg = err.name === "AbortError"
        ? "Tempo limite excedido. O documento pode ser muito extenso."
        : err.message;
      updateState({ erro: msg, processando: false });
      toast.error("Erro na extração: " + msg);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5 text-primary" />
            Extração e Interpretação Semântica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center py-4 gap-2">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            </div>
            <p className="font-medium text-foreground">Analisando documento com IA...</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              O GPT-4o está lendo o documento completo e extraindo todas as informações técnicas.
              Isso pode levar até 1 minuto.
            </p>
          </div>

          <div className="space-y-2">
            {ETAPAS_EXTRACAO.map((etapa, i) => {
              const Icon = etapa.icon;
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40">
                  <div className="p-1.5 bg-background rounded-md border">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{etapa.label}</span>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Badge variant="outline" className="text-xs bg-background">{state.tipoDetectado}</Badge>
            <span className="text-xs text-muted-foreground flex-1 truncate">{state.arquivo?.name}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
