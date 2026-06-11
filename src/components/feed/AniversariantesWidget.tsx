import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, PartyPopper, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAniversariantes } from "@/hooks/useFeed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/dataLocal";

interface AniversariantesWidgetProps {
  onFelicitar?: (mensagem: string) => void;
}

export function AniversariantesWidget({ onFelicitar }: AniversariantesWidgetProps) {
  const { data: aniversariantes = [], isLoading } = useAniversariantes();
  const [gerando, setGerando] = useState<string | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return (
      date.getDate() === today.getDate() && date.getMonth() === today.getMonth()
    );
  };

  const handleFelicitar = async (nome: string) => {
    setGerando(nome);
    try {
      const { data, error } = await supabase.functions.invoke("ai-felicitacao", {
        body: { nome, tipo: "aniversario" },
      });
      if (error) throw error;
      const mensagem = data?.mensagem;
      if (mensagem && onFelicitar) {
        onFelicitar(mensagem);
        toast.success("Mensagem gerada! Edite e publique no mural.");
      }
    } catch (err) {
      console.error("Erro ao gerar felicitação:", err);
      toast.error("Erro ao gerar mensagem. Tente novamente.");
    } finally {
      setGerando(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (aniversariantes.length === 0) {
    return null;
  }

  const mesAtual = format(new Date(), "MMMM", { locale: ptBR });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cake className="h-4 w-4 text-pink-500" />
          Aniversariantes de {mesAtual}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aniversariantes.map((pessoa, index) => {
          const isBirthdayToday = isToday(pessoa.data_nascimento);
          return (
            <div
              key={index}
              className={`flex items-center gap-3 ${
                isBirthdayToday
                  ? "bg-pink-500/10 -mx-2 px-2 py-1.5 rounded-lg"
                  : ""
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className={
                    isBirthdayToday
                      ? "bg-pink-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {getInitials(pessoa.nome_completo)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  {pessoa.nome_completo}
                  {isBirthdayToday && (
                    <PartyPopper className="h-3 w-3 text-pink-500" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isBirthdayToday
                    ? "Hoje! 🎂"
                    : formatDateBR(pessoa.data_nascimento, "dd 'de' MMMM")}
                </p>
              </div>
              {isBirthdayToday && onFelicitar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-pink-600 hover:text-pink-700 hover:bg-pink-500/10 shrink-0"
                  disabled={gerando === pessoa.nome_completo}
                  onClick={() => handleFelicitar(pessoa.nome_completo)}
                >
                  {gerando === pessoa.nome_completo ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Felicitar
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
