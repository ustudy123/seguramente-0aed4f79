import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, Loader2, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

// Dados fiscais/contábeis da própria YourEyes: um registro só, usado nos
// contratos (Programa de Parceiros e futuros) e em documentos emitidos pela casa.
type Dados = Record<string, string | null>;
const CAMPOS: { k: string; l: string; col?: string; hint?: string }[] = [
  { k: "razao_social", l: "Razão social", col: "sm:col-span-2" },
  { k: "nome_fantasia", l: "Nome fantasia" },
  { k: "cnpj", l: "CNPJ" },
  { k: "inscricao_estadual", l: "Inscrição estadual" },
  { k: "inscricao_municipal", l: "Inscrição municipal" },
  { k: "regime_tributario", l: "Regime tributário", hint: "Simples Nacional, Lucro Presumido…" },
  { k: "endereco", l: "Logradouro", col: "sm:col-span-2" },
  { k: "numero", l: "Número" },
  { k: "complemento", l: "Complemento" },
  { k: "bairro", l: "Bairro" },
  { k: "cidade", l: "Cidade" },
  { k: "uf", l: "UF" },
  { k: "cep", l: "CEP" },
  { k: "email_contato", l: "E-mail de contato (contratos)" },
  { k: "email_financeiro", l: "E-mail financeiro" },
  { k: "telefone", l: "Telefone" },
  { k: "site", l: "Site" },
  { k: "representante_nome", l: "Representante legal — nome" },
  { k: "representante_cargo", l: "Representante legal — cargo" },
  { k: "representante_cpf", l: "Representante legal — CPF", hint: "Sensível: só o SuperAdmin vê; não sai em contrato público." },
  { k: "foro_comarca", l: "Foro (comarca)", hint: "Usado na cláusula de solução de controvérsias. Vazio = cidade/UF da sede." },
];

export function YourEyesEmpresaPanel() {
  const qc = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "youreyes-empresa"],
    queryFn: async (): Promise<Dados | null> => { const { data, error } = await sb.from("youreyes_empresa").select("*").eq("id", 1).maybeSingle(); if (error) throw error; return data; },
  });
  const [f, setF] = useState<Dados>({});
  useEffect(() => { if (data) setF(data); }, [data]);
  const salvar = useMutation({
    mutationFn: async () => { const { error } = await sb.rpc("superadmin_youreyes_empresa_salvar", { _dados: f }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin", "youreyes-empresa"] }); toast.success("Dados da YourEyes salvos"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });
  return (
    <Card data-testid="youreyes-empresa-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Dados fiscais e contábeis da YourEyes</CardTitle>
        <CardDescription>Um único cadastro, usado como parte contratante nos contratos (Programa de Parceiros e futuros) e em documentos emitidos pela casa. <span className="inline-flex items-center gap-1 ml-1"><FileSignature className="w-3.5 h-3.5" />O Contrato de Parceria lê razão social, CNPJ, endereço, representante, e-mail e foro daqui.</span></CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="grid sm:grid-cols-3 gap-3">
            {CAMPOS.map((c) => (
              <div key={c.k} className={c.col}><Label className="text-xs">{c.l}</Label><Input value={f[c.k] ?? ""} onChange={(e) => setF((x) => ({ ...x, [c.k]: e.target.value }))} />{c.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</p>}</div>
            ))}
            <div className="sm:col-span-3"><Label className="text-xs">Observações internas</Label><Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => setF((x) => ({ ...x, observacoes: e.target.value }))} /></div>
            <div className="sm:col-span-3 flex justify-end"><Button onClick={() => salvar.mutate()} disabled={salvar.isPending} data-testid="youreyes-empresa-salvar">{salvar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Salvar</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
