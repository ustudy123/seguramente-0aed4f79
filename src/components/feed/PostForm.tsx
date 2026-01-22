import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Send, X, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/contexts/AuthContext";
import { useFeed, TipoPost } from "@/hooks/useFeed";

export function PostForm() {
  const { profile, hasMinimumRole } = useAuthContext();
  const { criarPost, uploadImagem, isPending } = useFeed();
  const [conteudo, setConteudo] = useState("");
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoPost>("post");
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canCreateAnnouncement = hasMinimumRole("manager");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Imagem muito grande. Máximo 5MB.");
        return;
      }
      setImagemFile(file);
      setImagemPreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImagemFile(null);
    setImagemPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!conteudo.trim()) return;

    try {
      let imagem_url: string | undefined;

      if (imagemFile) {
        imagem_url = await uploadImagem(imagemFile);
      }

      await criarPost.mutateAsync({
        conteudo: conteudo.trim(),
        tipo,
        imagem_url,
      });

      setConteudo("");
      setTipo("post");
      removeImage();
      setIsExpanded(false);
    } catch (error) {
      console.error("Erro ao publicar:", error);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {profile ? getInitials(profile.nome_completo) : "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              placeholder="No que você está pensando?"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              className={`resize-none border-0 bg-muted/50 focus-visible:ring-1 transition-all ${
                isExpanded ? "min-h-[100px]" : "min-h-[44px]"
              }`}
            />

            <AnimatePresence>
              {imagemPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 relative"
                >
                  <img
                    src={imagemPreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-muted-foreground"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Foto
                    </Button>

                    {canCreateAnnouncement && (
                      <Badge
                        variant={tipo === "anuncio" ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setTipo(tipo === "anuncio" ? "post" : "anuncio")
                        }
                      >
                        <Megaphone className="h-3 w-3 mr-1" />
                        Anúncio
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsExpanded(false);
                        setConteudo("");
                        removeImage();
                        setTipo("post");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={!conteudo.trim() || isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Publicar
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
