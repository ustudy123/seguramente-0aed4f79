import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Search, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_SERVICO } from "@/types/terceiros";
import type { Terceiro, TerceiroAcesso } from "@/types/terceiros";
import { formatCnpj, validateCnpj, buscarCnpj } from "@/lib/brasilapi";
import { formatCpf, validateCpf } from "@/lib/cpf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: Partial<Terceiro>) => Promise<void>;
  initial?: Terceiro | null;
  isPending?: boolean;
}

export function TerceiroForm({ open, onOpenChange, onSubmit, initial, isPending }: Props) {
  const { user, tenantId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [servicoSearch, setServicoSearch] = useState("");
  const [customServicos, setCustomServicos] = useState<string[]>([]);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [unidadesText, setUnidadesText] = useState((initial?.unidades || []).join(", "));
  const [setoresText, setSetoresText] = useState((initial?.setores || []).join(", "));
  const emptyForm: Partial<Terceiro> = {
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    atividade_principal: "",
    cnae: "",
    responsavel_nome: "",
    responsavel_cargo: "",
    email: "",
    telefone: "",
    tipo_servico: [],
    unidades: [],
    setores: [],
    tipo_acesso: "eventual",
    contrato_inicio: "",
    contrato_fim: "",
    atividade_risco: false,
    observacoes: "",
  };

  const [form, setForm] = useState<Partial<Terceiro>>(emptyForm);

  // Reseta o formulário ao abrir/fechar ou trocar o registro em edição
  useEffect(() => {
    if (!open) return;
    
    const base = initial || emptyForm;
    
    setForm({
      razao_social: base.razao_social || "",
      nome_fantasia: base.nome_fantasia || "",
      cnpj: base.cnpj || "",
      atividade_principal: base.atividade_principal || "",
      cnae: base.cnae || "",
      responsavel_nome: base.responsavel_nome || "",
      responsavel_cargo: base.responsavel_cargo || "",
      email: base.email || "",
      telefone: base.telefone || "",
      tipo_servico: base.tipo_servico || [],
      unidades: base.unidades || [],
      setores: base.setores || [],
      tipo_acesso: base.tipo_acesso || "eventual",
      contrato_inicio: base.contrato_inicio || "",
      contrato_fim: base.contrato_fim || "",
      atividade_risco: base.atividade_risco || false,
      observacoes: base.observacoes || "",
    });
    setUnidadesText((base.unidades || []).join(", "));
    setSetoresText((base.setores || []).join(", "));
    setCustomServicos([]);
    setServicoSearch("");
    setContractFile(null);
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const toggleServico = (s: string) => {
    const arr = form.tipo_servico || [];
    set("tipo_servico", arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  };

  const handleCnpjChange = (value: string) => {
    set("cnpj", formatCnpj(value));
  };

  const handleBuscarCnpj = useCallback(async () => {
    const cnpj = form.cnpj || "";
    if (!validateCnpj(cnpj)) {
      toast.error("Digite um CNPJ válido com 14 dígitos.");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const result = await buscarCnpj(cnpj);
      if (!result) {
        toast.error("CNPJ não encontrado na base da Receita Federal.");
        return;
      }
      setForm((p) => ({
        ...p,
        razao_social: result.razao_social || p.razao_social,
        nome_fantasia: result.nome_fantasia || p.nome_fantasia,
        atividade_principal: result.cnae_fiscal_descricao || p.atividade_principal,
        cnae: result.cnae_fiscal ? String(result.cnae_fiscal) : p.cnae,
        email: result.email || p.email,
        telefone: result.telefone || p.telefone,
      }));
      toast.success("Dados do CNPJ preenchidos automaticamente!");
    } catch {
      toast.error("Erro ao consultar CNPJ.");
    } finally {
      setBuscandoCnpj(false);
    }
  }, [form.cnpj]);

  const handleSubmit = async () => {
    if (!form.razao_social || !form.cnpj) return;
    
    // Clean empty date strings to null to avoid "invalid input syntax for type date" in Postgres
    const submissionData = {
      ...form,
      contrato_inicio: form.contrato_inicio || null,
      contrato_fim: form.contrato_fim || null,
    };
    
    try {
      // First create/update the third party
      const result = await (onSubmit(submissionData) as any);
      
      // If there's a contract file, upload it to terceiro_documentos
      if (contractFile && result?.id) {
        setUploadingContract(true);
        const ts = Date.now();
        const safeName = contractFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `${tenantId}/terceiros/${result.id}/contratos/${ts}_${safeName}`;
        
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, contractFile);
          
        if (upErr) throw upErr;

        await supabase.from("terceiro_documentos" as any).insert({
          tenant_id: tenantId,
          terceiro_id: result.id,
          tipo: "Contrato",
          nome: `Contrato Original - ${contractFile.name}`,
          arquivo_url: path,
          arquivo_nome: contractFile.name,
          arquivo_tamanho: contractFile.size,
          status: "valido",
          criado_por: user?.id,
        });
      }
      
      onOpenChange(false);
      setContractFile(null);
    } catch (error: any) {
      console.error("Erro ao salvar terceiro:", error);
    } finally {
      setUploadingContract(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Terceiro" : "Novo Terceiro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>CNPJ *</Label>
            <div className="flex gap-1">
              <Input value={form.cnpj || ""} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
              <Button type="button" variant="outline" size="icon" onClick={handleBuscarCnpj} disabled={buscandoCnpj || !validateCnpj(form.cnpj || "")} title="Buscar dados na Receita Federal">
                {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Razão Social *</Label>
              <Input value={form.razao_social || ""} onChange={(e) => set("razao_social", e.target.value)} />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia || ""} onChange={(e) => set("nome_fantasia", e.target.value)} />
            </div>
            <div>
              <Label>CNAE</Label>
              <Input value={form.cnae || ""} onChange={(e) => set("cnae", e.target.value)} />
            </div>
            <div>
              <Label>Atividade Principal</Label>
              <Input value={form.atividade_principal || ""} onChange={(e) => set("atividade_principal", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Responsável Técnico</Label>
              <Input value={form.responsavel_nome || ""} onChange={(e) => set("responsavel_nome", e.target.value)} />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={form.responsavel_cargo || ""} onChange={(e) => set("responsavel_cargo", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone || ""} onChange={(e) => set("telefone", e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Tipo de Serviço</Label>
            {/* Selected services */}
            {(form.tipo_servico || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1 mb-2">
                {(form.tipo_servico || []).map((s) => (
                  <Badge key={s} variant="default" className="cursor-pointer" onClick={() => toggleServico(s)}>
                    {s}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar ou adicionar tipo de serviço..."
                value={servicoSearch}
                onChange={(e) => setServicoSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && servicoSearch.trim()) {
                    e.preventDefault();
                    const val = servicoSearch.trim();
                    if (!(form.tipo_servico || []).includes(val)) {
                      if (!TIPOS_SERVICO.includes(val) && !customServicos.includes(val)) {
                        setCustomServicos((p) => [...p, val]);
                      }
                      toggleServico(val);
                    }
                    setServicoSearch("");
                  }
                }}
              />
            </div>
            {/* Dropdown suggestions */}
            {servicoSearch && (
              <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-background shadow-sm">
                {[...TIPOS_SERVICO, ...customServicos]
                  .filter((s) => s.toLowerCase().includes(servicoSearch.toLowerCase()) && !(form.tipo_servico || []).includes(s))
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { toggleServico(s); setServicoSearch(""); }}
                    >
                      {s}
                    </button>
                  ))}
                {![...TIPOS_SERVICO, ...customServicos].some((s) => s.toLowerCase() === servicoSearch.toLowerCase().trim()) && servicoSearch.trim() && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors font-medium"
                    onClick={() => {
                      const val = servicoSearch.trim();
                      setCustomServicos((p) => [...p, val]);
                      toggleServico(val);
                      setServicoSearch("");
                    }}
                  >
                    + Adicionar "{servicoSearch.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Unidades onde atua</Label>
              <Input
                value={unidadesText}
                onChange={(e) => {
                  setUnidadesText(e.target.value);
                  set("unidades", e.target.value.split(",").map((s) => s.trim()).filter(Boolean));
                }}
                onBlur={() => setUnidadesText((form.unidades || []).join(", "))}
                placeholder="Ex: Matriz, Filial SP (separar por vírgula)"
              />
            </div>
            <div>
              <Label>Setores onde pode atuar</Label>
              <Input
                value={setoresText}
                onChange={(e) => {
                  setSetoresText(e.target.value);
                  set("setores", e.target.value.split(",").map((s) => s.trim()).filter(Boolean));
                }}
                onBlur={() => setSetoresText((form.setores || []).join(", "))}
                placeholder="Ex: Produção, Manutenção (separar por vírgula)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de Acesso</Label>
              <Select value={form.tipo_acesso} onValueChange={(v) => set("tipo_acesso", v as TerceiroAcesso)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eventual">Eventual</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="continuo">Contínuo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Início do Contrato</Label>
              <Input type="date" value={form.contrato_inicio || ""} onChange={(e) => set("contrato_inicio", e.target.value)} />
            </div>
            <div>
              <Label>Fim do Contrato</Label>
              <Input type="date" value={form.contrato_fim || ""} onChange={(e) => set("contrato_fim", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <Switch checked={form.atividade_risco || false} onCheckedChange={(v) => set("atividade_risco", v)} />
            <div>
              <p className="text-sm font-medium">Este terceiro executa atividade com risco?</p>
              <p className="text-xs text-muted-foreground">Se sim, controles obrigatórios serão ativados automaticamente.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contrato Social / Prestação de Serviço</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={(e) => setContractFile(e.target.files?.[0] || null)}
              />
              {contractFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">{contractFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setContractFile(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Clique para anexar o arquivo do contrato</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.razao_social || !form.cnpj || isPending || uploadingContract}>
              {isPending || uploadingContract ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {initial ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
