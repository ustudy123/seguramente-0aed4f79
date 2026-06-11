import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, ClipboardCheck, Shield, ShieldAlert, XCircle, Clock,
  CheckCircle, AlertTriangle, Users, ChevronDown, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { usePermissaoTrabalho, PermissaoTrabalho, PermissaoTrabalhador } from "@/hooks/usePermissaoTrabalho";
import { useTerceiros } from "@/hooks/useTerceiros";
import { PermissaoTrabalhoForm } from "./PermissaoTrabalhoForm";
import type { Terceiro } from "@/types/terceiros";
import { formatDateBR } from "@/lib/dataLocal";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground", icon: Clock },
  liberada: { label: "Liberada", color: "bg-green-100 text-green-800", icon: CheckCircle },
  bloqueada: { label: "Bloqueada", color: "bg-red-100 text-red-800", icon: ShieldAlert },
  encerrada: { label: "Encerrada", color: "bg-blue-100 text-blue-800", icon: Shield },
  cancelada: { label: "Cancelada", color: "bg-muted text-muted-foreground line-through", icon: XCircle },
};

export function PermissaoTrabalhoPanel() {
  const { terceiros } = useTerceiros();
  const { permissoes, createPermissao, encerrarPermissao, cancelarPermissao } = usePermissaoTrabalho();
  const [showForm, setShowForm] = useState(false);
  const [selectedTerceiro, setSelectedTerceiro] = useState<Terceiro | null>(null);
  const [expandedPt, setExpandedPt] = useState<string | null>(null);

  const pts = permissoes.data || [];
  const terceiroMap = new Map(terceiros.map((t) => [t.id, t]));

  // Stats
  const liberadas = pts.filter((p) => p.status === "liberada").length;
  const bloqueadas = pts.filter((p) => p.status === "bloqueada").length;
  const ativas = pts.filter((p) => ["liberada", "bloqueada", "rascunho"].includes(p.status)).length;

  const handleOpenForm = () => {
    if (terceiros.length === 0) return;
    setSelectedTerceiro(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            <div>
              <p className="text-2xl font-bold">{ativas}</p>
              <p className="text-xs text-muted-foreground">PTs Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{liberadas}</p>
              <p className="text-xs text-muted-foreground">Liberadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{bloqueadas}</p>
              <p className="text-xs text-muted-foreground">Bloqueadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <Button onClick={handleOpenForm}>
          <Plus className="w-4 h-4 mr-2" /> Nova PT
        </Button>
      </div>

      {/* PT List */}
      {pts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Nenhuma Permissão de Trabalho criada.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissões de Trabalho</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Terceiro</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pts.map((pt) => {
                  const cfg = statusConfig[pt.status] || statusConfig.rascunho;
                  const isExpanded = expandedPt === pt.id;
                  return (
                    <>
                      <TableRow
                        key={pt.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedPt(isExpanded ? null : pt.id)}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">{pt.codigo}</TableCell>
                        <TableCell className="text-sm">{terceiroMap.get(pt.terceiro_id)?.razao_social || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{pt.atividade}</TableCell>
                        <TableCell className="text-sm">{pt.local}</TableCell>
                        <TableCell className="text-sm text-nowrap">
                          {formatDateBR(pt.data_inicio, "dd/MM")} – {formatDateBR(pt.data_fim, "dd/MM/yy")}
                        </TableCell>
                        <TableCell>
                          <Badge className={cfg.color}>
                            <cfg.icon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {pt.status === "liberada" && (
                              <Button size="sm" variant="outline" onClick={() => encerrarPermissao.mutate(pt.id)}>
                                Encerrar
                              </Button>
                            )}
                            {["rascunho", "bloqueada"].includes(pt.status) && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelarPermissao.mutate(pt.id)}>
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${pt.id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <PTDetail pt={pt} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Select terceiro then open form */}
      {showForm && !selectedTerceiro && (
        <SelectTerceiroDialog
          open={showForm && !selectedTerceiro}
          onOpenChange={(o) => { if (!o) setShowForm(false); }}
          terceiros={terceiros}
          onSelect={(t) => setSelectedTerceiro(t)}
        />
      )}

      {showForm && selectedTerceiro && (
        <PTFormWrapper
          terceiro={selectedTerceiro}
          onClose={() => { setShowForm(false); setSelectedTerceiro(null); }}
          onSubmit={async (data) => { await createPermissao.mutateAsync(data); }}
          isPending={createPermissao.isPending}
        />
      )}
    </div>
  );
}

// ── Sub-components ──

function PTDetail({ pt }: { pt: PermissaoTrabalho }) {
  const { useTrabalhadoresPT } = usePermissaoTrabalho();
  const { data: trabalhadores = [] } = useTrabalhadoresPT(pt.id);

  return (
    <div className="p-4 space-y-3">
      {pt.motivo_bloqueio && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 p-2 rounded">
          <AlertTriangle className="w-4 h-4" />
          <span>{pt.motivo_bloqueio}</span>
        </div>
      )}

      {pt.atividades_risco.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pt.atividades_risco.map((r) => (
            <Badge key={r} variant="destructive" className="text-xs">{r}</Badge>
          ))}
        </div>
      )}

      {pt.descricao && <p className="text-sm text-muted-foreground">{pt.descricao}</p>}

      <div>
        <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
          <Users className="w-4 h-4" /> Trabalhadores ({trabalhadores.length})
        </h4>
        {trabalhadores.length > 0 ? (
          <div className="grid gap-2">
            {trabalhadores.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 p-2 rounded border text-sm ${
                  t.apto ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="flex-1">
                  <span className="font-medium">{t.trabalhador_nome}</span>
                  {t.trabalhador_funcao && (
                    <span className="text-muted-foreground ml-2">({t.trabalhador_funcao})</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={t.docs_ok ? "text-green-700" : "text-red-700"}>
                    Docs {t.docs_ok ? "✓" : "✗"}
                  </Badge>
                  <Badge variant="outline" className={t.treins_ok ? "text-green-700" : "text-red-700"}>
                    Trein {t.treins_ok ? "✓" : "✗"}
                  </Badge>
                  <Badge variant="outline" className={t.aso_ok ? "text-green-700" : "text-red-700"}>
                    ASO {t.aso_ok ? "✓" : "✗"}
                  </Badge>
                </div>
                {t.apto ? (
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum trabalhador vinculado.</p>
        )}
      </div>

      {pt.liberado_por_nome && (
        <p className="text-xs text-muted-foreground">
          Liberada por {pt.liberado_por_nome} em {pt.liberado_em ? format(new Date(pt.liberado_em), "dd/MM/yyyy HH:mm") : "—"}
        </p>
      )}
      {pt.encerrado_por_nome && (
        <p className="text-xs text-muted-foreground">
          Encerrada por {pt.encerrado_por_nome} em {pt.encerrado_em ? format(new Date(pt.encerrado_em), "dd/MM/yyyy HH:mm") : "—"}
        </p>
      )}
    </div>
  );
}

function SelectTerceiroDialog({
  open, onOpenChange, terceiros, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  terceiros: Terceiro[];
  onSelect: (t: Terceiro) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Terceiro</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {terceiros.map((t) => (
            <button
              key={t.id}
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(t)}
            >
              <p className="font-medium text-sm">{t.razao_social}</p>
              <p className="text-xs text-muted-foreground">{t.cnpj}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PTFormWrapper({
  terceiro, onClose, onSubmit, isPending,
}: {
  terceiro: Terceiro;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isPending: boolean;
}) {
  const { useTrabalhadores } = useTerceiros();
  const { data: trabalhadores = [] } = useTrabalhadores(terceiro.id);

  return (
    <PermissaoTrabalhoForm
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      terceiroId={terceiro.id}
      trabalhadores={trabalhadores}
      onSubmit={onSubmit}
      isPending={isPending}
    />
  );
}

export type { Terceiro };
