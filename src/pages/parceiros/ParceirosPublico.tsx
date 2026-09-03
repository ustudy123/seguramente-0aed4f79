import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONTATO_WHATSAPP, CONTATO_EMAIL } from "@/components/parceiro/ParceirosLayout";
import { ArrowRight, Link2, Wallet, MapPin, Store, Handshake, TrendingUp, MessageCircle, Mail, ChevronRight } from "lucide-react";
import { ParceirosLayout } from "@/components/parceiro/ParceirosLayout";

// Seção pública "Parceiros" do site: o que é o programa e o convite para entrar.
// Números aqui são a regra do programa (níveis padrão), não dados de clientes.
const PASSOS = [
  { icone: <Handshake className="w-5 h-5" />, t: "Cadastre-se", d: "Indicador entra na hora. Representante, implantador, clínica e contabilidade passam por uma aprovação rápida da equipe." },
  { icone: <Link2 className="w-5 h-5" />, t: "Compartilhe seu link", d: "Cada conta que chegar pelo seu link fica registrada como sua, do primeiro clique ao cliente ativo." },
  { icone: <Wallet className="w-5 h-5" />, t: "Receba todo mês", d: "Comissão recorrente sobre a mensalidade dos seus clientes enquanto eles estiverem ativos. Fecha dia 25, paga até dia 10." },
];
type TipoInfo = { t: string; d: string; quem: string; faz: string[]; ganha: string[]; aprovacao: string; requisitos: string };
const TIPOS: TipoInfo[] = [
  { t: "Indicador", d: "Conhece empresas que precisam organizar RH e SST e quer ser remunerado por indicar.",
    quem: "Consultores, profissionais de RH e SST, vendedores autônomos, qualquer pessoa com rede de empresas.",
    faz: ["Compartilha o link de indicação (site, WhatsApp, redes, eventos).", "Pode apresentar a YourEyes, mas a proposta e o contrato ficam com a equipe."],
    ganha: ["Comissão recorrente sobre a mensalidade de tabela de cada cliente ativo que chegou pelo seu link, todo mês, enquanto o cliente estiver ativo.", "Percentual pelo nível: começa em 25% (Visão) e sobe para 30% (Diamante) a partir de R$ 12.000 de MRR sob atendimento.", "Bônus de 2× a comissão em cada renovação de ciclo."],
    aprovacao: "Imediata: o cadastro já nasce ativo e o link funciona na hora.",
    requisitos: "Conta ativa, dados de contato e chave PIX para receber." },
  { t: "Representante", d: "Apresenta a YourEyes, conduz a proposta e acompanha até o contrato.",
    quem: "Profissionais com experiência comercial em RH, SST ou software para empresas.",
    faz: ["Prospecta e apresenta a plataforma com o material oficial.", "Conduz a proposta e acompanha o cliente até a assinatura.", "Pode receber leads da própria YourEyes na sua região."],
    ganha: ["Comissão recorrente pelos clientes atribuídos, no percentual do nível.", "Percentual específico para leads encaminhados pela casa.", "Bônus de renovação."],
    aprovacao: "Manual: a equipe YourEyes analisa o cadastro e pode pedir referências.",
    requisitos: "CNPJ ou CPF, experiência comercial comprovável, aceite do Contrato de Parceria." },
  { t: "Implantador", d: "Faz a implantação do cliente e recebe também pelo setup, além da recorrência.",
    quem: "Consultores de RH/DP e SST, analistas de sistemas de gestão de pessoas.",
    faz: ["Executa o onboarding do cliente: cadastros, colaboradores, escalas, documentos e treinamento.", "Segue o roteiro de implantação da YourEyes e reporta o andamento."],
    ganha: ["Valor de setup, pago uma vez por cliente quando a implantação é concluída (valor fixo, percentual da primeira mensalidade, ou ambos, conforme a tabela vigente).", "Se também indicou o cliente, soma a comissão recorrente.", "Bônus por go-live quando configurado."],
    aprovacao: "Manual, com capacitação prévia no roteiro de implantação.",
    requisitos: "Conhecimento de rotinas de DP/SST, disponibilidade para atender e aceite do contrato." },
  { t: "Clínica de SST", d: "Atende os clientes na região e indica quem ainda não tem plataforma.",
    quem: "Clínicas de medicina e segurança do trabalho, com corpo técnico registrado.",
    faz: ["Indica empresas da carteira e da região.", "Pode ser sugerida aos clientes indicados para atender exames, PGR/PCMSO e treinamentos pela vitrine (Marketplace).", "Pode atuar como implantadora se quiser."],
    ganha: ["Comissão recorrente pelas empresas indicadas.", "Receita própria pelos serviços prestados aos clientes via Marketplace.", "Bônus de renovação e, se implantar, setup."],
    aprovacao: "Manual: CNPJ, responsável técnico e registro no conselho.",
    requisitos: "CNPJ ativo, profissionais com registro (CRM, CREA, técnicos de segurança) e aceite do contrato." },
  { t: "Contabilidade", d: "Leva a plataforma à carteira de clientes e integra a rotina de DP.",
    quem: "Escritórios contábeis que cuidam da folha e do DP de empresas.",
    faz: ["Indica os clientes da própria carteira.", "Integra a rotina de ponto, férias, 13º e admissões com a plataforma.", "Pode atuar como implantadora."],
    ganha: ["Comissão recorrente pelas empresas indicadas, no percentual do nível.", "Setup quando implantar.", "Bônus de renovação."],
    aprovacao: "Manual: CNPJ e registro no CRC.",
    requisitos: "CNPJ ativo, responsável com CRC e aceite do contrato." },
];

