import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, FileSignature, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { ParceirosLayout } from "@/components/parceiro/ParceirosLayout";
import { useParceiroPortal } from "@/hooks/useParceiroPortal";

// O texto do contrato vive no banco (parceiro_contratos_versoes) e é público,
// como os Termos de Uso. Quem é parceiro e tem versão nova pendente aceita aqui.
export default function ContratoParceria() {
  const { user, parceiroId } = useAuthContext();
  const { dados, refetch } = useParceiroPortal();
  const [versao, setVersao] = useState<{ versao: number; titulo: string; html: string; publicado_em: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aceitando, setAceitando] = useState(false);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("parceiro_contrato_publico");
      setVersao(data ?? null); setCarregando(false);
    })();
  }, []);

  const pendente = !!(user && parceiroId && dados?.contrato?.pendente);
  const aceitar = async () => {
    setAceitando(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("parceiro_aceitar_contrato", { _user_agent: navigator.userAgent });
      if (error) throw error;
      toast.success("Contrato aceito. Obrigado!"); await refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível registrar o aceite"); }
    finally { setAceitando(false); }
  };

  return (
    <ParceirosLayout titulo="Contrato de Parceria">
      <div className="max-w-3xl mx-auto">
        {carregando && <Loader2 className="w-6 h-6 animate-spin text-[#60ABEF]" />}
        {!carregando && !versao && <p className="text-slate-300">Nenhuma versão do contrato publicada ainda.</p>}
        {versao && (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-[#60ABEF] mb-2 flex items-center gap-2"><FileSignature className="w-4 h-4" />Versão {versao.versao} · publicada em {new Date(versao.publicado_em).toLocaleDateString("pt-BR")}</div>
                <p className="text-sm text-slate-400">O aceite acontece no cadastro de parceiro e gera uma cópia assinada com os seus dados, guardada pela YourEyes. Uma versão nova pede aceite de novo na Área do Parceiro.</p>
              </div>
              {pendente && <Button className="bg-[#FF8A00] hover:bg-[#e67a00] text-white" disabled={aceitando} onClick={aceitar} data-testid="contrato-aceitar">{aceitando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Aceito esta versão</Button>}
              {user && parceiroId && dados?.contrato && !dados.contrato.pendente && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300"><CheckCircle2 className="w-4 h-4" />Aceito em {dados.contrato.aceito_em ? new Date(dados.contrato.aceito_em).toLocaleDateString("pt-BR") : "—"}</span>}
              {!user && <Button asChild variant="outline" className="border-white/20 bg-transparent text-slate-200 hover:bg-white/10"><Link to="/parceiros/cadastro">Quero ser parceiro</Link></Button>}
            </div>
            {/* Conteúdo da casa (tabela própria, só superadmin escreve): render direto. */}
            <article className="prose prose-invert prose-sm max-w-none rounded-2xl border border-white/10 bg-white/[0.03] p-6 [&_h2]:text-white [&_h3]:text-[#60ABEF] [&_p]:text-slate-300" dangerouslySetInnerHTML={{ __html: versao.html }} />
          </>
        )}
      </div>
    </ParceirosLayout>
  );
}
