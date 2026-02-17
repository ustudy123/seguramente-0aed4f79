import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Upload, Plus, Trash2, Package, Building2, Calendar, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NFData, NFItemData, NFXmlParsed, parseNFeXml } from "@/hooks/useImportacaoNF";

interface ImportacaoNFFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NFData) => Promise<any>;
  epis: any[];
  tipos?: any[];
  locais: any[];
  isLoading: boolean;
}

interface ItemForm extends NFItemData {
  _key: string;
  _descricaoOriginal?: string;
}

export function ImportacaoNFForm({
  open,
  onOpenChange,
  onSubmit,
  epis,
  tipos = [],
  locais,
  isLoading,
}: ImportacaoNFFormProps) {
  const [tab, setTab] = useState<string>("xml");
  const [xmlParsed, setXmlParsed] = useState<NFXmlParsed | null>(null);
  const [xmlError, setXmlError] = useState<string>("");

  // Header fields
  const [numeroNf, setNumeroNf] = useState("");
  const [serie, setSerie] = useState("");
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [fornecedorCnpj, setFornecedorCnpj] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Items
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [localPadrao, setLocalPadrao] = useState("");

  const locaisAtivos = locais.filter((l: any) => l.ativo);

  const resetForm = () => {
    setXmlParsed(null);
    setXmlError("");
    setNumeroNf("");
    setSerie("");
    setChaveAcesso("");
    setFornecedorCnpj("");
    setFornecedorNome("");
    setDataEmissao("");
    setValorTotal("");
    setObservacoes("");
    setItens([]);
    setLocalPadrao("");
    setTab("xml");
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setXmlError("");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseNFeXml(content);
        setXmlParsed(parsed);

        // Fill header
        setNumeroNf(parsed.numero_nf);
        setSerie(parsed.serie);
        setChaveAcesso(parsed.chave_acesso);
        setFornecedorCnpj(parsed.fornecedor_cnpj);
        setFornecedorNome(parsed.fornecedor_nome);
        setDataEmissao(parsed.data_emissao);
        setValorTotal(String(parsed.valor_total || ""));

        // Fill items (user needs to map epi_id)
        setItens(
          parsed.itens.map((item, idx) => ({
            _key: `xml-${idx}`,
            _descricaoOriginal: item.descricao,
            epi_id: "",
            local_estoque_id: localPadrao,
            descricao_nf: item.descricao,
            quantidade: Math.round(item.quantidade),
            valor_unitario: item.valor_unitario,
            valor_total: item.valor_total,
          }))
        );
      } catch (err: any) {
        setXmlError(err.message || "Erro ao processar XML");
        setXmlParsed(null);
      }
    };
    reader.readAsText(file);
  }, [localPadrao]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/xml": [".xml"], "application/xml": [".xml"] },
    maxFiles: 1,
  });

  const addManualItem = () => {
    setItens((prev) => [
      ...prev,
      {
        _key: `manual-${Date.now()}`,
        epi_id: "",
        local_estoque_id: localPadrao,
        descricao_nf: "",
        quantidade: 1,
        valor_unitario: undefined,
        valor_total: undefined,
      },
    ]);
  };

  const removeItem = (key: string) => {
    setItens((prev) => prev.filter((i) => i._key !== key));
  };

  const updateItem = (key: string, field: keyof ItemForm, value: any) => {
    setItens((prev) =>
      prev.map((i) => (i._key === key ? { ...i, [field]: value } : i))
    );
  };

  const applyLocalToAll = (localId: string) => {
    setLocalPadrao(localId);
    setItens((prev) => prev.map((i) => ({ ...i, local_estoque_id: localId })));
  };

  const canSubmit =
    numeroNf.trim() &&
    itens.length > 0 &&
    itens.every((i) => i.epi_id && i.local_estoque_id && i.quantidade > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const data: NFData = {
      numero_nf: numeroNf,
      serie: serie || undefined,
      chave_acesso: chaveAcesso || undefined,
      fornecedor_cnpj: fornecedorCnpj || undefined,
      fornecedor_nome: fornecedorNome || undefined,
      data_emissao: dataEmissao || undefined,
      valor_total: valorTotal ? parseFloat(valorTotal) : undefined,
      observacoes: observacoes || undefined,
      origem: tab === "xml" && xmlParsed ? "xml" : "manual",
      itens: itens.map(({ _key, _descricaoOriginal, ...rest }) => rest),
    };
    await onSubmit(data);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Importação de Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            Importe itens de EPI via XML da NF-e ou cadastre manualmente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="xml">
              <Upload className="w-4 h-4 mr-2" />
              Upload XML
            </TabsTrigger>
            <TabsTrigger value="manual">
              <FileText className="w-4 h-4 mr-2" />
              Entrada Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="xml" className="space-y-4 mt-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive ? "Solte o arquivo aqui..." : "Arraste o XML da NF-e ou clique para selecionar"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .xml</p>
            </div>

            {xmlError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {xmlError}
              </div>
            )}

            {xmlParsed && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">XML Importado</Badge>
                    <span className="text-sm font-medium">NF {xmlParsed.numero_nf}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <span>Fornecedor: {xmlParsed.fornecedor_nome}</span>
                    <span>CNPJ: {xmlParsed.fornecedor_cnpj}</span>
                    <span>Emissão: {xmlParsed.data_emissao}</span>
                    <span>Valor: R$ {xmlParsed.valor_total?.toFixed(2)}</span>
                  </div>
                  <p className="text-sm">{xmlParsed.itens.length} item(ns) encontrado(s)</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Nº da NF *</Label>
                <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} placeholder="000123" />
              </div>
              <div>
                <Label>Série</Label>
                <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="1" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Fornecedor</Label>
                <Input value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} placeholder="Nome do fornecedor" />
              </div>
              <div>
                <Label>CNPJ Fornecedor</Label>
                <Input value={fornecedorCnpj} onChange={(e) => setFornecedorCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Data Emissão</Label>
                <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
              </div>
              <div>
                <Label>Valor Total (R$)</Label>
                <Input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div>
              <Label>Chave de Acesso</Label>
              <Input value={chaveAcesso} onChange={(e) => setChaveAcesso(e.target.value)} placeholder="44 dígitos (opcional)" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Local padrão + Items section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Itens da Nota</h4>
            <div className="flex items-center gap-2">
              <Select value={localPadrao} onValueChange={applyLocalToAll}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Local padrão p/ todos" />
                </SelectTrigger>
                <SelectContent>
                  {locaisAtivos.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={addManualItem}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Item
              </Button>
            </div>
          </div>

          {itens.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {tab === "xml" ? "Faça upload do XML para extrair os itens" : "Adicione itens manualmente"}
            </div>
          )}

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {itens.map((item, idx) => (
              <Card key={item._key} className="relative">
                <CardContent className="pt-3 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Item {idx + 1}
                      {item._descricaoOriginal && (
                        <span className="ml-2 text-foreground">{item._descricaoOriginal}</span>
                      )}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item._key)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">EPI *</Label>
                      <Select value={item.epi_id} onValueChange={(v) => updateItem(item._key, "epi_id", v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione o EPI" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.length > 0 ? (
                            tipos.filter((t: any) => t.is_active !== false).map((tipo: any) => {
                              // Find the corresponding epi record for this tipo
                              const epiRecord = epis.find((e: any) => e.tipo_id === tipo.id);
                              const value = epiRecord?.id || tipo.id;
                              return (
                                <SelectItem key={tipo.id} value={value}>
                                  {tipo.nome}{tipo.categoria ? ` (${tipo.categoria})` : ""}{tipo.ca_numero ? ` - CA: ${tipo.ca_numero}` : ""}
                                </SelectItem>
                              );
                            })
                          ) : (
                            epis.map((epi: any) => (
                              <SelectItem key={epi.id} value={epi.id}>
                                {epi.tipo?.nome || "EPI"} - {epi.codigo || epi.id.substring(0, 8)}
                              </SelectItem>
                            ))
                          )}
                          {tipos.length === 0 && epis.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum EPI cadastrado</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Qtd *</Label>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-xs"
                        value={item.quantidade}
                        onChange={(e) => updateItem(item._key, "quantidade", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Local *</Label>
                      <Select
                        value={item.local_estoque_id}
                        onValueChange={(v) => updateItem(item._key, "local_estoque_id", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Local" />
                        </SelectTrigger>
                        <SelectContent>
                          {locaisAtivos.map((l: any) => (
                            <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Descrição NF</Label>
                      <Input
                        className="h-8 text-xs"
                        value={item.descricao_nf || ""}
                        onChange={(e) => updateItem(item._key, "descricao_nf", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">V. Unitário</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={item.valor_unitario || ""}
                        onChange={(e) => updateItem(item._key, "valor_unitario", parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">V. Total</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={item.valor_total || ""}
                        onChange={(e) => updateItem(item._key, "valor_total", parseFloat(e.target.value) || undefined)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isLoading}>
            {isLoading ? "Importando..." : `Importar ${itens.length} item(ns)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
