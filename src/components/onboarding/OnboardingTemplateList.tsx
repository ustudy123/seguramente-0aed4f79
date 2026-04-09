import { useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, Loader2, Copy, ToggleLeft, ToggleRight,
  Building2, Users, Briefcase, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOnboardingTemplates } from "@/hooks/useOnboarding";
import type { OnboardingTemplate } from "@/types/onboarding";

interface Props {
  onSelect: (t: OnboardingTemplate) => void;
  onNew: () => void;
  onEdit: (t: OnboardingTemplate) => void;
}

export function OnboardingTemplateList({ onSelect, onNew, onEdit }: Props) {
  const { templates, isLoading, excluirTemplate, atualizarTemplate } = useOnboardingTemplates();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-xl border border-border">
        <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.5} />
        <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum template de onboarding</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Crie templates para automatizar o onboarding de novos colaboradores com trilhas gamificadas.
        </p>
        <Button onClick={onNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Criar Primeiro Template
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} template(s)</p>
        <Button onClick={onNew} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card
              className="border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => onSelect(t)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {t.nome}
                    </h3>
                    {t.descricao && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.descricao}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2 group-hover:text-primary transition-colors" />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px]">
                    {t.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  {t.prazo_dias && (
                    <Badge variant="outline" className="text-[10px]">{t.prazo_dias} dias</Badge>
                  )}
                  {t.emitir_certificado && (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">Certificado</Badge>
                  )}
                </div>

                {/* Critérios */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  {t.funcoes?.length ? (
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      <span>{t.funcoes.join(", ")}</span>
                    </div>
                  ) : null}
                  {t.departamentos?.length ? (
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>{t.departamentos.join(", ")}</span>
                    </div>
                  ) : null}
                  {!t.funcoes?.length && !t.departamentos?.length && !t.tipos_vinculo?.length && (
                    <span className="text-muted-foreground/60 italic">Aplica a todos os colaboradores</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(t)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => atualizarTemplate({ id: t.id, ativo: !t.ativo })}
                  >
                    {t.ativo ? <ToggleRight className="w-3.5 h-3.5 text-success" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={async () => {
                      const ok = await confirm({ title: "Remover template", description: "Remover este template?", confirmLabel: "Remover" });
                      if (ok) excluirTemplate(t.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
