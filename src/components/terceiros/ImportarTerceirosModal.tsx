import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, Loader2, AlertCircle } from "lucide-react";
import { useTerceiros } from "@/hooks/useTerceiros";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ImportarTerceirosModal({ open, onOpenChange }: Props) {
  const { createTerceiro } = useTerceiros();
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [importing, setImporting] = useState(false);

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

    const rows = [
      headers,
      [
        "Exemplo Empresa LTDA",
        "Nome Fantasia",
        "00.000.000/0000-00",
        "contato@empresa.com",
        "(00) 00000-0000",
        "recorrente",
        "nao",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Terceiros");
    XLSX.writeFile(wb, "template_importacao_terceiros.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const data = rawData.map((row) => {
          const normalized = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
            const normalizedKey = key.replace(/\s*\*\s*$/, "").trim().toLowerCase();
            acc[normalizedKey] = value;
            return acc;
          }, {});

          return normalized;
        });

        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          try {
            if (!row.razao_social || !row.cnpj) {
              errorCount++;
              continue;
            }

            // Using 'as any' to bypass the TypeScript check for empresa_id if it's not in the type but in the DB
            await createTerceiro.mutateAsync({
              razao_social: String(row.razao_social),
              nome_fantasia: row.nome_fantasia ? String(row.nome_fantasia) : null,
              cnpj: String(row.cnpj).replace(/\D/g, ""),
              email: row.email ? String(row.email) : null,
              telefone: row.telefone ? String(row.telefone) : null,
               tipo_acesso: (String(row.tipo_acesso || "eventual").toLowerCase() || "eventual") as any,
              atividade_risco: String(row.atividade_risco).toLowerCase() === "sim",
              status: "liberado",
              tenant_id: tenantId!,
              empresa_id: empresaAtivaId || null,
            } as any);
            successCount++;
          } catch (err) {
            console.error("Erro ao importar linha:", err, row);
            errorCount++;
          }
        }

        toast.success(`Importação concluída: ${successCount} sucessos, ${errorCount} falhas.`);
        if (successCount > 0) onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Prestadores de Serviço</DialogTitle>
        </DialogHeader>
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
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              <li>O CNPJ deve ser único no sistema.</li>
                <li>Campos obrigatórios: <strong>razao_social</strong> e <strong>cnpj</strong>.</li>
                <li>Demais campos são opcionais.</li>
                <li>Formatos de data sugeridos: DD/MM/YYYY.</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
