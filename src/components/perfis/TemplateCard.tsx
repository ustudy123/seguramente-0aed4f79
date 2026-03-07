import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PerfilTemplate } from "@/hooks/usePerfisAcesso";
import {
  ShieldCheck, User, UserCheck, Users, DollarSign,
  HardHat, Briefcase, ClipboardList, Lock, Download
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck, User, UserCheck, Users, DollarSign, HardHat, Briefcase, ClipboardList, Lock,
};

interface TemplateCardProps {
  template: PerfilTemplate;
  onUsar: (template: PerfilTemplate) => void;
  jaClonado?: boolean;
}

export function TemplateCard({ template, onUsar, jaClonado }: TemplateCardProps) {
  const Icon = template.icone ? (ICON_MAP[template.icone] || ShieldCheck) : ShieldCheck;
  const moduloCount = template.modulos_padrao?.length ?? 0;

  return (
    <Card className="border-dashed border-2 hover:border-solid hover:shadow-md transition-all duration-200 group">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (template.cor || "#6366f1") + "22" }}
          >
            <Icon className="w-4 h-4" style={{ color: template.cor || "#6366f1" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[13px] leading-tight text-foreground">{template.nome}</p>
            <Badge variant="secondary" className="text-[10px] mt-0.5 h-4">Template do sistema</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {template.descricao && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{template.descricao}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/60">{moduloCount} módulo{moduloCount !== 1 ? "s" : ""} configurado{moduloCount !== 1 ? "s" : ""}</span>
          <Button
            size="sm"
            variant={jaClonado ? "outline" : "default"}
            className="h-7 text-[11px] px-2.5"
            onClick={() => onUsar(template)}
            disabled={jaClonado}
          >
            <Download className="w-3 h-3 mr-1" />
            {jaClonado ? "Já adicionado" : "Usar template"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
