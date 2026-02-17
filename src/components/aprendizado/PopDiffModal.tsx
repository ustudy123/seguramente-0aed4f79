import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCompareArrows } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PopData, PopVersao } from "@/hooks/usePopAtividade";

interface PopDiffModalProps {
  open: boolean;
  onClose: () => void;
  pop: PopData;
  versoes: PopVersao[];
}

type FieldDef = { key: string; label: string };

const FIELDS: FieldDef[] = [
  { key: "objetivo", label: "Objetivo" },
  { key: "escopo", label: "Escopo" },
  { key: "definicoes", label: "Definições" },
  { key: "epis_sst", label: "EPIs / SST" },
  { key: "criterios_qualidade", label: "Critérios de Qualidade" },
  { key: "registros_evidencias", label: "Registros e Evidências" },
  { key: "tratamento_nao_conformidades", label: "Tratamento de NC" },
  { key: "referencias", label: "Referências" },
];

function getFieldValue(source: Record<string, unknown>, key: string): string {
  const v = source[key];
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((item, i) => typeof item === "object" ? JSON.stringify(item) : String(item)).join("\n");
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

function diffLines(oldText: string, newText: string) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: Array<{ type: "same" | "added" | "removed"; text: string }> = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const ol = oldLines[i];
    const nl = newLines[i];
    if (ol === nl) {
      result.push({ type: "same", text: ol || "" });
    } else {
      if (ol !== undefined && ol !== "") result.push({ type: "removed", text: ol });
      if (nl !== undefined && nl !== "") result.push({ type: "added", text: nl });
    }
  }
  return result;
}

function formatPassos(passos: unknown): string {
  if (!Array.isArray(passos)) return "";
  return passos.map((p: any) => {
    let line = `Passo ${p.numero}: ${p.descricao || ""}`;
    if (p.tempo_estimado) line += ` (${p.tempo_estimado})`;
    if (p.ponto_atencao) line += ` ⚠️ ${p.ponto_atencao}`;
    return line;
  }).join("\n");
}

export function PopDiffModal({ open, onClose, pop, versoes }: PopDiffModalProps) {
  const [selectedVersaoId, setSelectedVersaoId] = useState<string>(versoes[0]?.id || "");

  const selectedVersao = versoes.find(v => v.id === selectedVersaoId);
  const oldData = selectedVersao?.conteudo_snapshot as Record<string, unknown> || {};
  
  const currentData: Record<string, unknown> = {
    objetivo: pop.objetivo,
    escopo: pop.escopo,
    definicoes: pop.definicoes,
    epis_sst: pop.epis_sst,
    criterios_qualidade: pop.criterios_qualidade,
    registros_evidencias: pop.registros_evidencias,
    tratamento_nao_conformidades: pop.tratamento_nao_conformidades,
    referencias: pop.referencias,
    procedimento_passos: pop.procedimento_passos,
    responsabilidades: pop.responsabilidades,
    pre_requisitos: pop.pre_requisitos,
    materiais_ferramentas: pop.materiais_ferramentas,
  };

  const allFields: FieldDef[] = [
    ...FIELDS,
    { key: "procedimento_passos", label: "Procedimento" },
    { key: "pre_requisitos", label: "Pré-requisitos" },
    { key: "materiais_ferramentas", label: "Materiais/Ferramentas" },
  ];

  const getVal = (source: Record<string, unknown>, key: string) => {
    if (key === "procedimento_passos") return formatPassos(source[key]);
    if (key === "responsabilidades") {
      const r = source[key] as any;
      if (!r) return "";
      return `Executante: ${r.executante || ""}\nSupervisão: ${r.supervisao || ""}\nInterfaces: ${r.interfaces || ""}`;
    }
    return getFieldValue(source, key);
  };

  const changedFields = allFields.filter(f => {
    const o = getVal(oldData, f.key);
    const n = getVal(currentData, f.key);
    return o !== n;
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5" />
            Comparar Versões — {pop.codigo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Comparar versão:</span>
            <Select value={selectedVersaoId} onValueChange={setSelectedVersaoId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versoes.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.versao} — {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground pt-5">
            com a <Badge variant="outline">versão atual v{pop.versao_atual}</Badge>
          </div>
        </div>

        {selectedVersao?.motivo_alteracao && (
          <p className="text-xs text-muted-foreground italic mb-2">
            Motivo: {selectedVersao.motivo_alteracao}
          </p>
        )}

        <ScrollArea className="h-[55vh]">
          {changedFields.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma diferença encontrada entre as versões.</p>
          ) : (
            <div className="space-y-4">
              {changedFields.map(f => {
                const oldVal = getVal(oldData, f.key);
                const newVal = getVal(currentData, f.key);
                const lines = diffLines(oldVal, newVal);

                return (
                  <div key={f.key} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-1.5 text-sm font-medium border-b">{f.label}</div>
                    <div className="font-mono text-xs p-2 space-y-0.5">
                      {lines.map((l, i) => (
                        <div
                          key={i}
                          className={
                            l.type === "removed"
                              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded"
                              : l.type === "added"
                              ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded"
                              : "px-2 py-0.5 text-muted-foreground"
                          }
                        >
                          <span className="select-none mr-2 opacity-50">
                            {l.type === "removed" ? "−" : l.type === "added" ? "+" : " "}
                          </span>
                          {l.text}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
