import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { ParceirosLayout } from "@/components/parceiro/ParceirosLayout";
import { PARCEIRO_TIPO_LABEL, type ParceiroTipo } from "@/hooks/useParceiros";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// Dois caminhos, um formulário:
//  * visitante sem conta → Edge Function parceiro-cadastro (cria a conta e o parceiro);
//  * quem já está logado (cliente, profissional do Marketplace) → função SQL parceiro_cadastrar.
export default function CadastroParceiro() {
  const navigate = useNavigate();
  const { user, parceiroId, signIn, loading: authLoading } = useAuthContext();
  const [f, setF] = useState({ nome: "", email: user?.email ?? "", senha: "", tipo_parceiro: "indicador" as ParceiroTipo, tipo_pessoa: "pj", documento: "", telefone: "", cidade: "", uf: "", cep: "", aceite: false });
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  if (!authLoading && user && parceiroId) {
    return (
      <ParceirosLayout>
        <div className="max-w-lg mx-auto text-center py-16 space-y-4">
          <h1 className="text-2xl font-bold text-white">Você já é parceiro YourEyes</h1>
          <Button asChild className="bg-[#FF8A00] hover:bg-[#e67a00] text-white"><Link to="/parceiro">Abrir meu painel</Link></Button>
        </div>
      </ParceirosLayout>
    );
  }

  const enviar = async () => {
    if (f.nome.trim().length < 3) return toast.error("Informe o nome");
    if (!f.aceite) return toast.error("É preciso aceitar os termos do programa");
    setEnviando(true);
    try {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("parceiro_cadastrar", { _dados: { ...f, aceite_termos: true, user_agent: navigator.userAgent } });
        if (error) throw error;
        toast.success(data?.status === "ativo" ? "Cadastro concluído. Bem-vindo!" : "Cadastro enviado para aprovação.");
        window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/parceiro`);
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return toast.error("E-mail inválido");
      if (f.senha.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres");
      const { data, error } = await supabase.functions.invoke("parceiro-cadastro", { body: { ...f, aceite_termos: true, user_agent: navigator.userAgent } });
      const erro = error ? (await extrairErro(error)) : data?.error;
      if (erro) {
        if (/Já existe uma conta/i.test(erro)) { toast.warning(erro); navigate("/parceiros/entrar"); return; }
        throw new Error(erro);
      }
      toast.success(data?.status === "ativo" ? "Cadastro concluído. Entrando…" : "Cadastro enviado para aprovação. Entrando…");
      const { error: loginErr } = await signIn(f.email, f.senha);
      if (loginErr) { navigate("/parceiros/entrar"); return; }
      navigate("/parceiro", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir o cadastro");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ParceirosLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white">Quero ser parceiro</h1>
        <p className="text-slate-300 mt-2">{user ? `Você está entrando com a conta ${user.email}. O cadastro de parceiro fica ligado a ela.` : "Crie sua conta e o seu link em um minuto. Já tem conta YourEyes (cliente ou profissional do Marketplace)? "}{!user && <Link to="/parceiros/entrar" className="text-[#60ABEF] hover:underline">Entre primeiro</Link>}</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2"><Label className="text-slate-300">Nome ou razão social*</Label><Input data-testid="cad-nome" className="bg-black/20 border-white/15 text-white" value={f.nome} onChange={(e) => set("nome", e.target.value)} /></div>
          <div><Label className="text-slate-300">Tipo de parceiro</Label>
            <Select value={f.tipo_parceiro} onValueChange={(v) => set("tipo_parceiro", v)}>
              <SelectTrigger className="bg-black/20 border-white/15 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(PARCEIRO_TIPO_LABEL) as ParceiroTipo[]).map((t) => <SelectItem key={t} value={t}>{PARCEIRO_TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500 mt-1">{f.tipo_parceiro === "indicador" ? "Indicador entra ativo na hora." : "Este tipo passa por aprovação da equipe YourEyes."}</p>
          </div>
          <div><Label className="text-slate-300">Pessoa</Label>
            <Select value={f.tipo_pessoa} onValueChange={(v) => set("tipo_pessoa", v)}>
              <SelectTrigger className="bg-black/20 border-white/15 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pj">Jurídica (CNPJ)</SelectItem><SelectItem value="pf">Física (CPF)</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label className="text-slate-300">{f.tipo_pessoa === "pf" ? "CPF" : "CNPJ"}</Label><Input className="bg-black/20 border-white/15 text-white" value={f.documento} onChange={(e) => set("documento", e.target.value)} /></div>
          <div><Label className="text-slate-300">Telefone / WhatsApp</Label><Input className="bg-black/20 border-white/15 text-white" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} /></div>
          <div><Label className="text-slate-300">Cidade</Label><Input className="bg-black/20 border-white/15 text-white" value={f.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-slate-300">UF</Label>
              <Select value={f.uf} onValueChange={(v) => set("uf", v)}>
                <SelectTrigger className="bg-black/20 border-white/15 text-white"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-slate-300">CEP</Label><Input className="bg-black/20 border-white/15 text-white" value={f.cep} onChange={(e) => set("cep", e.target.value)} /></div>
          </div>
          {!user && (
            <>
              <div><Label className="text-slate-300">E-mail de acesso*</Label><Input type="email" autoComplete="email" className="bg-black/20 border-white/15 text-white" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label className="text-slate-300">Senha*</Label><Input type="password" autoComplete="new-password" className="bg-black/20 border-white/15 text-white" value={f.senha} onChange={(e) => set("senha", e.target.value)} /></div>
            </>
          )}
          <div className="col-span-2 flex items-start gap-2 text-sm text-slate-300">
            <Checkbox id="aceite" checked={f.aceite} onCheckedChange={(v) => set("aceite", v === true)} className="mt-0.5 border-white/40" />
            <label htmlFor="aceite">Li e aceito o <Link to="/parceiros/contrato" className="text-[#60ABEF] hover:underline" target="_blank">Contrato de Parceria Comercial</Link> (remuneração, atribuição, confidencialidade, não concorrência) e os <Link to="/termos-de-uso" className="text-[#60ABEF] hover:underline" target="_blank">Termos de Uso</Link>. O aceite fica registrado com data, versão e origem.</label>
          </div>
          <div className="col-span-2 flex justify-end">
            <Button className="bg-[#FF8A00] hover:bg-[#e67a00] text-white" disabled={enviando} onClick={enviar} data-testid="cad-enviar">{enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Concluir cadastro</Button>
          </div>
        </div>
      </div>
    </ParceirosLayout>
  );
}

async function extrairErro(error: unknown): Promise<string> {
  // FunctionsHttpError carrega a resposta; o corpo tem { error }.
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try { const b = await ctx.json(); if (b?.error) return String(b.error); } catch { /* segue */ }
  }
  return error instanceof Error ? error.message : "Falha ao cadastrar";
}
