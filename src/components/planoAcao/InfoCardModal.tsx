import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface InfoCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  children: ReactNode;
}

export function InfoCardModal({
  open,
  onOpenChange,
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  children,
}: InfoCardModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-primary/10 ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <span>{title}</span>
              {subtitle && (
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <Separator className="my-2" />
        <div className="space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// Componente para exibir detalhes do 5W2H
interface W5H2DetailProps {
  label: string;
  value?: string | number | null;
  emptyText?: string;
  badge?: string;
  format?: "text" | "currency" | "date";
}

export function W5H2Detail({ 
  label, 
  value, 
  emptyText = "Não informado",
  badge,
  format = "text" 
}: W5H2DetailProps) {
  let displayValue = value;

  if (format === "currency" && typeof value === "number") {
    displayValue = `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
      </div>
      <p className="text-base">
        {displayValue || <span className="text-muted-foreground italic">{emptyText}</span>}
      </p>
    </div>
  );
}

// Modal para Matriz GUT
interface GutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gravidade: number;
  urgencia: number;
  tendencia: number;
  pontuacao: number;
  prioridade?: string;
}

const GUT_DESCRIPTIONS: Record<number, Record<string, string>> = {
  1: {
    gravidade: "Dano mínimo",
    urgencia: "Pode esperar",
    tendencia: "Não irá piorar",
  },
  2: {
    gravidade: "Dano leve",
    urgencia: "Pode esperar um pouco",
    tendencia: "Irá piorar a longo prazo",
  },
  3: {
    gravidade: "Dano regular",
    urgencia: "O mais rápido possível",
    tendencia: "Irá piorar a médio prazo",
  },
  4: {
    gravidade: "Grande dano",
    urgencia: "É urgente",
    tendencia: "Irá piorar a curto prazo",
  },
  5: {
    gravidade: "Dano gravíssimo",
    urgencia: "Ação imediata",
    tendencia: "Irá piorar rapidamente",
  },
};

export function GutModal({
  open,
  onOpenChange,
  gravidade,
  urgencia,
  tendencia,
  pontuacao,
  prioridade,
}: GutModalProps) {
  const getPrioridadeColor = () => {
    switch (prioridade) {
      case "imediato": return "bg-red-500";
      case "urgente": return "bg-orange-500";
      case "medio": return "bg-yellow-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Matriz GUT - Priorização
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Score central */}
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className={`w-24 h-24 rounded-full ${getPrioridadeColor()} flex items-center justify-center mx-auto`}>
                <span className="text-3xl font-bold text-white">{pontuacao}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Pontuação Total</p>
              {prioridade && (
                <Badge className="mt-1 capitalize">{prioridade}</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Fórmula */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-center mb-2 text-muted-foreground">Fórmula de cálculo:</p>
            <div className="flex items-center justify-center gap-2 text-lg font-mono">
              <span className="text-red-600 font-bold">{gravidade}</span>
              <span>×</span>
              <span className="text-orange-600 font-bold">{urgencia}</span>
              <span>×</span>
              <span className="text-yellow-600 font-bold">{tendencia}</span>
              <span>=</span>
              <span className="text-primary font-bold">{pontuacao}</span>
            </div>
          </div>

          {/* Detalhes de cada critério */}
          <div className="space-y-4">
            {/* Gravidade */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-red-600">Gravidade (G)</span>
                  <Badge variant="outline" className="text-red-600 border-red-600">{gravidade}/5</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Impacto do problema se não for resolvido
                </p>
                <p className="text-sm mt-1 font-medium">
                  {GUT_DESCRIPTIONS[gravidade]?.gravidade}
                </p>
              </CardContent>
            </Card>

            {/* Urgência */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-orange-600">Urgência (U)</span>
                  <Badge variant="outline" className="text-orange-600 border-orange-600">{urgencia}/5</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pressão do tempo para resolver
                </p>
                <p className="text-sm mt-1 font-medium">
                  {GUT_DESCRIPTIONS[urgencia]?.urgencia}
                </p>
              </CardContent>
            </Card>

            {/* Tendência */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-yellow-600">Tendência (T)</span>
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">{tendencia}/5</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Evolução do problema com o tempo
                </p>
                <p className="text-sm mt-1 font-medium">
                  {GUT_DESCRIPTIONS[tendencia]?.tendencia}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Legenda de prioridades */}
          <div className="bg-muted/30 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Escala de prioridades:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>64-125: Imediato</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>27-63: Urgente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>8-26: Médio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>1-7: Baixo</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
