import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import type { PlanoComentario } from "@/types/planoAcao";

interface PlanoAcaoComentariosProps {
  acaoId: string;
  comentarios: PlanoComentario[];
}

export function PlanoAcaoComentarios({ acaoId, comentarios }: PlanoAcaoComentariosProps) {
  const [novoComentario, setNovoComentario] = useState("");
  const { createComentario, isCreatingComentario } = usePlanoAcao();

  const handleSubmit = async () => {
    if (!novoComentario.trim()) return;

    await createComentario({
      acaoId,
      conteudo: novoComentario,
    });

    setNovoComentario("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Comentários</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input de novo comentário */}
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Adicione um comentário... (Ctrl+Enter para enviar)"
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!novoComentario.trim() || isCreatingComentario}
              >
                <Send className="h-4 w-4 mr-2" />
                {isCreatingComentario ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de comentários */}
        {comentarios.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum comentário ainda</p>
            <p className="text-xs mt-1">Seja o primeiro a comentar nesta ação</p>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {comentarios.map((comentario) => (
              <div key={comentario.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {comentario.autor_nome
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{comentario.autor_nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comentario.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comentario.conteudo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
