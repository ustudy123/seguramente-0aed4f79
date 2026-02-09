import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { FeedComentario, useFeed } from "@/hooks/useFeed";
import { MentionInput } from "./MentionInput";

interface ComentariosListProps {
  postId: string;
  comentarios: FeedComentario[];
}

export function ComentariosList({ postId, comentarios }: ComentariosListProps) {
  const { user, profile, hasMinimumRole } = useAuthContext();
  const { adicionarComentario, deletarComentario, isPending } = useFeed();
  const [novoComentario, setNovoComentario] = useState("");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!novoComentario.trim()) return;

    await adicionarComentario.mutateAsync({
      postId,
      conteudo: novoComentario.trim(),
    });
    setNovoComentario("");
  };

  const canDeleteComment = (comentario: FeedComentario) => {
    return comentario.autor_id === user?.id || hasMinimumRole("admin");
  };

  return (
    <div className="mt-2 space-y-3">
      {/* Lista de comentários */}
      {comentarios.map((comentario) => (
        <div key={comentario.id} className="flex gap-2 group">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comentario.autor_avatar || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {getInitials(comentario.autor_nome)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="bg-muted/50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {comentario.autor_nome}
                </span>
                {canDeleteComment(comentario) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deletarComentario.mutate(comentario.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground">{comentario.conteudo}</p>
            </div>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(comentario.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        </div>
      ))}

      {/* Formulário de novo comentário */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {profile ? getInitials(profile.nome_completo) : "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-2">
          <MentionInput
            placeholder="Escreva um comentário... Use @ para mencionar"
            value={novoComentario}
            onChange={setNovoComentario}
            className="h-8 text-sm"
            onSubmit={handleSubmit}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8"
            disabled={!novoComentario.trim() || isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
