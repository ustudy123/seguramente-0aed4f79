import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePontoAlertas, ALERTA_TIPOS } from "@/hooks/usePontoAlertas";
import { Bell, CheckCircle, AlertTriangle, AlertOctagon, Info, Sparkles } from "lucide-react";
import { CriarAcaoAlertaModal } from "@/components/shared/CriarAcaoAlertaModal";

const SEVERIDADE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  baixa: { label: "Baixa", color: "bg-blue-100 text-blue-800", icon: <Info className="w-4 h-4" /> },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="w-4 h-4" /> },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-800", icon: <AlertTriangle className="w-4 h-4" /> },
  critica: { label: "Crítica", color: "bg-red-100 text-red-800", icon: <AlertOctagon className="w-4 h-4" /> },
};

export function PontoAlertasTab() {
  const { alertas, loadingAlertas, resolverAlerta } = usePontoAlertas();
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [acaoModal, setAcaoModal] = useState<{ open: boolean; titulo: string; descricao: string; id?: string }>({ open: false, titulo: "", descricao: "" });

  const alertasFiltrados = filtroTipo === "all" ? alertas : alertas.filter(a => a.tipo === filtroTipo);

  const contagem = {
    total: alertas.length,
    critica: alertas.filter(a => a.severidade === "critica").length,
    alta: alertas.filter(a => a.severidade === "alta").length,
    media: alertas.filter(a => a.severidade === "media").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Alertas Operacionais
          </h3>
          <p className="text-sm text-muted-foreground">Riscos trabalhistas e alertas de conformidade</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{contagem.total}</p>
            <p className="text-sm text-muted-foreground">Total Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{contagem.critica}</p>
            <p className="text-sm text-muted-foreground">Críticos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-600">{contagem.alta}</p>
            <p className="text-sm text-muted-foreground">Alta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{contagem.media}</p>
            <p className="text-sm text-muted-foreground">Média</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={filtroTipo === "all" ? "default" : "outline"} size="sm" onClick={() => setFiltroTipo("all")}>Todos</Button>
        {Object.entries(ALERTA_TIPOS).map(([key, val]) => (
          <Button key={key} variant={filtroTipo === key ? "default" : "outline"} size="sm" onClick={() => setFiltroTipo(key)}>
            {val.icon} {val.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severidade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAlertas ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : alertasFiltrados.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {alertas.length === 0 ? "Nenhum alerta ativo. ✅" : "Nenhum alerta para este filtro."}
                </TableCell></TableRow>
              ) : alertasFiltrados.map(a => {
                const sev = SEVERIDADE_CONFIG[a.severidade] || SEVERIDADE_CONFIG.media;
                const tipo = ALERTA_TIPOS[a.tipo as keyof typeof ALERTA_TIPOS];
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge className={sev.color}>{sev.icon} {sev.label}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{tipo?.label || a.tipo}</Badge></TableCell>
                    <TableCell>{a.colaborador_nome || "Geral"}</TableCell>
                    <TableCell className="font-medium">{a.titulo}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.descricao || "-"}</TableCell>
                    <TableCell>{a.data_referencia || "-"}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => resolverAlerta(a.id)}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Resolver
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        onClick={() => setAcaoModal({ open: true, titulo: a.titulo, descricao: a.descricao || `${a.colaborador_nome || "Geral"} - ${a.titulo}`, id: a.id })}
                      >
                        <Sparkles className="w-3 h-3 mr-1" /> Ação
                      </Button>
                    </TableCell>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CriarAcaoAlertaModal
        open={acaoModal.open}
        onOpenChange={(open) => setAcaoModal(prev => ({ ...prev, open }))}
        alertaTitulo={acaoModal.titulo}
        alertaDescricao={acaoModal.descricao}
        origemModulo="ponto"
        origemId={acaoModal.id}
      />
    </div>
  );
}
