import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cake, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAniversariantes } from "@/hooks/useFeed";

export function AniversariantesWidget() {
  const { data: aniversariantes = [], isLoading } = useAniversariantes();

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
                isBirthdayToday ? "bg-pink-500/10 -mx-2 px-2 py-1 rounded-lg" : ""
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
                    : format(new Date(pessoa.data_nascimento), "dd 'de' MMMM", {
                        locale: ptBR,
                      })}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
