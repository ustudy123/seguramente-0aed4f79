import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, CheckCheck, Search } from "lucide-react";
import { buscarCnpj, cleanCnpj, formatCnpj } from "@/lib/brasilapi";
import type { Cliente } from "./types";

export function StepEmpresa({ cliente, onConcluir }: { cliente: Cliente; onConcluir: () => void }) {
  const [form, setForm] = useState({
    razao_social: cliente.nome_empresa || '',
    cnpj: cliente.cnpj || '',
    cnae: '',
    quantidade_colaboradores: cliente.quantidade_colaboradores?.toString() || '',
    cidade: '',
    segmento: cliente.segmento || '',
    responsavel: cliente.poc_nome || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const handleBuscarCnpj = useCallback(async () => {
    const clean = cleanCnpj(form.cnpj);
    if (clean.length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const result = await buscarCnpj(clean);
      if (result) {
        setForm(f => ({
          ...f,
          razao_social: result.razao_social || f.razao_social,
          cnae: String(result.cnae_fiscal) || f.cnae,
          cidade: result.municipio || f.cidade,
        }));
        toast.success("Dados do CNPJ carregados!");
      } else {
        toast.error("CNPJ não encontrado");
      }
    } catch {
      toast.error("Erro ao buscar CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  }, [form.cnpj]);

  const handleCnpjChange = (value: string) => {
    setForm(f => ({ ...f, cnpj: formatCnpj(value) }));
  };

  async function salvar() {
    if (!form.razao_social || !form.cnpj) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSalvando(true);
    try {
      await supabase.rpc('atualizar_cliente_por_onboarding_token', {
          p_token: cliente.onboarding_token,
          p_nome_empresa: form.razao_social,
          p_cnpj: form.cnpj,
          p_segmento: form.segmento,
          p_quantidade_colaboradores: parseInt(form.quantidade_colaboradores) || null,
        });
      toast.success("Dados salvos com sucesso!");
      onConcluir();
    } catch (e) {
      toast.error("Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Vamos configurar sua empresa</p>
          <p className="text-xs text-muted-foreground mt-1">
            Para que o sistema gere os primeiros indicadores organizacionais, precisamos das informações básicas da empresa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="razao">Razão Social *</Label>
          <Input id="razao" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="cnpj">CNPJ *</Label>
          <Input id="cnpj" value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} className="mt-1" placeholder="00.000.000/0000-00" />
        </div>
        <div>
          <Label htmlFor="cnae">CNAE</Label>
          <Input id="cnae" value={form.cnae} onChange={e => setForm(f => ({ ...f, cnae: e.target.value }))} className="mt-1" placeholder="Ex: 6201-5/01" />
        </div>
        <div>
          <Label htmlFor="qtd">Número de Colaboradores</Label>
          <Input id="qtd" type="number" value={form.quantidade_colaboradores} onChange={e => setForm(f => ({ ...f, quantidade_colaboradores: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="segmento">Segmento</Label>
          <Input id="segmento" value={form.segmento} onChange={e => setForm(f => ({ ...f, segmento: e.target.value }))} className="mt-1" placeholder="Ex: Construção Civil" />
        </div>
        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="resp">Responsável Principal</Label>
          <Input id="resp" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} className="mt-1" />
        </div>
      </div>

      <Button onClick={salvar} disabled={salvando} className="w-full">
        {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
        Confirmar Dados da Empresa
      </Button>
    </div>
  );
}
