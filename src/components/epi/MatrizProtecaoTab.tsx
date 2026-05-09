import { useMemo, useState } from "react";
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle, Search, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MatrizEpiConfig } from "./MatrizEpiConfig";
import { useMatrizEpi } from "@/hooks/useMatrizEpi";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useCargos } from "@/hooks/useCadastros";
import { useEpis } from "@/hooks/useEpis";
import { CriarAcaoAlertaModal } from "@/components/shared/CriarAcaoAlertaModal";

export function MatrizProtecaoTab() {
  const { cets, funcaoEpis, funcaoCets, salvarMatrizFuncao, salvandoMatriz } = useMatrizEpi();
  const { colaboradores } = useColaboradores();
  const { cargos } = useCargos();
  const { tipos, entregas } = useEpis();
  const [search, setSearch] = useState("");
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const [acaoModal, setAcaoModal] = useState<{ open: boolean; titulo: string; descricao: string }>({ open: false, titulo: "", descricao: "" });

  const selectedCargo = cargos.find((c) => c.id === selectedCargoId) || null;

  // Build protection analysis per collaborator
  const analise = useMemo(() => {
    return colaboradores.map((colab) => {
      // Find cargo by name match
      const cargo = cargos.find((c) => c.nome === colab.cargo);
      const cargoId = cargo?.id;

      // EPIs exigidos for this função
      const episExigidos = cargoId
        ? funcaoEpis.filter((fe) => fe.cargo_id === cargoId)
        : [];

      // EPIs entregues ativos for this collaborator
      const entregasAtivas = entregas.filter(
        (e) => e.colaborador_cpf === colab.cpf && e.status === "ativa"
      );

      // Map of tipo_id delivered
      const tiposEntregues = new Set<string>();
      entregasAtivas.forEach((e) => {
        const epi = e.epi as any;
        if (epi?.tipo_id) tiposEntregues.add(epi.tipo_id);
      });

      const obrigatorios = episExigidos.filter((e) => e.obrigatorio);
      const obrigatoriosCobertos = obrigatorios.filter((e) => tiposEntregues.has(e.epi_tipo_id));

      const alertas: string[] = [];
      obrigatorios.forEach((e) => {
        if (!tiposEntregues.has(e.epi_tipo_id)) {
          const tipo = tipos.find((t) => t.id === e.epi_tipo_id);
          alertas.push(`EPI obrigatório não entregue: ${tipo?.nome || "Desconhecido"}`);
        }
      });

      // Check expired deliveries
      entregasAtivas.forEach((e) => {
        const entrega = e as any;
        if (entrega.data_validade && new Date(entrega.data_validade) < new Date()) {
          const epi = entrega.epi as any;
          alertas.push(`EPI vencido: ${epi?.tipo?.nome || "Desconhecido"}`);
        }
      });

      const cetsColab = cargoId
        ? funcaoCets.filter((fc) => fc.cargo_id === cargoId).map((fc) => fc.cet?.nome || "")
        : [];

      const conformidade =
        obrigatorios.length > 0
          ? Math.round((obrigatoriosCobertos.length / obrigatorios.length) * 100)
          : cargoId
          ? 100
          : -1; // -1 = no function linked

      return {
        id: colab.id,
        nome: colab.nome_completo,
        cargo: colab.cargo,
        cargoId,
        totalExigidos: obrigatorios.length,
        totalEntregues: obrigatoriosCobertos.length,
        conformidade,
        alertas,
        cets: cetsColab,
      };
    });
  }, [colaboradores, cargos, funcaoEpis, funcaoCets, entregas, tipos]);

  const filtered = analise.filter(
    (a) =>
      a.nome.toLowerCase().includes(search.toLowerCase()) ||
      a.cargo.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalColab = analise.length;
  const conformes = analise.filter((a) => a.conformidade === 100).length;
  const comAlertas = analise.filter((a) => a.alertas.length > 0).length;
  const semFuncao = analise.filter((a) => a.conformidade === -1).length;

  // Cargos with matrix configured
  const cargosComMatriz = cargos.filter((c) =>
    funcaoEpis.some((fe) => fe.cargo_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" />
            Colaboradores
          </div>
          <div className="text-2xl font-bold">{totalColab}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            Conformes
          </div>
          <div className="text-2xl font-bold text-green-600">{conformes}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm text-destructive mb-1">
            <AlertTriangle className="w-4 h-4" />
            Com Alertas
          </div>
          <div className="text-2xl font-bold text-destructive">{comAlertas}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ShieldAlert className="w-4 h-4" />
            Sem Função Vinculada
          </div>
          <div className="text-2xl font-bold">{semFuncao}</div>
        </div>
      </div>

      {/* Configured Functions */}
      {cargosComMatriz.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Matrizes configuradas:</span>
          {cargosComMatriz.map((c) => {
            const qtd = funcaoEpis.filter((fe) => fe.cargo_id === c.id).length;
            return (
              <Badge
                key={c.id}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => setSelectedCargoId(c.id)}
              >
                <ShieldCheck className="w-3 h-3 mr-1" />
                {c.nome} ({qtd} EPIs)
              </Badge>
            );
          })}
        </div>
      )}

      {/* Configure button for functions without matrix */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador ou função..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            // Show a cargo picker — use first cargo without matrix or first cargo
            const semMatriz = cargos.find((c) => !funcaoEpis.some((fe) => fe.cargo_id === c.id));
            if (semMatriz) setSelectedCargoId(semMatriz.id);
            else if (cargos.length > 0) setSelectedCargoId(cargos[0].id);
          }}
        >
          <Shield className="w-4 h-4 mr-2" />
          Configurar Matriz
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>CETs</TableHead>
              <TableHead className="text-center">Proteção</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Shield className="w-8 h-8" />
                    <p>Nenhum colaborador encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{item.cargo}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.cets.length > 0 ? (
                        item.cets.slice(0, 2).map((cet, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {cet}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {item.cets.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.cets.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.conformidade === -1 ? (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    ) : (
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress
                          value={item.conformidade}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs font-medium w-8 text-right">
                          {item.conformidade}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.conformidade === -1 ? (
                      <Badge variant="secondary" className="text-xs">Sem função</Badge>
                    ) : item.alertas.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {item.alertas.length} alerta{item.alertas.length > 1 ? "s" : ""}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <ul className="text-xs space-y-1">
                            {item.alertas.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Conforme
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex gap-1 justify-end">
                    {item.alertas.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary"
                        onClick={() => setAcaoModal({
                          open: true,
                          titulo: `Não conformidade EPI — ${item.nome}`,
                          descricao: item.alertas.join("; "),
                        })}
                      >
                        <Sparkles className="w-3 h-3 mr-1" /> Ação
                      </Button>
                    )}
                    {item.cargoId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCargoId(item.cargoId!)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Config Modal */}
      <MatrizEpiConfig
        open={!!selectedCargoId}
        onOpenChange={(open) => {
          if (!open) setSelectedCargoId(null);
        }}
        cargo={selectedCargo}
        epiTipos={tipos}
        cets={cets}
        funcaoEpis={funcaoEpis}
        funcaoCets={funcaoCets}
        onSave={salvarMatrizFuncao}
        isSaving={salvandoMatriz}
      />

      <CriarAcaoAlertaModal
        open={acaoModal.open}
        onOpenChange={(open) => setAcaoModal(prev => ({ ...prev, open }))}
        alertaTitulo={acaoModal.titulo}
        alertaDescricao={acaoModal.descricao}
        origemModulo="epi"
      />
    </div>
  );
}
