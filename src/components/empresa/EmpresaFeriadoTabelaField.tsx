import { useMemo } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useFeriadoTabelas } from "@/hooks/useFeriadoTabelas";
import { rotuloTabela, type FeriadoTabela } from "@/lib/ponto/feriadoTabelas";

const SEM_TABELA = "__nenhuma__";

const norm = (v?: string | null) =>
  (v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export interface EmpresaFeriadoTabelaFieldProps {
  empresaId?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

/** RN22 — tabela de feriados vinculada à filial, com sugestão automática por município/UF. */
export function EmpresaFeriadoTabelaField({ empresaId, cidade, uf }: EmpresaFeriadoTabelaFieldProps) {
  const { tabelas, empresasPorTabela, vincularEmpresa, isLoading } = useFeriadoTabelas();

  const atual = useMemo(() => {
    if (!empresaId) return null;
    return tabelas.find((t) => (empresasPorTabela.get(t.id) || []).includes(empresaId)) || null;
  }, [tabelas, empresasPorTabela, empresaId]);

  const sugeridas = useMemo<FeriadoTabela[]>(() => {
    if (!cidade && !uf) return [];
    return tabelas.filter((t) =>
      t.ativo &&
      (cidade ? norm(t.municipio) === norm(cidade) : true) &&
      (uf ? norm(t.uf) === norm(uf) : true));
  }, [tabelas, cidade, uf]);

  const sugestao = sugeridas.find((t) => t.id !== atual?.id) || null;

  if (!empresaId) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Tabela de feriados vinculada
        </Label>
        <p className="text-xs text-muted-foreground">
          Salve o cadastro da unidade para vincular uma tabela de feriados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Tabela de feriados vinculada
        </Label>
        {atual && <Badge variant="secondary">Tabela {atual.numero ?? "—"}</Badge>}
      </div>

      <Select
        value={atual?.id ?? SEM_TABELA}
        disabled={isLoading || vincularEmpresa.isPending}
        onValueChange={(v) =>
          vincularEmpresa.mutate({ empresaId, tabelaId: v === SEM_TABELA ? null : v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione a tabela de feriados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_TABELA}>Nenhuma (usar feriados gerais)</SelectItem>
          {tabelas.filter((t) => t.ativo).map((t) => (
            <SelectItem key={t.id} value={t.id}>{rotuloTabela(t)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sugestao && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Sugerida pelo município: {rotuloTabela(sugestao)}</span>
          <Button
            type="button" size="sm" variant="outline" className="h-7"
            disabled={vincularEmpresa.isPending}
            onClick={() => vincularEmpresa.mutate({ empresaId, tabelaId: sugestao.id })}
          >
            Aplicar sugestão
          </Button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        A tabela vinculada prevalece sobre feriados municipais, estaduais e nacionais na apuração do ponto.
      </p>
    </div>
  );
}