export default function ParceirosPublico() {
  const [tipoAberto, setTipoAberto] = useState<TipoInfo | null>(null);
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
            <a href={CONTATO_WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#60ABEF] hover:text-white font-semibold px-4 py-3 transition"><MessageCircle className="w-4 h-4" />Fale conosco</a>
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
            <button key={t.t} type="button" onClick={() => setTipoAberto(t)} data-testid="tipo-parceiro-card"
              className="text-left rounded-xl border border-white/10 p-4 hover:border-[#60ABEF]/60 hover:bg-white/[0.04] transition group">
              <div className="font-semibold text-white flex items-center justify-between">{t.t}<ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#60ABEF]" /></div>
              <p className="text-xs text-slate-400 mt-1">{t.d}</p>
              <p className="text-[11px] text-[#60ABEF] mt-2">Ver detalhes</p>
            </button>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3"><Store className="w-6 h-6 text-[#FF8A00]" /><div><div className="font-semibold text-white">Já é profissional do Marketplace?</div><div className="text-sm text-slate-300">Entre com a mesma conta e conclua o cadastro de parceiro em um minuto.</div></div></div>
          <Link to="/parceiros/cadastro" className="inline-flex items-center gap-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white font-semibold px-5 py-2.5 rounded-md transition">Virar parceiro <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      <section className="py-10 border-t border-white/10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Ficou com dúvida? Fale conosco</h2>
            <p className="text-sm text-slate-300 mt-1">Conversamos sobre o modelo, a sua região e a melhor modalidade para o seu perfil antes de você se cadastrar. As regras completas estão no <Link to="/parceiros/contrato" className="text-[#60ABEF] hover:underline">Contrato de Parceria</Link>.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={CONTATO_WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1fb658] text-[#0B1D34] font-semibold px-4 py-2.5 rounded-md transition"><MessageCircle className="w-4 h-4" />WhatsApp</a>
            <a href={CONTATO_EMAIL} className="inline-flex items-center gap-2 border border-white/20 hover:bg-white/10 text-white font-semibold px-4 py-2.5 rounded-md transition"><Mail className="w-4 h-4" />E-mail</a>
          </div>
        </div>
      </section>

      <Dialog open={!!tipoAberto} onOpenChange={(o) => !o && setTipoAberto(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {tipoAberto && (
            <>
              <DialogHeader>
                <DialogTitle>{tipoAberto.t}</DialogTitle>
                <DialogDescription>{tipoAberto.d}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div><div className="font-semibold mb-1">Para quem é</div><p className="text-muted-foreground">{tipoAberto.quem}</p></div>
                <div><div className="font-semibold mb-1">O que faz</div><ul className="list-disc pl-5 space-y-1 text-muted-foreground">{tipoAberto.faz.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><div className="font-semibold mb-1">Como ganha</div><ul className="list-disc pl-5 space-y-1 text-muted-foreground">{tipoAberto.ganha.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Aprovação</div><p className="mt-1">{tipoAberto.aprovacao}</p></div>
                  <div className="rounded-lg border p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Requisitos</div><p className="mt-1">{tipoAberto.requisitos}</p></div>
                </div>
                <p className="text-xs text-muted-foreground">Níveis e valores vigentes constam na Área do Parceiro e no <Link to="/parceiros/contrato" className="text-primary underline underline-offset-2">Contrato de Parceria</Link>.</p>
                <div className="flex justify-end gap-2 pt-2">
                  <a href={CONTATO_WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border px-4 py-2 rounded-md text-sm font-medium hover:bg-muted"><MessageCircle className="w-4 h-4" />Fale conosco</a>
                  <Link to="/parceiros/cadastro" className="inline-flex items-center gap-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white px-4 py-2 rounded-md text-sm font-semibold">Quero ser {tipoAberto.t.toLowerCase()} <ArrowRight className="w-4 h-4" /></Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ParceirosLayout>
  );
}
