import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PerfilAcesso } from "@/hooks/usePerfisAcesso";
import {
  MoreVertical, Pencil, Copy, Power, Users, ShieldCheck,
  User, UserCheck, DollarSign, HardHat, Briefcase, ClipboardList,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck, User, UserCheck, Users, DollarSign, HardHat, Briefcase, ClipboardList, Lock,
};

interface PerfilCardProps {
  perfil: PerfilAcesso;
  onEdit: (perfil: PerfilAcesso) => void;
  onClone: (perfil: PerfilAcesso) => void;
  onToggleStatus: (id: string, ativo: boolean) => void;
  onVerVinculos: (perfil: PerfilAcesso) => void;
}

export function PerfilCard({ perfil, onEdit, onClone, onToggleStatus, onVerVinculos }: PerfilCardProps) {
  const Icon = perfil.icone ? (ICON_MAP[perfil.icone] || ShieldCheck) : ShieldCheck;
  const modulosCount = perfil.permissoes
    ? new Set(perfil.permissoes.map((p) => p.modulo)).size
    : 0;

  return (
    <Card className={cn(
      "relative transition-all duration-200 hover:shadow-md border group",
      !perfil.ativo && "opacity-60"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: (perfil.cor || "#6366f1") + "22", border: `1.5px solid ${perfil.cor || "#6366f1"}44` }}
            >
              <Icon className="w-5 h-5" style={{ color: perfil.cor || "#6366f1" }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-[14px] leading-tight truncate">{perfil.nome}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4"
                  style={{ color: perfil.cor || "#6366f1", borderColor: (perfil.cor || "#6366f1") + "55" }}
                >
                  {perfil.tipo === "clonado" ? "Clonado" : perfil.tipo === "padrao_sistema" ? "Padrão" : "Personalizado"}
                </Badge>
                {!perfil.ativo && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">Inativo</Badge>}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(perfil)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClone(perfil)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVerVinculos(perfil)}>
                <Users className="w-4 h-4 mr-2" /> Ver usuários
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onToggleStatus(perfil.id, !perfil.ativo)}
                className={perfil.ativo ? "text-destructive" : "text-emerald-600"}
              >
                <Power className="w-4 h-4 mr-2" />
                {perfil.ativo ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {perfil.descricao && (
          <p className="text-[12px] text-muted-foreground line-clamp-2">{perfil.descricao}</p>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onVerVinculos(perfil)}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{perfil.total_usuarios} usuário{perfil.total_usuarios !== 1 ? "s" : ""}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Usuários com este perfil</TooltipContent>
          </Tooltip>
          <span className="text-[11px] text-muted-foreground/60">
            {modulosCount} módulo{modulosCount !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
