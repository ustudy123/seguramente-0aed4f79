import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Award, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTempoEmpresa } from "@/hooks/useFeed";

export function TempoEmpresaWidget() {
  const { data: colaboradores = [], isLoading } = useTempoEmpresa();

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
                  ? "bg-blue-500/10 -mx-2 px-2 py-1 rounded-lg"
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
