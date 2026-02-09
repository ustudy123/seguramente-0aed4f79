import { useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Pin,
  Megaphone,
  Cake,
  Award,
  MoreHorizontal,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthContext } from "@/contexts/AuthContext";
import { FeedPost, useFeed, REACOES_CONFIG, TipoReacao } from "@/hooks/useFeed";
import { ComentariosList } from "./ComentariosList";
import { ImageLightbox } from "./ImageLightbox";

interface PostCardProps {
  post: FeedPost;
}

export function PostCard({ post }: PostCardProps) {
  const { user, hasMinimumRole } = useAuthContext();
  const { toggleReacao, deletarPost, toggleFixar } = useFeed();
  const [showComentarios, setShowComentarios] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isAutor = user?.id === post.autor_id;
  const canDelete = isAutor || hasMinimumRole("admin");
  const canPin = hasMinimumRole("manager");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPostIcon = () => {
    switch (post.tipo) {
      case "anuncio":
        return <Megaphone className="h-4 w-4" />;
      case "aniversario":
        return <Cake className="h-4 w-4" />;
      case "tempo_casa":
        return <Award className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getPostBadgeColor = () => {
    switch (post.tipo) {
      case "anuncio":
        return "bg-warning/10 text-warning border-warning/20";
      case "aniversario":
        return "bg-pink-500/10 text-pink-500 border-pink-500/20";
      case "tempo_casa":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "";
    }
  };

  const minhaReacao = post.reacoes.find((r) => r.user_id === user?.id);

  const handleReacao = (tipo: TipoReacao) => {
    toggleReacao.mutate({ postId: post.id, tipo });
  };

  const reacoesAgrupadas = post.reacoes.reduce((acc, r) => {
    acc[r.tipo] = (acc[r.tipo] || 0) + 1;
    return acc;
  }, {} as Record<TipoReacao, number>);

  const reacoesOrdenadas = Object.entries(reacoesAgrupadas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`mb-4 ${post.fixado ? "border-primary/50 bg-primary/5" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.autor_avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(post.autor_nome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {post.autor_nome}
                  </span>
                  {post.tipo !== "post" && (
                    <Badge variant="outline" className={getPostBadgeColor()}>
                      {getPostIcon()}
                      <span className="ml-1 capitalize">{post.tipo.replace("_", " ")}</span>
                    </Badge>
                  )}
                  {post.fixado && (
                    <Badge variant="secondary" className="gap-1">
                      <Pin className="h-3 w-3" />
                      Fixado
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            </div>

            {(canDelete || canPin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canPin && (
                    <DropdownMenuItem
                      onClick={() =>
                        toggleFixar.mutate({
                          postId: post.id,
                          fixado: !post.fixado,
                        })
                      }
                    >
                      <Pin className="h-4 w-4 mr-2" />
                      {post.fixado ? "Desfixar" : "Fixar"}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deletarPost.mutate(post.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <p className="text-foreground whitespace-pre-wrap mb-3">
            {post.conteudo}
          </p>

          {post.imagem_url && (
            <>
              <img
                src={post.imagem_url}
                alt="Imagem do post"
                className="rounded-lg max-h-96 w-full object-cover mb-3 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxOpen(true)}
              />
              <ImageLightbox
                imageUrl={post.imagem_url}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                alt="Imagem do post"
              />
            </>
          )}

          {/* Resumo de reações */}
          {reacoesOrdenadas.length > 0 && (
            <div className="flex items-center gap-1 mb-3 text-sm text-muted-foreground">
              <div className="flex -space-x-1">
                {reacoesOrdenadas.map(([tipo]) => (
                  <span key={tipo} className="text-base">
                    {REACOES_CONFIG[tipo as TipoReacao].emoji}
                  </span>
                ))}
              </div>
              <span>{post.reacoes.length}</span>
            </div>
          )}

          {/* Barra de ações */}
          <div className="flex items-center justify-between border-t border-b py-1 mb-2">
            <div className="flex items-center gap-1">
              {(Object.keys(REACOES_CONFIG) as TipoReacao[]).map((tipo) => (
                <Tooltip key={tipo}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2 ${
                        minhaReacao?.tipo === tipo
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => handleReacao(tipo)}
                    >
                      <span className="text-base mr-1">
                        {REACOES_CONFIG[tipo].emoji}
                      </span>
                      {reacoesAgrupadas[tipo] || ""}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{REACOES_CONFIG[tipo].label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowComentarios(!showComentarios)}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {post.comentarios.length > 0
                ? `${post.comentarios.length} comentário${
                    post.comentarios.length > 1 ? "s" : ""
                  }`
                : "Comentar"}
            </Button>
          </div>

          {/* Comentários */}
          {showComentarios && (
            <ComentariosList
              postId={post.id}
              comentarios={post.comentarios}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
