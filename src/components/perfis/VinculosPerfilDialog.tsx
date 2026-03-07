import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { PerfilAcesso, UsuarioPerfilVinculo } from "@/hooks/usePerfisAcesso";
import { UserPlus, X } from "lucide-react";

interface VinculosPerfilDialogProps {
  open: boolean;
  onClose: () => void;
  perfil: PerfilAcesso;
  vinculos: UsuarioPerfilVinculo[];
  usuarios: { id: string; nome_completo: string; email_principal: string }[];
  onVincular: (usuarioId: string) => void;
  onDesvincular: (vinculoId: string) => void;
}

export function VinculosPerfilDialog({
  open, onClose, perfil, vinculos, usuarios, onVincular, onDesvincular,
}: VinculosPerfilDialogProps) {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");

  const vinculosDoPerfil = vinculos.filter((v) => v.perfil_id === perfil.id);
  const idsVinculados = new Set(vinculosDoPerfil.map((v) => v.usuario_id));
  const usuariosDisponiveis = usuarios.filter((u) => !idsVinculados.has(u.id));

  const handleVincular = () => {
    if (!usuarioSelecionado) return;
    onVincular(usuarioSelecionado);
    setUsuarioSelecionado("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: perfil.cor || "#6366f1" }}
            >
              {perfil.nome.charAt(0)}
            </div>
            Usuários — {perfil.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Adicionar usuário */}
          <div className="flex gap-2">
            <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecionar usuário para vincular..." />
              </SelectTrigger>
              <SelectContent>
                {usuariosDisponiveis.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground px-3 py-2">Todos os usuários já possuem este perfil</p>
                ) : usuariosDisponiveis.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="text-[13px]">{u.nome_completo}</span>
                    <span className="text-[11px] text-muted-foreground ml-1">({u.email_principal})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleVincular} disabled={!usuarioSelecionado}>
              <UserPlus className="w-4 h-4 mr-1" /> Vincular
            </Button>
          </div>

          {/* Lista de usuários vinculados */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {vinculosDoPerfil.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-6">
                Nenhum usuário vinculado a este perfil
              </p>
            ) : vinculosDoPerfil.map((v) => {
              const nome = (v.usuario as any)?.nome_completo || "Usuário";
              const email = (v.usuario as any)?.email_principal || "";
              return (
                <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-muted/20">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-[11px] font-medium">
                      {nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{email}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">Ativo</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDesvincular(v.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
