import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDropzone } from "react-dropzone";
import { useJornadaImportacao, MapeamentoColunas } from "@/hooks/useJornadaAnalise";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowRight, Loader2, Save, FolderOpen } from "lucide-react";

const CAMPOS_MAPEAMENTO = [
  { key: "colaboradorNome", label: "Nome do Colaborador", obrigatorio: true },
  { key: "colaboradorCpf", label: "CPF / Matrícula", obrigatorio: false },
  { key: "data", label: "Data", obrigatorio: true },
  { key: "entrada", label: "Entrada", obrigatorio: false },
  { key: "saidaAlmoco", label: "Saída Almoço", obrigatorio: false },
  { key: "retornoAlmoco", label: "Retorno Almoço", obrigatorio: false },
  { key: "saida", label: "Saída", obrigatorio: false },
  { key: "horasTrabalhadas", label: "Horas Trabalhadas", obrigatorio: false },
  { key: "horasExtras", label: "Horas Extras", obrigatorio: false },
  { key: "atraso", label: "Atraso (min)", obrigatorio: false },
  { key: "ajusteManual", label: "Ajuste Manual", obrigatorio: false },
];

export function JornadaImportacao() {
  const { tenantId } = useTenant();
  const { lerArquivo, processarDados, importarParaPontoDiario, isProcessing, progress } = useJornadaImportacao();
  const [etapa, setEtapa] = useState<"upload" | "mapeamento" | "preview" | "resultado">("upload");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dadosBrutos, setDadosBrutos] = useState<string[][]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, number | undefined>>({});
  const [dadosProcessados, setDadosProcessados] = useState<any[]>([]);
  const [resultado, setResultado] = useState<any>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  
  // Template state
  const [templates, setTemplates] = useState<any[]>([]);
  const [nomeTemplate, setNomeTemplate] = useState("");
  const [dialogSalvar, setDialogSalvar] = useState(false);

  // Load templates
  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("jornada_templates_mapeamento")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("nome")
      .then(({ data }) => setTemplates(data || []));
  }, [tenantId]);

  const salvarTemplate = async () => {
    if (!tenantId || !nomeTemplate.trim()) { toast.error("Informe um nome"); return; }
    const { error } = await supabase.from("jornada_templates_mapeamento").insert({
      tenant_id: tenantId,
      nome: nomeTemplate.trim(),
      mapeamento: mapeamento,
      headers_originais: headers,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Template salvo");
    setDialogSalvar(false);
    setNomeTemplate("");
    const { data } = await supabase.from("jornada_templates_mapeamento").select("*").eq("tenant_id", tenantId).order("nome");
    setTemplates(data || []);
  };

  const carregarTemplate = (templateId: string) => {
    const t = templates.find(t => t.id === templateId);
    if (!t) return;
    setMapeamento(t.mapeamento || {});
    toast.success(`Template "${t.nome}" carregado`);
  };

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setArquivo(file);
    setLendoArquivo(true);
    try {
      const { headers: h, dados } = await lerArquivo(file);
      setHeaders(h);
      setDadosBrutos(dados);
      // Auto-map
      const autoMap: Record<string, number | undefined> = {};
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const autoMappings: Record<string, string[]> = {
        colaboradorNome: ["nome", "funcionario", "colaborador", "nome completo"],
        colaboradorCpf: ["cpf", "matricula", "matrícula", "registro"],
        data: ["data", "date", "dia"],
        entrada: ["entrada", "hora entrada", "inicio", "início"],
        saidaAlmoco: ["saida almoco", "saída almoço", "inicio almoco", "saida intervalo"],
        retornoAlmoco: ["retorno almoco", "retorno almoço", "fim almoco", "retorno intervalo"],
        saida: ["saida", "saída", "hora saida", "hora saída", "fim"],
        horasTrabalhadas: ["horas trabalhadas", "total horas", "jornada", "carga horaria"],
        horasExtras: ["horas extras", "he", "hora extra", "extras"],
        atraso: ["atraso", "atrasos", "minutos atraso"],
        ajusteManual: ["ajuste", "ajuste manual", "manual"],
      };
      for (const [campo, aliases] of Object.entries(autoMappings)) {
        for (let i = 0; i < h.length; i++) {
          if (aliases.some(a => normalize(h[i]).includes(normalize(a)))) {
            autoMap[campo] = i;
            break;
          }
        }
      }
      setMapeamento(autoMap);
      setEtapa("mapeamento");
      toast.success(`Arquivo lido: ${h.length} colunas, ${dados.length} linhas`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLendoArquivo(false);
    }
  }, [lerArquivo]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const avancarParaPreview = () => {
    if (mapeamento.colaboradorNome === undefined || mapeamento.data === undefined) {
      toast.error("Mapeie pelo menos Nome e Data");
      return;
    }
    const dados = processarDados(dadosBrutos, mapeamento as any);
    setDadosProcessados(dados);
    setEtapa("preview");
  };

  const executarImportacao = async () => {
    if (!arquivo) return;
    try {
      const res = await importarParaPontoDiario(dadosProcessados, arquivo.name);
      setResultado(res);
      setEtapa("resultado");
      toast.success(`Importação concluída: ${res.importados} novos, ${res.atualizados} atualizados`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetar = () => {
    setEtapa("upload");
    setArquivo(null);
    setHeaders([]);
    setDadosBrutos([]);
    setMapeamento({});
    setDadosProcessados([]);
    setResultado(null);
  };

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {["Upload", "Mapeamento", "Preview", "Resultado"].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <Badge variant={["upload", "mapeamento", "preview", "resultado"][i] === etapa ? "default" : "outline"} className="text-xs">
              {i + 1}. {step}
            </Badge>
            {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {etapa === "upload" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Upload de Arquivo de Jornada</CardTitle></CardHeader>
          <CardContent>
            {lendoArquivo ? (
              <div className="border-2 border-dashed border-primary/40 rounded-xl p-12 text-center bg-primary/5">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="p-4 rounded-full bg-primary/10">
                      <FileSpreadsheet className="w-8 h-8 text-primary" />
                    </div>
                    <Loader2 className="w-5 h-5 animate-spin text-primary absolute -top-1 -right-1" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Lendo planilha…</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aguarde enquanto interpretamos o arquivo. Planilhas grandes podem levar alguns segundos.
                    </p>
                  </div>
                  <Progress value={undefined} className="h-1.5 w-full max-w-xs animate-pulse" />
                  {arquivo && (
                    <p className="text-xs text-muted-foreground truncate max-w-full">{arquivo.name}</p>
                  )}
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium">Arraste um arquivo CSV ou Excel aqui</p>
                <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar (máx. 20MB)</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Badge variant="outline">.csv</Badge>
                  <Badge variant="outline">.xlsx</Badge>
                  <Badge variant="outline">.xls</Badge>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              O arquivo deve conter dados de jornada exportados do seu sistema de ponto. 
              Na próxima etapa você fará o mapeamento das colunas.
            </p>
          </CardContent>
        </Card>
      )}

      {etapa === "mapeamento" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Mapeamento de Colunas — {arquivo?.name}
              </CardTitle>
              <div className="flex gap-2">
                {templates.length > 0 && (
                  <Select onValueChange={carregarTemplate}>
                    <SelectTrigger className="h-8 text-xs w-44">
                      <FolderOpen className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Carregar template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Dialog open={dialogSalvar} onOpenChange={setDialogSalvar}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Save className="h-3.5 w-3.5 mr-1" /> Salvar Template</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Salvar Template de Mapeamento</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="Nome do template (ex: Sistema XYZ)"
                        value={nomeTemplate}
                        onChange={e => setNomeTemplate(e.target.value)}
                      />
                      <Button onClick={salvarTemplate} className="w-full">Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Associe cada campo do sistema com a coluna correspondente do seu arquivo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CAMPOS_MAPEAMENTO.map(campo => (
                <div key={campo.key} className="flex items-center gap-3">
                  <label className="text-sm w-40 flex-shrink-0">
                    {campo.label}
                    {campo.obrigatorio && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Select
                    value={mapeamento[campo.key]?.toString() ?? "none"}
                    onValueChange={v => setMapeamento(prev => ({ ...prev, [campo.key]: v === "none" ? undefined : parseInt(v) }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Não mapear —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={resetar} size="sm">Voltar</Button>
              <Button onClick={avancarParaPreview} size="sm">
                Pré-visualizar <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pré-visualização dos Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 text-sm">
              <Badge variant="outline">{dadosProcessados.length} registros</Badge>
              <Badge variant="default" className="bg-green-600">{dadosProcessados.filter(d => d.erros.length === 0).length} válidos</Badge>
              {dadosProcessados.filter(d => d.erros.length > 0).length > 0 && (
                <Badge variant="destructive">{dadosProcessados.filter(d => d.erros.length > 0).length} com erros</Badge>
              )}
            </div>

            <div className="max-h-[400px] overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Linha</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">CPF</th>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Entrada</th>
                    <th className="p-2 text-left">Saída</th>
                    <th className="p-2 text-left">Horas</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosProcessados.slice(0, 50).map((d, i) => (
                    <tr key={i} className={d.erros.length > 0 ? "bg-destructive/5" : ""}>
                      <td className="p-2">{d.linha}</td>
                      <td className="p-2">{d.colaboradorNome}</td>
                      <td className="p-2">{d.colaboradorCpf}</td>
                      <td className="p-2">{d.data}</td>
                      <td className="p-2">{d.entrada || "—"}</td>
                      <td className="p-2">{d.saida || "—"}</td>
                      <td className="p-2">{d.horasTrabalhadas?.toFixed(1) || "—"}</td>
                      <td className="p-2">
                        {d.erros.length > 0 ? (
                          <span className="text-destructive" title={d.erros.join("; ")}>
                            <AlertCircle className="h-3.5 w-3.5 inline" /> {d.erros[0]}
                          </span>
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 inline" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">Importando... {progress}%</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEtapa("mapeamento")} size="sm" disabled={isProcessing}>Voltar</Button>
              <Button onClick={executarImportacao} size="sm" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Importar para Base de Dados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === "resultado" && resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" /> Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{resultado.importados}</p>
                <p className="text-xs text-muted-foreground">Novos registros</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{resultado.atualizados}</p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-destructive">{resultado.erros.length}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {resultado.erros.length > 0 && (
              <div className="max-h-[200px] overflow-auto rounded-lg border p-3">
                {resultado.erros.slice(0, 20).map((e: any, i: number) => (
                  <p key={i} className="text-xs text-destructive">Linha {e.linha}: {e.mensagem}</p>
                ))}
              </div>
            )}

            <Button onClick={resetar} size="sm">Nova Importação</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
