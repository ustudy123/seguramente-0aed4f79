import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClipboardList, Search, Sparkles, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import type { ErgonomiaAnalise, RiscoIdentificadoIA } from "@/hooks/useErgonomiaAnalises";

interface InventarioRiscosProps {
  analises: ErgonomiaAnalise[];
}

interface ItemInventario {
  unidade: string;
  setor: string;
  cargo: string;
  atividade: string;
  risco: RiscoIdentificadoIA;
  analise_id: string;
  data_analise: string;
}

const CLASSIFICACAO_CONFIG = {
  baixo: { label: "🟢 Baixo", color: "text-success bg-success/10 border-success/30" },
  medio: { label: "🟡 Médio", color: "text-warning bg-warning/10 border-warning/30" },
  alto: { label: "🔴 Alto", color: "text-destructive bg-destructive/10 border-destructive/30" },
  critico: { label: "🔴 Crítico", color: "text-destructive bg-destructive/10 border-destructive/30" },
};

const EIXO_LABELS = {
  fisico: "Físico",
  cognitivo: "Cognitivo",
  organizacional: "Organizacional",
};

export function InventarioRiscos({ analises }: InventarioRiscosProps) {
  const [busca, setBusca] = useState("");
  const [criadosAcoes, setCriadosAcoes] = useState<Set<string>>(new Set());
  const { createAcao } = usePlanoAcao();
  const navigate = useNavigate();

  // Expandir analises em itens individuais de risco
  const itens: ItemInventario[] = analises.flatMap((analise) =>
    (analise.riscos_identificados || []).map((risco) => ({
      unidade: analise.unidade || "—",
      setor: analise.setor,
      cargo: analise.cargo,
      atividade: analise.atividade || "—",
      risco,
      analise_id: analise.id,
      data_analise: analise.data_analise,
    }))
  );

  const itensFiltrados = itens.filter(
    (item) =>
      !busca ||
      item.setor.toLowerCase().includes(busca.toLowerCase()) ||
      item.cargo.toLowerCase().includes(busca.toLowerCase()) ||
      item.risco.tipo.toLowerCase().includes(busca.toLowerCase())
  );

  const handleCriarAcao = async (item: ItemInventario) => {
    const key = `${item.analise_id}_${item.risco.tipo}`;
    try {
      await createAcao({
        titulo: `Correção ergonômica: ${item.risco.tipo} — ${item.cargo}`,
        descricao: item.risco.descricao,
        porque: `Risco ergonômico identificado em análise: ${item.risco.tipo} com severidade ${item.risco.severidade}`,
        onde: `${item.setor} — ${item.cargo}`,
        origem_modulo: "ergonomia",
        origem_descricao: "Inventário de Riscos Ergonômicos",
        prioridade:
          item.risco.severidade === "critico" || item.risco.severidade === "alto"
            ? "alto"
            : "medio",
        tipo: "corretiva",
        exige_evidencia: true,
      });
      setCriadosAcoes((prev) => new Set([...prev, key]));
      toast.success("Ação 5W2H criada com sucesso!", {
        action: {
          label: "Ver Plano de Ação",
          onClick: () => navigate("/plano-acao"),
        },
      });
    } catch {
      toast.error("Erro ao criar ação");
    }
  };

  const handleExportar = () => {
    const headers = [
      "Unidade",
      "Setor",
      "Cargo",
      "Atividade",
      "Risco Ergonômico",
      "Eixo",
      "Severidade",
      "Descrição",
    ];
    const rows = itensFiltrados.map((item) => [
      item.unidade,
      item.setor,
      item.cargo,
      item.atividade,
      item.risco.tipo,
      EIXO_LABELS[item.risco.eixo] || item.risco.eixo,
      item.risco.severidade,
      item.risco.descricao,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${v}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventario_riscos_ergonomicos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Inventário exportado com sucesso!");
  };

  if (analises.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Inventário vazio</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            O inventário de riscos ergonômicos é alimentado automaticamente pelas
            análises realizadas. Realize uma análise por IA para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por setor, cargo ou risco..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportar} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-foreground">{itens.length}</p>
            <p className="text-xs text-muted-foreground">Riscos totais</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {itens.filter((i) => i.risco.severidade === "critico" || i.risco.severidade === "alto").length}
            </p>
            <p className="text-xs text-muted-foreground">Críticos / Altos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {new Set(itens.map((i) => i.setor)).size}
            </p>
            <p className="text-xs text-muted-foreground">Setores mapeados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-xs">Setor</TableHead>
                <TableHead className="font-semibold text-xs">Cargo</TableHead>
                <TableHead className="font-semibold text-xs">Risco Ergonômico</TableHead>
                <TableHead className="font-semibold text-xs">Eixo</TableHead>
                <TableHead className="font-semibold text-xs">Classificação</TableHead>
                <TableHead className="font-semibold text-xs">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensFiltrados.map((item, idx) => {
                const key = `${item.analise_id}_${item.risco.tipo}`;
                const classCfg =
                  CLASSIFICACAO_CONFIG[item.risco.severidade] ||
                  CLASSIFICACAO_CONFIG.baixo;
                return (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <TableCell className="text-sm py-3">{item.setor}</TableCell>
                    <TableCell className="text-sm py-3 font-medium">{item.cargo}</TableCell>
                    <TableCell className="text-sm py-3">
                      <div>
                        <p className="font-medium">{item.risco.tipo}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.risco.descricao}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm py-3">
                      <Badge variant="secondary" className="text-xs">
                        {EIXO_LABELS[item.risco.eixo] || item.risco.eixo}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn("text-xs border", classCfg.color)}
                      >
                        {classCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      {criadosAcoes.has(key) ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          ✓ Ação criada
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs h-7"
                          onClick={() => handleCriarAcao(item)}
                        >
                          <Sparkles className="h-3 w-3" />
                          Gerar Ação
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {itensFiltrados.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhum risco encontrado para os filtros aplicados.
        </div>
      )}
    </div>
  );
}
