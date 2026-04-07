import { useState, useRef, useCallback } from "react";
import { FileText, Upload, Loader2, Check, X, Sparkles, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompetenciaExtraida {
  nome: string;
  tipo: string;
  descricao: string;
  selecionada: boolean;
}

interface TextoCompetenciasImportProps {
  funcaoNome?: string;
  onImportar: (competencias: Omit<CompetenciaExtraida, "selecionada">[]) => Promise<void>;
}

const TIPO_LABELS: Record<string, string> = { tecnica: "Técnica", comportamental: "Comportamental", cognitiva: "Cognitiva" };

export function TextoCompetenciasImport({ funcaoNome, onImportar }: TextoCompetenciasImportProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "processando" | "resultado">("input");
  const [texto, setTexto] = useState("");
  const [competencias, setCompetencias] = useState<CompetenciaExtraida[]>([]);
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processarTexto = useCallback(async (conteudo: string) => {
    if (conteudo.trim().length < 20) {
      toast.error("Texto muito curto. Forneça uma descrição mais detalhada.");
      return;
    }
    setStep("processando");
    try {
      const { data, error } = await supabase.functions.invoke("ai-texto-atividades", {
        body: { texto: conteudo, funcaoNome, tipo: "competencias" },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      const items = (data.atividades || data.competencias || []).map((c: any) => ({
        nome: c.nome || "",
        tipo: c.tipo || "tecnica",
        descricao: c.descricao || "",
        selecionada: true,
      }));
      setCompetencias(items);
      setStep("resultado");
    } catch (err: any) {
      toast.error("Erro ao processar texto: " + err.message);
      setStep("input");
    }
  }, [funcaoNome]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setTexto(text);
    e.target.value = "";
  };

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTexto(text);
    } catch {
      toast.error("Não foi possível acessar a área de transferência.");
    }
  }, []);

  const handleImportar = async () => {
    const selecionadas = competencias.filter((c) => c.selecionada);
    if (selecionadas.length === 0) return;
    setImportando(true);
    try {
      await onImportar(selecionadas.map(({ selecionada, ...rest }) => rest));
      toast.success(`${selecionadas.length} competência(s) importada(s)!`);
      setOpen(false);
      setStep("input");
      setCompetencias([]);
      setTexto("");
    } catch {
      toast.error("Erro ao importar competências.");
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="w-4 h-4 mr-1" /> Texto
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setStep("input"); setCompetencias([]); setTexto(""); } else setOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Importar Competências por Texto</DialogTitle>
            <DialogDescription>Cole ou digite um texto descrevendo as competências necessárias.</DialogDescription>
          </DialogHeader>

          {step === "input" && (
            <div className="space-y-4">
              <Tabs defaultValue="digitar">
                <TabsList className="w-full">
                  <TabsTrigger value="digitar" className="flex-1">Digitar/Colar</TabsTrigger>
                  <TabsTrigger value="arquivo" className="flex-1">Arquivo</TabsTrigger>
                </TabsList>
                <TabsContent value="digitar" className="mt-3 space-y-3">
                  <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Descreva as competências necessárias para a função..." rows={8} />
                  <Button variant="outline" size="sm" onClick={handlePaste}><ClipboardPaste className="w-4 h-4 mr-1" /> Colar</Button>
                </TabsContent>
                <TabsContent value="arquivo" className="mt-3 space-y-3">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-1" /> Enviar Arquivo (.txt)</Button>
                  <input ref={fileInputRef} type="file" accept=".txt,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                  {texto && <p className="text-xs text-muted-foreground">Arquivo carregado ({texto.length} caracteres)</p>}
                </TabsContent>
              </Tabs>
              <div className="flex justify-end">
                <Button onClick={() => processarTexto(texto)} disabled={texto.trim().length < 20}>
                  <Sparkles className="w-4 h-4 mr-1" /> Extrair Competências
                </Button>
              </div>
            </div>
          )}

          {step === "processando" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Extraindo competências com IA...</p>
            </div>
          )}

          {step === "resultado" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{competencias.filter(c => c.selecionada).length} de {competencias.length} selecionadas</span>
                <Button variant="ghost" size="sm" onClick={() => setCompetencias(competencias.map(c => ({ ...c, selecionada: !competencias.every(x => x.selecionada) })))}>
                  {competencias.every(c => c.selecionada) ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              </div>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-2">
                  {competencias.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded border bg-card">
                      <Checkbox checked={c.selecionada} onCheckedChange={(v) => { const copy = [...competencias]; copy[i].selecionada = !!v; setCompetencias(copy); }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.nome}</span>
                          <Badge variant="outline" className="text-xs">{TIPO_LABELS[c.tipo] || c.tipo}</Badge>
                        </div>
                        {c.descricao && <p className="text-xs text-muted-foreground mt-0.5">{c.descricao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setStep("input"); setCompetencias([]); }}>Voltar</Button>
                <Button onClick={handleImportar} disabled={importando || competencias.filter(c => c.selecionada).length === 0}>
                  {importando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Importar ({competencias.filter(c => c.selecionada).length})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
