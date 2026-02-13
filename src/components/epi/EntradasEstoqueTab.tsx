import { useState } from "react";
import { motion } from "framer-motion";
import { PackagePlus, PackageMinus, Search, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Calendar, MapPin, Package, FileText } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEpis } from "@/hooks/useEpis";
import { useEpiLocais } from "@/hooks/useEpiLocais";
import { useEntradaEstoque } from "@/hooks/useEntradaEstoque";
import { useTransferenciaEstoque } from "@/hooks/useTransferenciaEstoque";
import { useSaidaEstoque } from "@/hooks/useSaidaEstoque";
import { useImportacaoNF } from "@/hooks/useImportacaoNF";
import { EntradaEstoqueForm } from "./EntradaEstoqueForm";
import { SUBTIPOS_ENTRADA } from "./EntradaEstoqueForm";
import { TransferenciaEstoqueForm } from "./TransferenciaEstoqueForm";
import { SaidaEstoqueForm, SUBTIPOS_SAIDA } from "./SaidaEstoqueForm";
import { ImportacaoNFForm } from "./ImportacaoNFForm";

const SUBTIPO_LABELS: Record<string, string> = {
  inventario_inicial: "Inventário Inicial",
  ajuste: "Ajuste",
  doacao: "Doação",
  compra: "Compra",
  descarte: "Descarte",
  perda: "Perda/Extravio",
  dano: "Dano/Avaria",
  vencimento: "Vencimento",
  correcao: "Correção",
  outro: "Outro",
  transferencia: "Transferência",
};

export function EntradasEstoqueTab() {
  const { epis, episLoading, movimentacoes, movimentacoesLoading } = useEpis();
  const { locais, locaisAtivos } = useEpiLocais();
  const { registrarEntrada, registrando } = useEntradaEstoque();
  const { transferir, transferindo } = useTransferenciaEstoque();
  const { registrarSaida, registrandoSaida } = useSaidaEstoque();
  const { importarNF, importando } = useImportacaoNF();

  const [showForm, setShowForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showSaidaForm, setShowSaidaForm] = useState(false);
  const [showNFForm, setShowNFForm] = useState(false);
  const [search, setSearch] = useState("");

  // Filter movimentacoes to show only manual entries (entrada type with subtipo)
  const entradas = movimentacoes.filter((m) => {
    const isEntrada = m.tipo === "entrada";
    if (!isEntrada) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (m as any).epi?.tipo?.nome?.toLowerCase().includes(s) ||
        m.motivo?.toLowerCase().includes(s) ||
        m.realizado_por_nome?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const getLocalNome = (localId: string | null) => {
    if (!localId) return "—";
    const local = locais.find((l) => l.id === localId);
    return local?.nome || "—";
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowDownCircle className="w-5 h-5 text-primary" />
                  Entradas de Estoque
                </CardTitle>
                <CardDescription>
                  Registre entradas manuais: inventário inicial, ajustes, doações e compras sem nota
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNFForm(true)}>
                  <FileText className="w-4 h-4 mr-2" />
                  Importar NF
                </Button>
                <Button variant="outline" onClick={() => setShowSaidaForm(true)}>
                  <PackageMinus className="w-4 h-4 mr-2" />
                  Saída
                </Button>
                <Button variant="outline" onClick={() => setShowTransferForm(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transferir
                </Button>
                <Button onClick={() => setShowForm(true)}>
                  <PackagePlus className="w-4 h-4 mr-2" />
                  Nova Entrada
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              {SUBTIPOS_ENTRADA.map((s) => {
                const count = movimentacoes.filter(
                  (m) => m.tipo === "entrada" && (m as any).subtipo === s.value
                ).length;
                return (
                  <div key={s.value} className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative max-w-sm mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar entrada..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Table */}
            {movimentacoesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : entradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Nenhuma entrada de estoque registrada</p>
                <p className="text-sm">Registre a primeira entrada para começar o controle de saldo.</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
                  <PackagePlus className="w-4 h-4 mr-2" />
                  Registrar Entrada
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>EPI</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradas.map((entrada) => (
                      <TableRow key={entrada.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            {format(new Date(entrada.created_at), "dd/MM/yyyy HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {(entrada as any).epi?.tipo?.nome || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            {getLocalNome((entrada as any).local_estoque_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {SUBTIPO_LABELS[(entrada as any).subtipo] || "Entrada"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            +{entrada.quantidade}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entrada.realizado_por_nome || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {entrada.motivo || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <EntradaEstoqueForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={registrarEntrada}
        epis={epis}
        locais={locais}
        isLoading={registrando}
      />

      <TransferenciaEstoqueForm
        open={showTransferForm}
        onOpenChange={setShowTransferForm}
        onSubmit={transferir}
        epis={epis}
        locais={locais}
        isLoading={transferindo}
      />

      <SaidaEstoqueForm
        open={showSaidaForm}
        onOpenChange={setShowSaidaForm}
        onSubmit={registrarSaida}
        epis={epis}
        locais={locais}
        isLoading={registrandoSaida}
      />

      <ImportacaoNFForm
        open={showNFForm}
        onOpenChange={setShowNFForm}
        onSubmit={importarNF}
        epis={epis}
        locais={locais}
        isLoading={importando}
      />
    </div>
  );
}
