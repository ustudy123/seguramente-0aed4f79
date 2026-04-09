import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Pencil, Trash2, GripVertical, Loader2,
  Building2, Heart, MessageCircle, CheckSquare, FileText, HelpCircle, Lightbulb,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOnboardingEtapas } from "@/hooks/useOnboarding";
import type { OnboardingTemplate, OnboardingEtapa, OnboardingEtapaTipo } from "@/types/onboarding";
import { ETAPA_TIPO_LABELS } from "@/types/onboarding";
import { OnboardingEtapaForm } from "./OnboardingEtapaForm";

const iconMap: Record<OnboardingEtapaTipo, React.ElementType> = {
  apresentacao_institucional: Building2,
  cultura_valores: Heart,
  mural_boas_vindas: MessageCircle,
  checklist_integracao: CheckSquare,
  conteudo_livre: FileText,
  quiz: HelpCircle,
  reflexao: Lightbulb,
};

const colorMap: Record<OnboardingEtapaTipo, string> = {
  apresentacao_institucional: "bg-blue-500/10 text-blue-600",
  cultura_valores: "bg-rose-500/10 text-rose-600",
  mural_boas_vindas: "bg-amber-500/10 text-amber-600",
  checklist_integracao: "bg-emerald-500/10 text-emerald-600",
  conteudo_livre: "bg-cyan-500/10 text-cyan-600",
  quiz: "bg-violet-500/10 text-violet-600",
  reflexao: "bg-orange-500/10 text-orange-600",
};

interface Props {
  template: OnboardingTemplate;
  onBack: () => void;
  onEdit: () => void;
}

export function OnboardingTemplateDetail({ template, onBack, onEdit }: Props) {
  const { etapas, isLoading, excluirEtapa } = useOnboardingEtapas(template.id);
  const [showEtapaForm, setShowEtapaForm] = useState(false);
  const [editingEtapa, setEditingEtapa] = useState<OnboardingEtapa | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{template.nome}</h2>
          {template.descricao && (
            <p className="text-sm text-muted-foreground mt-1">{template.descricao}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          <Pencil className="w-4 h-4" />
          Editar
        </Button>
      </div>

      {/* Etapas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Etapas do Onboarding</h3>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => { setEditingEtapa(null); setShowEtapaForm(true); }}
          >
            <Plus className="w-4 h-4" />
            Adicionar Etapa
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : etapas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa cadastrada. Adicione etapas para montar a trilha de onboarding.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {etapas.map((etapa, i) => {
              const Icon = iconMap[etapa.tipo] || FileText;
              return (
                <motion.div
                  key={etapa.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="border-border hover:border-primary/20 transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground/40">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-xs font-mono w-5">{i + 1}</span>
                      </div>
                      <div className={`p-2 rounded-lg ${colorMap[etapa.tipo]}`}>
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm">{etapa.titulo}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">
                            {ETAPA_TIPO_LABELS[etapa.tipo]}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            ~{etapa.tempo_estimado_min}min • {etapa.pontuacao}pts
                          </span>
                          {etapa.obrigatoria && (
                            <Badge className="text-[10px] bg-destructive/10 text-destructive">Obrigatória</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditingEtapa(etapa); setShowEtapaForm(true); }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={async () => { const confirmed = await confirm({ title: "Remover etapa", description: "Remover esta etapa?", confirmLabel: "Remover" }); if (confirmed) excluirEtapa(etapa.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <OnboardingEtapaForm
        open={showEtapaForm}
        onOpenChange={setShowEtapaForm}
        templateId={template.id}
        etapa={editingEtapa}
        nextOrdem={etapas.length}
      />
    </div>
  );
}
