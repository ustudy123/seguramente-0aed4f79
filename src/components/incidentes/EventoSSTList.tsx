import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, AlertTriangle, Shield, FileText } from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  eventos: EventoSST[];
  onSelect: (e: EventoSST) => void;
  filters: {
    tipo: string;
    status: string;
    search: string;
    dataInicio?: string;
    dataFim?: string;
    unidade?: string;
    turno?: string;
  };
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  em_aberto: { label: "Em Aberto", variant: "destructive" },
  em_analise: { label: "Em Análise", variant: "secondary" },
  acoes_andamento: { label: "Ações em Andamento", variant: "default" },
  concluido: { label: "Concluído", variant: "outline" },
};

const lesaoMap: Record<string, string> = {
  sem_lesao: "Sem lesão",
  leve: "Leve",
  moderada: "Moderada",
  grave: "Grave",
};

export const EventoSSTList = ({ eventos, onSelect, filters }: Props) => {
  const filtered = eventos.filter((e) => {
    if (filters.tipo && filters.tipo !== "todos" && e.tipo !== filters.tipo) return false;
    if (filters.status && filters.status !== "todos" && e.status !== filters.status) return false;
    if (filters.unidade && filters.unidade !== "todos" && e.unidade !== filters.unidade) return false;
    if (filters.turno && filters.turno !== "todos" && e.turno !== filters.turno) return false;
    if (filters.dataInicio && e.data_evento < filters.dataInicio) return false;
    if (filters.dataFim && e.data_evento > filters.dataFim) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      return (
        (e.codigo || "").toLowerCase().includes(s) ||
        (e.colaborador_nome || "").toLowerCase().includes(s) ||
        (e.setor || "").toLowerCase().includes(s) ||
        (e.descricao || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum evento encontrado.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Gravidade</TableHead>
            <TableHead>Unidade / Setor</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Indicadores</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((e) => {
            const st = statusMap[e.status] || statusMap.em_aberto;
            return (
              <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(e)}>
                <TableCell className="font-mono text-xs">{e.codigo}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(e.data_evento), "dd/MM/yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {e.tipo === "acidente" ? (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Acidente
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Incidente
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {e.tipo === "acidente" && e.gravidade_lesao
                    ? lesaoMap[e.gravidade_lesao] || "-"
                    : "-"}
                </TableCell>
                <TableCell className="text-sm">
                  {[e.unidade, e.setor].filter(Boolean).join(" / ") || "-"}
                </TableCell>
                <TableCell className="text-sm">{e.colaborador_funcao || "-"}</TableCell>
                <TableCell className="text-sm">{e.turno || "-"}</TableCell>
                <TableCell>
                  <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-1 justify-center">
                    {e.status === "acoes_andamento" && (
                      <span title="Ação vinculada" className="text-primary">✅</span>
                    )}
                    {e.tipo === "acidente" && e.cat_emitida && (
                      <span title="CAT anexada"><FileText className="w-4 h-4 text-success" /></span>
                    )}
                    {e.tipo === "acidente" && !e.cat_emitida && (
                      <span title="CAT pendente"><FileText className="w-4 h-4 text-destructive" /></span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); onSelect(e); }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
