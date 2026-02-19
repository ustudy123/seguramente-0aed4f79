import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Filter, Download } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props { hub: any; }

const acaoLabels: Record<string, string> = {
  enviado: "Enviado", recebido: "Recebido", substituido: "Substituído",
  aprovado: "Aprovado", rejeitado: "Rejeitado", reaberto: "Reaberto",
  criado: "Criado", atualizado: "Atualizado", pago: "Pago", vencido: "Vencido",
};

const acaoColors: Record<string, string> = {
  enviado: "bg-blue-100 text-blue-800", recebido: "bg-green-100 text-green-800",
  substituido: "bg-orange-100 text-orange-800", aprovado: "bg-emerald-100 text-emerald-800",
  rejeitado: "bg-red-100 text-red-800", reaberto: "bg-amber-100 text-amber-800",
  criado: "bg-violet-100 text-violet-800", atualizado: "bg-cyan-100 text-cyan-800",
  pago: "bg-green-100 text-green-800", vencido: "bg-red-100 text-red-800",
};

const perfilLabels: Record<string, string> = {
  rh: "RH", contador: "Contador", financeiro: "Financeiro", admin: "Admin", sistema: "Sistema",
};

export function HubHistorico({ hub }: Props) {
  const { historico, loading } = hub;
  const [filtroAcao, setFiltroAcao] = useState("todos");
  const [filtroCompetencia, setFiltroCompetencia] = useState("");

  const filtered = historico.filter((h: any) => {
    if (filtroAcao !== "todos" && h.acao !== filtroAcao) return false;
    if (filtroCompetencia && h.competencia !== filtroCompetencia) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><History className="w-5 h-5" /> Histórico de Movimentações</h2>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <span className="text-xs text-muted-foreground">Ação</span>
          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {Object.entries(acaoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Competência</span>
          <Input type="month" value={filtroCompetencia} onChange={(e) => setFiltroCompetencia(e.target.value)} className="w-[160px]" />
        </div>
        {(filtroAcao !== "todos" || filtroCompetencia) && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltroAcao("todos"); setFiltroCompetencia(""); }}>Limpar</Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum registro encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((h: any) => (
            <Card key={h.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={acaoColors[h.acao] || "bg-gray-100 text-gray-800"}>{acaoLabels[h.acao] || h.acao}</Badge>
                    {h.competencia && <Badge variant="outline" className="text-xs">{h.competencia}</Badge>}
                    {h.tipo_documento && <span className="text-xs text-muted-foreground">{h.tipo_documento}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.descricao}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium">{h.usuario_nome || "Sistema"}</p>
                  {h.perfil && <Badge variant="secondary" className="text-[10px]">{perfilLabels[h.perfil] || h.perfil}</Badge>}
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(h.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
