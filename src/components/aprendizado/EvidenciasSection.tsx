import { FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAprendizado } from "@/hooks/useAprendizado";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EvidenciasSectionProps {
  cargoId: string;
}

export function EvidenciasSection({ cargoId }: EvidenciasSectionProps) {
  const { evidencias } = useAprendizado(cargoId);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <FileText className="w-5 h-5" /> Evidências de Treinamento ({evidencias.length})
      </h3>

      {evidencias.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma evidência de treinamento registrada para esta função.
        </div>
      ) : (
        <div className="space-y-2">
          {evidencias.map((ev) => (
            <Card key={ev.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {ev.aprovado ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : ev.data_conclusao ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{ev.colaborador_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ev.data_acesso), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {ev.nota !== null && ` · Nota: ${ev.nota}%`}
                      {` · Tentativa ${ev.tentativa}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ev.aprovado ? "default" : "destructive"} className="text-xs">
                    {ev.aprovado ? "Aprovado" : ev.data_conclusao ? "Reprovado" : "Em andamento"}
                  </Badge>
                  {ev.aceite_eletronico && (
                    <Badge variant="outline" className="text-xs">Aceite ✓</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
