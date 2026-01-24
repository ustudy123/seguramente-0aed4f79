import { useState } from "react";
import { motion } from "framer-motion";
import { Send, EyeOff, Eye, Lightbulb, AlertTriangle, AlertCircle, Star, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { TipoManifestacao } from "@/types/ouvidoria";

interface OuvidoriaFormProps {
  onSubmit: (data: {
    tipo: TipoManifestacao;
    assunto: string;
    mensagem: string;
    anonimo: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

const TIPOS_MANIFESTACAO = [
  {
    value: "sugestao" as TipoManifestacao,
    label: "Sugestão",
    icon: Lightbulb,
    description: "Propor melhorias ou ideias",
    color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500",
  },
  {
    value: "reclamacao" as TipoManifestacao,
    label: "Reclamação",
    icon: AlertTriangle,
    description: "Relatar insatisfação",
    color: "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-500",
  },
  {
    value: "denuncia" as TipoManifestacao,
    label: "Denúncia",
    icon: AlertCircle,
    description: "Reportar irregularidades",
    color: "border-red-500 bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-500",
  },
  {
    value: "elogio" as TipoManifestacao,
    label: "Elogio",
    icon: Star,
    description: "Reconhecer algo positivo",
    color: "border-green-500 bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-500",
  },
  {
    value: "duvida" as TipoManifestacao,
    label: "Dúvida",
    icon: HelpCircle,
    description: "Pedir esclarecimentos",
    color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30",
    iconColor: "text-purple-500",
  },
];

export function OuvidoriaForm({ onSubmit, isLoading }: OuvidoriaFormProps) {
  const [tipo, setTipo] = useState<TipoManifestacao | null>(null);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [anonimo, setAnonimo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || !assunto.trim() || !mensagem.trim()) return;

    await onSubmit({
      tipo,
      assunto: assunto.trim(),
      mensagem: mensagem.trim(),
      anonimo,
    });

    // Reset form
    setTipo(null);
    setAssunto("");
    setMensagem("");
    setAnonimo(false);
  };

  const isValid = tipo && assunto.trim() && mensagem.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Nova Manifestação
        </CardTitle>
        <CardDescription>
          Envie sua sugestão, reclamação, denúncia, elogio ou dúvida. Você pode escolher enviar de forma anônima.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Manifestação */}
          <div className="space-y-3">
            <Label>Tipo de Manifestação *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {TIPOS_MANIFESTACAO.map((tipoItem) => {
                const Icon = tipoItem.icon;
                const isSelected = tipo === tipoItem.value;

                return (
                  <motion.button
                    key={tipoItem.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTipo(tipoItem.value)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-left",
                      isSelected
                        ? tipoItem.color + " border-opacity-100"
                        : "border-border hover:border-muted-foreground/50 bg-card"
                    )}
                  >
                    <Icon className={cn("w-6 h-6 mb-2", isSelected ? tipoItem.iconColor : "text-muted-foreground")} />
                    <p className="font-medium text-sm">{tipoItem.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tipoItem.description}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Toggle Anônimo */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-3">
              {anonimo ? (
                <EyeOff className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Eye className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">Enviar de forma anônima</p>
                <p className="text-sm text-muted-foreground">
                  {anonimo
                    ? "Sua identidade não será revelada"
                    : "Seu nome será visível para os gestores"}
                </p>
              </div>
            </div>
            <Switch checked={anonimo} onCheckedChange={setAnonimo} />
          </div>

          {anonimo && (
            <Alert>
              <EyeOff className="h-4 w-4" />
              <AlertDescription>
                <strong>Manifestação Anônima:</strong> Sua identidade será completamente protegida. 
                Os gestores não terão acesso ao seu nome, email ou departamento.
              </AlertDescription>
            </Alert>
          )}

          {/* Assunto */}
          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto *</Label>
            <Input
              id="assunto"
              placeholder="Resumo da sua manifestação"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">{assunto.length}/200</p>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem *</Label>
            <Textarea
              id="mensagem"
              placeholder="Descreva detalhadamente sua manifestação..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{mensagem.length}/5000</p>
          </div>

          {/* Botão de Envio */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Manifestação
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
