import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Globe, Mail, User, Brain, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function LandingLeadsTable() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["landing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = leads?.length || 0;
  const comDiagnostico = leads?.filter((l: any) => l.pontuacao_diagnostico != null).length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Leads da Landing Page</CardTitle>
          <Badge variant="outline" className="ml-2">{total} leads</Badge>
          {comDiagnostico > 0 && (
            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 ml-1">
              <Brain className="w-3 h-3 mr-1" />
              {comDiagnostico} com diagnóstico
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : total === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhum lead capturado ainda</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Pontuação</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.map((lead: any) => {
                const nivel = lead.diagnostico_resultado?.nivel;
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {lead.nome}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {lead.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        <Globe className="w-3 h-3 mr-1" />
                        Landing Page
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {nivel ? (
                        <Badge className={
                          nivel === "critico" ? "bg-destructive/10 text-destructive border-destructive/20" :
                          nivel === "atencao" ? "bg-warning/10 text-warning border-warning/20" :
                          "bg-success/10 text-success border-success/20"
                        }>
                          {nivel === "critico" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {nivel === "atencao" && <Clock className="w-3 h-3 mr-1" />}
                          {nivel === "adequado" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {nivel === "critico" ? "Crítico" : nivel === "atencao" ? "Atenção" : "Adequado"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não fez</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.pontuacao_diagnostico != null ? (
                        <span className="text-sm font-mono">{lead.pontuacao_diagnostico} pts</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
