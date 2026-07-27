import { useState, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ArrowRight, Loader2, X, RefreshCw, Plus,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { gerarModeloFerias } from "@/lib/feriasImport";
import { useImportarFerias } from "@/hooks/useImportarFerias";

type Passo = "instrucoes" | "conferencia" | "concluido";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImportado?: () => void;
}

export function ImportarFeriasModal({ open, onOpenChange, onImportado }: Props) {
  const [passo, setPasso] = useState<Passo>("instrucoes");
  const [resultado, setResultado] = useState<{ gravadas: number; recalculadas: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { previa, processando, analisar, importar, limpar } = useImportarFerias();

  const reset = () => {
    setPasso("instrucoes");
    setResultado(null);
    limpar();
  };

  const fechar = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const baixarModelo = () => {
    const blob = gerarModeloFerias();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_saldos_ferias.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const aoEscolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = await analisar(file);
      setPasso("conferencia");
      if (p.linhas.length === 0) {
        toast.error("Não consegui ler nenhuma linha. Confira se usou o modelo.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler a planilha");
    }
  };

  const confirmar = async () => {
    try {
      const r = await importar();
      setResultado(r);
      setPasso("concluido");
      onImportado?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    }
  };

  const problemasPorLinha = (linhaExcel: number) =>
    previa?.problemas.filter(p => p.linhaExcel === linhaExcel) ?? [];

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar saldos de férias
          </DialogTitle>
          <DialogDescription>
            {passo === "instrucoes" && "Baixe o modelo, preencha e envie. Nada é gravado antes da sua conferência."}
            {passo === "conferencia" && "Confira o que o sistema entendeu. Só as linhas sem erro e com colaborador encontrado serão importadas."}
            {passo === "concluido" && "Importação concluída."}
          </DialogDescription>
        </DialogHeader>

        {/* Trilha dos passos */}
        <div className="flex items-center gap-2 text-xs">
          {(["instrucoes", "conferencia", "concluido"] as Passo[]).map((p, i) => (
            <div key={p} className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border font-medium",
                passo === p ? "border-primary bg-primary text-primary-foreground"
                  : i < (["instrucoes", "conferencia", "concluido"] as Passo[]).indexOf(passo)
                    ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}>{i + 1}</span>
              <span className={cn(passo === p ? "font-medium" : "text-muted-foreground")}>
                {p === "instrucoes" ? "Modelo" : p === "conferencia" ? "Conferência" : "Concluído"}
              </span>
              {i < 2 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Passo 1 */}
        {passo === "instrucoes" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">1</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Baixe o modelo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Uma linha por período aquisitivo. Colaboradores com mais de um período ocupam
                    várias linhas. O <strong>CPF é obrigatório</strong> — é ele que liga cada linha
                    ao colaborador cadastrado.
                  </p>
                  <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={baixarModelo}>
                    <Download className="h-4 w-4" /> Baixar modelo (.xlsx)
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Envie a planilha preenchida</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aceita .xlsx e .xls. O sistema calcula os dias de direito — você informa apenas
                    faltas e dias já gozados por período.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e => aoEscolherArquivo(e.target.files?.[0])}
                  />
                  <Button size="sm" className="mt-2 gap-2" disabled={processando}
                    onClick={() => inputRef.current?.click()}>
                    {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {processando ? "Lendo..." : "Escolher arquivo"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Passo 2 */}
        {passo === "conferencia" && previa && (
          <>
            <div className="grid grid-cols-4 gap-2">
              <ResumoCard label="Serão importadas" valor={previa.totalValidas} tom="ok" />
              <ResumoCard label="Novos" valor={previa.totalCriar} icone={<Plus className="h-3 w-3" />} />
              <ResumoCard label="Atualizados" valor={previa.totalAtualizar} icone={<RefreshCw className="h-3 w-3" />} />
              <ResumoCard label="Com problema" valor={previa.totalErros + previa.totalNaoEncontrados} tom={previa.totalErros + previa.totalNaoEncontrados > 0 ? "alerta" : "neutro"} />
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[42vh] border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                  <tr className="text-left">
                    <th className="px-2 py-2 font-medium">Ln</th>
                    <th className="px-2 py-2 font-medium">Colaborador</th>
                    <th className="px-2 py-2 font-medium">Período</th>
                    <th className="px-2 py-2 font-medium text-center">Faltas</th>
                    <th className="px-2 py-2 font-medium text-center">Gozados</th>
                    <th className="px-2 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.linhas.map(l => {
                    const probs = problemasPorLinha(l.linhaExcel);
                    const temErro = probs.some(p => p.gravidade === "erro") || !l.encontrado;
                    return (
                      <tr key={l.linhaExcel} className={cn("border-t", temErro && "bg-red-50/50")}>
                        <td className="px-2 py-1.5 text-muted-foreground">{l.linhaExcel}</td>
                        <td className="px-2 py-1.5">
                          <div className="font-medium">{l.nome || <span className="text-muted-foreground italic">sem nome</span>}</div>
                          <div className="text-[10px] text-muted-foreground">{l.cpf || "sem CPF"}</div>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {l.aquisitivoInicio && l.aquisitivoFim
                            ? `${fmt(l.aquisitivoInicio)} → ${fmt(l.aquisitivoFim)}`
                            : <span className="text-red-600">incompleto</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center">{l.faltas}</td>
                        <td className="px-2 py-1.5 text-center">{l.diasGozados}</td>
                        <td className="px-2 py-1.5">
                          {temErro ? (
                            <div className="space-y-0.5">
                              {!l.encontrado && l.cpf && (
                                <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" /> não encontrado
                                </Badge>
                              )}
                              {probs.filter(p => p.gravidade === "erro").map((p, i) => (
                                <div key={i} className="text-[10px] text-red-600">{p.mensagem}</div>
                              ))}
                            </div>
                          ) : l.jaExiste ? (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <RefreshCw className="h-2.5 w-2.5" /> atualizar
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] gap-1"><Plus className="h-2.5 w-2.5" /> novo</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>

            {(previa.totalErros > 0 || previa.totalNaoEncontrados > 0) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Linhas com problema (destacadas) <strong>não serão importadas</strong>. Corrija na
                  planilha e reenvie, ou prossiga apenas com as {previa.totalValidas} válidas.
                </p>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={reset} className="gap-2">
                <X className="h-4 w-4" /> Recomeçar
              </Button>
              <Button onClick={confirmar} disabled={processando || previa.totalValidas === 0} className="gap-2">
                {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Importar {previa.totalValidas} {previa.totalValidas === 1 ? "período" : "períodos"}
              </Button>
            </div>
          </>
        )}

        {/* Passo 3 */}
        {passo === "concluido" && resultado && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold">{resultado.gravadas} períodos importados</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Os saldos foram recalculados. Períodos com excesso de faltas, se houver, entraram na
              fila de validação para conferência antes de zerar.
            </p>
            <Button onClick={() => fechar(false)} className="mt-2">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumoCard({ label, valor, tom = "neutro", icone }: {
  label: string; valor: number; tom?: "ok" | "alerta" | "neutro"; icone?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-2.5",
      tom === "ok" && "border-green-200 bg-green-50/50",
      tom === "alerta" && "border-red-200 bg-red-50/50",
    )}>
      <div className="text-lg font-bold flex items-center gap-1">{icone}{valor}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
