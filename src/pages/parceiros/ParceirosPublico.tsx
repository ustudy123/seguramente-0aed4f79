import { Link } from "react-router-dom";
import { ArrowRight, Link2, Wallet, MapPin, Store, Handshake, TrendingUp } from "lucide-react";
import { ParceirosLayout } from "@/components/parceiro/ParceirosLayout";

// Seção pública "Parceiros" do site: o que é o programa e o convite para entrar.
// Números aqui são a regra do programa (níveis padrão), não dados de clientes.
const PASSOS = [
  { icone: <Handshake className="w-5 h-5" />, t: "Cadastre-se", d: "Indicador entra na hora. Representante, implantador, clínica e contabilidade passam por uma aprovação rápida da equipe." },
  { icone: <Link2 className="w-5 h-5" />, t: "Compartilhe seu link", d: "Cada conta que chegar pelo seu link fica registrada como sua, do primeiro clique ao cliente ativo." },
  { icone: <Wallet className="w-5 h-5" />, t: "Receba todo mês", d: "Comissão recorrente sobre a mensalidade dos seus clientes enquanto eles estiverem ativos. Fecha dia 25, paga até dia 10." },
];
const TIPOS = [
  { t: "Indicador", d: "Conhece empresas que precisam organizar RH e SST e quer ser remunerado por indicar." },
  { t: "Representante", d: "Apresenta a YourEyes, conduz a proposta e acompanha até o contrato." },
  { t: "Implantador", d: "Faz a implantação do cliente e recebe também pelo setup, além da recorrência." },
  { t: "Clínica de SST", d: "Atende os clientes na região e indica quem ainda não tem plataforma." },
  { t: "Contabilidade", d: "Leva a plataforma à carteira de clientes e integra a rotina de DP." },
];

export default function ParceirosPublico() {
  return (
    <ParceirosLayout>
      <section className="py-10 lg:py-16 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[#60ABEF] mb-3">Programa de Parceiros</div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">Cresça na sua região <span className="text-[#60ABEF]">indicando a YourEyes</span>.</h1>
          <p className="mt-5 text-lg text-slate-300 leading-relaxed">Clínicas, contabilidades, consultores e profissionais de SST ganham comissão recorrente por cada empresa que trazem para a plataforma, e podem ofertar seus próprios serviços na vitrine para todos os clientes.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/parceiros/cadastro" className="inline-flex items-center gap-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white font-semibold px-6 py-3 rounded-md transition">Quero ser parceiro <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/parceiros/entrar" className="inline-flex items-center gap-2 border border-white/20 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-md transition">Já sou parceiro</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-4">Como funciona a remuneração</div>
          <div className="space-y-4">
            <div className="flex items-start gap-3"><TrendingUp className="w-5 h-5 text-[#FF8A00] mt-0.5" /><div><div className="font-semibold text-white">Recorrente</div><div className="text-sm text-slate-300">Percentual da mensalidade de cada cliente ativo, todo mês. Começa em 25% e sobe com a sua carteira.</div></div></div>
            <div className="flex items-start gap-3"><Wallet className="w-5 h-5 text-[#60ABEF] mt-0.5" /><div><div className="font-semibold text-white">Setup e renovação</div><div className="text-sm text-slate-300">Implantador recebe pelo setup concluído. Toda renovação de ciclo rende bônus.</div></div></div>
            <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-emerald-400 mt-0.5" /><div><div className="font-semibold text-white">Leads da sua região</div><div className="text-sm text-slate-300">Empresas que chegam à YourEyes perto de você podem ser encaminhadas ao parceiro local.</div></div></div>
          </div>
        </div>
      </section>

      <section className="py-10 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white mb-6">Três passos</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PASSOS.map((p, i) => (
            <div key={p.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-[#60ABEF]">{p.icone}<span className="text-xs font-mono">0{i + 1}</span></div>
              <div className="mt-3 font-bold text-white">{p.t}</div>
              <p className="mt-1 text-sm text-slate-300">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white mb-2">Para quem é</h2>
        <p className="text-slate-300 mb-6">Uma identidade, dois papéis: todo parceiro pode também ofertar serviços no <Link to="/marketplace" className="text-[#60ABEF] underline-offset-2 hover:underline">Marketplace YourEyes</Link>, e todo profissional do Marketplace pode virar parceiro.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TIPOS.map((t) => (
            <div key={t.t} className="rounded-xl border border-white/10 p-4"><div className="font-semibold text-white">{t.t}</div><p className="text-xs text-slate-400 mt-1">{t.d}</p></div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3"><Store className="w-6 h-6 text-[#FF8A00]" /><div><div className="font-semibold text-white">Já é profissional do Marketplace?</div><div className="text-sm text-slate-300">Entre com a mesma conta e conclua o cadastro de parceiro em um minuto.</div></div></div>
          <Link to="/parceiros/cadastro" className="inline-flex items-center gap-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white font-semibold px-5 py-2.5 rounded-md transition">Virar parceiro <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>
    </ParceirosLayout>
  );
}
