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
                <TableHead>Lead</TableHead>
                <TableHead>Empresa / Setor</TableHead>
                <TableHead>Funcionários</TableHead>
                <TableHead>Origem LP</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.map((lead: any) => {
                const perfil = lead.perfil_diagnostico || lead.diagnostico_resultado?.perfil;
                const origem = lead.landing_page_origem || lead.diagnostico_resultado?.origem_landing || "—";
                const dor = lead.diagnostico_resultado?.respostas?.dor_principal;
                const perfilCfg: Record<string, { l: string; cls: string }> = {
                  critico:     { l: "Crítico",     cls: "bg-destructive/10 text-destructive border-destructive/20" },
                  quente:      { l: "Prioritário", cls: "bg-warning/10 text-warning border-warning/20" },
                  qualificado: { l: "Qualificado", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
                  explorador:  { l: "Explorador",  cls: "bg-success/10 text-success border-success/20" },
                };
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div>{lead.nome}</div>
                          {lead.cargo && <div className="text-xs text-muted-foreground">{lead.cargo}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{lead.empresa || "—"}</div>
                      {lead.setor && <div className="text-xs text-muted-foreground">{lead.setor}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{lead.num_funcionarios || "—"}</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        <Globe className="w-3 h-3 mr-1" />{origem}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {perfil && perfilCfg[perfil] ? (
                        <Badge className={perfilCfg[perfil].cls}>
                          {perfil === "critico" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {perfil === "quente" && <Clock className="w-3 h-3 mr-1" />}
                          {perfil === "explorador" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {perfilCfg[perfil].l}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {lead.pontuacao_diagnostico != null ? (
                        <span className="text-sm font-mono font-bold">{lead.pontuacao_diagnostico}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{lead.urgencia || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</div>
                        {lead.telefone && <div className="text-muted-foreground">{lead.telefone}</div>}
                        {dor && <div className="text-muted-foreground italic">Dor: {dor}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(lead.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
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
