import { useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, User, Settings, Shield, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useAuthContext } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { EmpresaSelector } from "@/components/layout/EmpresaSelector";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { useHumorDiario } from "@/hooks/useHumorDiario";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppRole } from "@/types/database";

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  user: "Colaborador",
};

function getRoleLabel(roles: AppRole[]): string {
  const hierarchy: AppRole[] = ["superadmin", "owner", "admin", "manager", "user"];
  for (const r of hierarchy) {
    if (roles.includes(r)) return roleLabels[r] || r;
  }
  return "Administrador";
}

interface HeaderProps {
  onMenuToggle?: () => void;
  isMobile?: boolean;
}

export const Header = ({ onMenuToggle, isMobile }: HeaderProps) => {
  const { profile, signOut, isSuperAdmin, user, roles } = useAuthContext();
  const { tenant } = useTenant();
  const { humorHoje } = useHumorDiario();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="h-16 border-b border-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-30" style={{ background: 'linear-gradient(135deg, hsl(262 52% 50%) 0%, hsl(280 40% 68%) 50%, hsl(262 40% 60%) 100%)' }}>
      <div className="flex items-center gap-2">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onMenuToggle} className="mr-1">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <GlobalSearch />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Logged in as */}
        <span className="hidden md:inline text-xs text-white/80">
          Logado como <strong className="text-white">{user?.email}</strong>
        </span>
        {/* Super Admin indicator */}
        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin")}
            className="hidden md:flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10"
          >
            <Shield className="w-4 h-4" />
            Super Admin
          </Button>
        )}

        {/* Empresa Selector */}
        <EmpresaSelector />

        {/* Humor indicator */}
        {humorHoje ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xl cursor-default select-none" title={humorHoje.humor}>
                {humorHoje.emoji}
              </span>
            </TooltipTrigger>
            <TooltipContent>Humor: {humorHoje.humor}</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  // Reset localStorage flags so popup shows again
                  const today = new Date().toISOString().split("T")[0];
                  localStorage.removeItem(`humor_morning_${user?.id}_${today}`);
                  localStorage.removeItem(`humor_lastshown_${user?.id}`);
                  window.dispatchEvent(new Event("humor-reopen"));
                }}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Registrar humor do dia</TooltipContent>
          </Tooltip>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 md:gap-3 pl-2 pr-2 md:pr-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {profile?.nome_completo ? getInitials(profile.nome_completo) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">
                  {profile?.nome_completo?.split(" ")[0] || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.cargo || (isSuperAdmin ? "Super Admin" : getRoleLabel(roles))}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              {profile?.nome_completo || "Minha Conta"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/meu-perfil")}>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
