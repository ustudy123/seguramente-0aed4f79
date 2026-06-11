import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Clock, XCircle, FileText, GraduationCap } from "lucide-react";
import { differenceInDays } from "date-fns";
import { formatDateBR } from "@/lib/dataLocal";

interface VencimentoItem {
  id: string;
  tipo_item: "documento" | "treinamento";
  tipo: string;
  nome: string;
  terceiro_nome: string;
  trabalhador_nome: string | null;
  data_validade: string;
  status: string;
  dias_restantes: number;
}

export function VencimentosPanel() {
  const { tenantId } = useAuth();

  const { data: vencimentos = [], isLoading } = useQuery({
    queryKey: ["terceiro-vencimentos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Fetch docs with validade
      const { data: docs } = await fromTable("terceiro_documentos")
        .select("id, tipo, nome, data_validade, status, terceiro_id, trabalhador_id")
        .eq("tenant_id", tenantId)
        .not("data_validade", "is", null)
        .order("data_validade");

      // Fetch treinamentos with validade
      const { data: treins } = await fromTable("terceiro_treinamentos")
        .select("id, tipo, descricao, data_validade, status, terceiro_id, trabalhador_id")
        .eq("tenant_id", tenantId)
        .not("data_validade", "is", null)
        .order("data_validade");

      // Fetch terceiro names
      const { data: terceiros } = await fromTable("terceiros")
        .select("id, razao_social")
        .eq("tenant_id", tenantId);

      // Fetch trabalhador names
      const { data: trabalhadores } = await fromTable("terceiro_trabalhadores")
        .select("id, nome")
        .eq("tenant_id", tenantId);

      const terceiroMap = new Map((terceiros as any[] || []).map((t: any) => [t.id, t.razao_social]));
      const trabMap = new Map((trabalhadores as any[] || []).map((t: any) => [t.id, t.nome]));
      const today = new Date();

      const items: VencimentoItem[] = [];

      for (const d of (docs as any[] || [])) {
        const dias = differenceInDays(new Date(d.data_validade), today);
        if (dias <= 60) {
          items.push({
            id: d.id,
            tipo_item: "documento",
            tipo: d.tipo,
            nome: d.nome,
            terceiro_nome: terceiroMap.get(d.terceiro_id) || "—",
            trabalhador_nome: d.trabalhador_id ? trabMap.get(d.trabalhador_id) || null : null,
            data_validade: d.data_validade,
            status: d.status,
            dias_restantes: dias,
          });
        }
      }

      for (const t of (treins as any[] || [])) {
        const dias = differenceInDays(new Date(t.data_validade), today);
        if (dias <= 60) {
          items.push({
            id: t.id,
            tipo_item: "treinamento",
            tipo: t.tipo,
            nome: t.descricao || t.tipo,
            terceiro_nome: terceiroMap.get(t.terceiro_id) || "—",
            trabalhador_nome: t.trabalhador_id ? trabMap.get(t.trabalhador_id) || null : null,
            data_validade: t.data_validade,
            status: t.status,
            dias_restantes: dias,
          });
        }
      }

      items.sort((a, b) => a.dias_restantes - b.dias_restantes);
      return items;
    },
    enabled: !!tenantId,
  });

  const vencidos = vencimentos.filter((v) => v.dias_restantes < 0);
  const ate30 = vencimentos.filter((v) => v.dias_restantes >= 0 && v.dias_restantes <= 30);
  const ate60 = vencimentos.filter((v) => v.dias_restantes > 30 && v.dias_restantes <= 60);

  if (isLoading) return <p className="text-center text-muted-foreground py-8">Carregando vencimentos...</p>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{vencidos.length}</p>
              <p className="text-xs text-muted-foreground">Vencidos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-300/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">{ate30.length}</p>
              <p className="text-xs text-muted-foreground">Vence em até 30 dias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-6 h-6 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{ate60.length}</p>
              <p className="text-xs text-muted-foreground">Vence em 31–60 dias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {vencimentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Nenhum vencimento nos próximos 60 dias. 🎉</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos e Treinamentos com Vencimento Próximo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Terceiro</TableHead>
                  <TableHead>Trabalhador</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Urgência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vencimentos.map((v) => (
                  <TableRow key={`${v.tipo_item}-${v.id}`} className={v.dias_restantes < 0 ? "bg-destructive/5" : ""}>
                    <TableCell>
                      {v.tipo_item === "documento" ? (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <GraduationCap className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{v.tipo}</TableCell>
                    <TableCell className="text-sm">{v.terceiro_nome}</TableCell>
                    <TableCell className="text-sm">{v.trabalhador_nome || "Empresa"}</TableCell>
                    <TableCell className="text-sm">
                      {formatDateBR(v.data_validade, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {v.dias_restantes < 0 ? `${Math.abs(v.dias_restantes)}d atrás` : `${v.dias_restantes}d`}
                    </TableCell>
                    <TableCell>
                      {v.dias_restantes < 0 ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : v.dias_restantes <= 30 ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Urgente</Badge>
                      ) : (
                        <Badge variant="outline">Atenção</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
