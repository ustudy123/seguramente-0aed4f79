import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Award, Star, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTempoEmpresa } from "@/hooks/useFeed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TempoEmpresaWidgetProps {
  onFelicitar?: (mensagem: string) => void;
}

export function TempoEmpresaWidget({ onFelicitar }: TempoEmpresaWidgetProps) {
  const { data: colaboradores = [], isLoading } = useTempoEmpresa();
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

  const handleFelicitar = async (nome: string, anos: number) => {
    setGerando(nome);
    try {
      const { data, error } = await supabase.functions.invoke("ai-felicitacao", {
        body: { nome, tipo: "tempo_casa", anos },
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
          {[1, 2].map((i) => (
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

  if (colaboradores.length === 0) {
    return null;
  }

  const mesAtual = format(new Date(), "MMMM", { locale: ptBR });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-blue-500" />
          Tempo de Casa - {mesAtual}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {colaboradores.map((pessoa, index) => {
          const isAnniversaryToday = isToday(pessoa.data_admissao);
          return (
            <div
              key={index}
              className={`flex items-center gap-3 ${
                isAnniversaryToday
                  ? "bg-blue-500/10 -mx-2 px-2 py-1.5 rounded-lg"
                  : ""
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className={
                    isAnniversaryToday
                      ? "bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {getInitials(pessoa.nome_completo)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  {pessoa.nome_completo}
                  {isAnniversaryToday && (
                    <Star className="h-3 w-3 text-blue-500 fill-blue-500" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pessoa.anos_empresa} ano{pessoa.anos_empresa > 1 ? "s" : ""}{" "}
                  {isAnniversaryToday
                    ? "hoje! 🎉"
                    : `em ${format(
                        new Date(pessoa.data_admissao),
                        "dd 'de' MMMM",
                        { locale: ptBR }
                      )}`}
                </p>
              </div>
              {isAnniversaryToday && onFelicitar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 shrink-0"
                  disabled={gerando === pessoa.nome_completo}
                  onClick={() => handleFelicitar(pessoa.nome_completo, pessoa.anos_empresa)}
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
