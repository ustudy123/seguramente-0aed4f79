import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, Loader2, AlertCircle, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useTerceiros } from "@/hooks/useTerceiros";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface RowError {
  linha: number;
  razao_social?: string;
  cnpj?: string;
  motivo: string;
}

interface ImportResult {
  successCount: number;
  errors: RowError[];
}

const TIPOS_ACESSO_VALIDOS = ["eventual", "recorrente", "continuo"] as const;

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function ImportarTerceirosModal({ open, onOpenChange }: Props) {
  const { createTerceiro } = useTerceiros();
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleClose = (o: boolean) => {
    if (!o) setResult(null);
    onOpenChange(o);
  };

  const downloadTemplate = () => {
    const headers = [
      "razao_social *",
      "nome_fantasia",
      "cnpj *",
      "email",
      "telefone",
      "tipo_acesso",
      "atividade_risco",
    ];

    const exampleRows = [
      ["Exemplo Empresa 1 LTDA", "Empresa 1", "00.000.000/0000-01", "contato1@empresa.com", "(11) 90000-0001", "eventual", "nao"],
      ["Exemplo Empresa 2 LTDA", "Empresa 2", "00.000.000/0000-02", "contato2@empresa.com", "(11) 90000-0002", "recorrente", "sim"],
      ["Exemplo Empresa 3 LTDA", "Empresa 3", "00.000.000/0000-03", "contato3@empresa.com", "(11) 90000-0003", "continuo", "nao"],
    ];

    const rows = [headers, ...exampleRows];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Add dropdown (data validation) for tipo_acesso (col F) and atividade_risco (col G)
    // Apply to rows 2..1000 to cover bulk imports
    (ws as any)["!dataValidation"] = [
      {
        sqref: "F2:F1000",
        type: "list",
        formula1: '"eventual,recorrente,continuo"',
        showErrorMessage: true,
        errorTitle: "Valor inválido",
        error: "Use: eventual, recorrente ou continuo",
        showInputMessage: true,
        promptTitle: "Tipo de Acesso",
        prompt: "eventual | recorrente | continuo",
      },
      {
        sqref: "G2:G1000",
        type: "list",
        formula1: '"sim,nao"',
        showErrorMessage: true,
        errorTitle: "Valor inválido",
        error: "Use: sim ou nao",
        showInputMessage: true,
        promptTitle: "Atividade de Risco",
        prompt: "sim | nao",
      },
    ];

    // Column widths for better readability
    (ws as any)["!cols"] = [
      { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Terceiros");
    XLSX.writeFile(wb, "template_importacao_terceiros.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const data = rawData.map((row) => {
          return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
            const normalizedKey = key.replace(/\s*\*\s*$/, "").trim().toLowerCase();
            acc[normalizedKey] = typeof value === "string" ? value.trim() : value;
            return acc;
          }, {});
        });

        let successCount = 0;
        const errors: RowError[] = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const linha = i + 2; // header + 1-indexed
          const razao = row.razao_social ? String(row.razao_social) : "";
          const cnpjRaw = row.cnpj ? String(row.cnpj) : "";

          // Skip totally empty rows silently
          const hasAny = Object.values(row).some((v) => v !== "" && v != null);
          if (!hasAny) continue;

          if (!razao) {
            errors.push({ linha, razao_social: razao, cnpj: cnpjRaw, motivo: "Campo 'razao_social' é obrigatório." });
            continue;
          }
          if (!cnpjRaw) {
            errors.push({ linha, razao_social: razao, cnpj: cnpjRaw, motivo: "Campo 'cnpj' é obrigatório." });
            continue;
          }

          // Normalize tipo_acesso (remove accents, lowercase)
          let tipoAcesso: string = "eventual";
          if (row.tipo_acesso) {
            const normalized = stripAccents(String(row.tipo_acesso).toLowerCase().trim());
            if (!TIPOS_ACESSO_VALIDOS.includes(normalized as typeof TIPOS_ACESSO_VALIDOS[number])) {
              errors.push({
                linha,
                razao_social: razao,
                cnpj: cnpjRaw,
                motivo: `Valor inválido em 'tipo_acesso': "${row.tipo_acesso}". Use: eventual, recorrente ou continuo.`,
              });
              continue;
            }
            tipoAcesso = normalized;
          }

          try {
            await createTerceiro.mutateAsync({
              razao_social: razao,
              nome_fantasia: row.nome_fantasia ? String(row.nome_fantasia) : null,
              cnpj: cnpjRaw.replace(/\D/g, ""),
              email: row.email ? String(row.email) : null,
              telefone: row.telefone ? String(row.telefone) : null,
              tipo_acesso: tipoAcesso as any,
              atividade_risco: stripAccents(String(row.atividade_risco || "").toLowerCase()) === "sim",
              status: "liberado",
              tenant_id: tenantId!,
              empresa_id: empresaAtivaId || null,
            } as any);
            successCount++;
          } catch (err: any) {
            console.error("Erro ao importar linha:", err, row);
            const msg = err?.message || "Erro desconhecido ao salvar.";
            errors.push({
              linha,
              razao_social: razao,
              cnpj: cnpjRaw,
              motivo: msg.includes("duplicate") || msg.includes("unique")
                ? "CNPJ já cadastrado no sistema."
                : msg,
            });
          }
        }

        setResult({ successCount, errors });
        if (successCount > 0) {
          toast.success(`${successCount} prestador(es) importado(s) com sucesso.`);
        }
        if (errors.length > 0) {
          toast.error(`${errors.length} linha(s) com erro. Veja os detalhes na tela.`);
        }
      } catch (err) {
        toast.error("Erro ao processar arquivo.");
        console.error(err);
      } finally {
        setImporting(false);
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadErrorReport = () => {
    if (!result?.errors.length) return;
    const ws = XLSX.utils.json_to_sheet(
      result.errors.map((e) => ({
        Linha: e.linha,
        Razao_Social: e.razao_social || "",
        CNPJ: e.cnpj || "",
        Erro: e.motivo,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, "erros_importacao_terceiros.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {result ? "Resultado da Importação" : "Importar Prestadores de Serviço"}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{result.successCount}</p>
                  <p className="text-xs text-emerald-700">Importados com sucesso</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-700">Linhas com erro</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-lg">
                <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                  <p className="text-sm font-semibold">Detalhes dos erros</p>
                  <Button size="sm" variant="outline" onClick={downloadErrorReport} className="gap-2">
                    <FileDown className="w-4 h-4" /> Baixar Relatório
                  </Button>
                </div>
                <ScrollArea className="h-[320px]">
                  <div className="divide-y">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">Linha {err.linha}</Badge>
                          {err.razao_social && (
                            <span className="font-medium truncate">{err.razao_social}</span>
                          )}
                          {err.cnpj && (
                            <span className="text-xs text-muted-foreground">CNPJ: {err.cnpj}</span>
                          )}
                        </div>
                        <p className="text-xs text-red-600">{err.motivo}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setResult(null)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Importar outro arquivo
              </Button>
              <Button onClick={() => handleClose(false)}>Concluir</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 p-4 rounded-lg border border-dashed text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Baixe o modelo, preencha os dados e suba o arquivo novamente.
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <FileDown className="w-4 h-4" /> Baixar Modelo Excel
              </Button>
            </div>

            <div className="flex flex-col items-center gap-4">
              <label className="w-full">
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  {importing ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground mt-2">Processando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <span className="text-sm font-medium">Clique para selecionar arquivo</span>
                      <span className="text-xs text-muted-foreground">Suporta .xlsx, .xls, .csv</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    disabled={importing}
                  />
                </div>
              </label>
            </div>

            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 flex gap-3 text-amber-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Importante:</p>
                <ul className="list-disc pl-4">
                  <li>Campos obrigatórios: <strong>razao_social</strong> e <strong>cnpj</strong>.</li>
                  <li>O CNPJ deve ser único no sistema.</li>
                  <li><strong>tipo_acesso</strong> aceita: <code>eventual</code>, <code>recorrente</code> ou <code>continuo</code> (sem acento).</li>
                  <li><strong>atividade_risco</strong> aceita: <code>sim</code> ou <code>nao</code>.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
