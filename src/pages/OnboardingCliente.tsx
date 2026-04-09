import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, ChevronRight, Building2, Users,
  FileText, ArrowRight, Sparkles, AlertCircle, Loader2, CheckCheck,
  BarChart3, Shield, Rocket, Star, Download
} from "lucide-react";

import type { Cliente, Contrato, DocumentoLink } from "./onboarding-cliente/types";
import { FaseProgress } from "./onboarding-cliente/FaseProgress";
import { ChecklistItem } from "./onboarding-cliente/ChecklistItem";
import { StepEmpresa } from "./onboarding-cliente/StepEmpresa";
import { StepColaboradores } from "./onboarding-cliente/StepColaboradores";
import { StepDiagnostico } from "./onboarding-cliente/StepDiagnostico";
import { calcularNivelMaturidade, downloadDoc } from "./onboarding-cliente/utils";

export default function OnboardingCliente() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [stepAtivo, setStepAtivo] = useState<string | null>(null);

  const { data: cliente, isLoading, error } = useQuery({
    queryKey: ['onboarding-cliente', token],
    queryFn: async (): Promise<Cliente | null> => {
      if (!token) return null;
      const { data: rows, error } = await supabase
        .rpc('buscar_cliente_por_onboarding_token', { p_token: token });
      if (error) throw error;
      return (rows?.[0] as unknown as Cliente) || null;
    },
    enabled: !!token,
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['onboarding-contratos', cliente?.id],
    queryFn: async (): Promise<Contrato[]> => {
      if (!cliente?.id) return [];
      const { data } = await supabase
        .rpc('buscar_contratos_por_cliente', { p_cliente_id: cliente.id });
      return (data || []) as unknown as Contrato[];
    },
    enabled: !!cliente?.id,
    refetchInterval: 15000,
  });

  const { data: docLinks = [] } = useQuery({
    queryKey: ['onboarding-doclinks', cliente?.id],
    queryFn: async (): Promise<DocumentoLink[]> => {
      if (!cliente?.id) return [];
      const { data } = await supabase
        .rpc('buscar_doc_links_por_cliente', { p_cliente_id: cliente.id });
      return (data || []) as unknown as DocumentoLink[];
    },
    enabled: !!cliente?.id,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando seu portal de implantação...</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
            <p className="text-sm text-muted-foreground">
              Este link de onboarding não é válido. Entre em contato com a equipe Seguramente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const contratoAtivo = contratos[0];
  const ataLink = docLinks.find(d => d.tipo === 'ata_kickoff');
  const contratoAssinado = contratoAtivo?.status === 'assinado';
  const ataAceita = ataLink?.status === 'aceito';
  const maturidade = calcularNivelMaturidade(cliente.quantidade_colaboradores);

  const checklistItems = [
    {
      id: 'contrato',
      label: cliente.tipo_cliente === 'pagante' ? 'Contrato de Licença de Uso' : 'Contrato Programa Validador',
      sublabel: contratoAssinado ? `Assinado em ${contratoAtivo?.assinado_em ? new Date(contratoAtivo.assinado_em).toLocaleDateString('pt-BR') : '-'}` : 'Assinatura digital obrigatória para prosseguir',
      done: contratoAssinado,
      pending: !!contratoAtivo && !contratoAssinado,
      link: contratoAtivo && !contratoAssinado ? `${window.location.origin}/contrato-assinatura/${contratoAtivo.token}` : undefined,
      downloadHtml: contratoAssinado && contratoAtivo?.html_assinado ? contratoAtivo.html_assinado : null,
      downloadNome: 'Contrato-Programa-Validador-Assinado.html',
    },
    {
      id: 'ata',
      label: 'Ata de Kickoff',
      sublabel: ataAceita ? `Assinada em ${ataLink?.aceito_em ? new Date(ataLink.aceito_em).toLocaleDateString('pt-BR') : '-'}` : ataLink ? 'Aguardando sua assinatura' : 'Será disponibilizada pela equipe Seguramente',
      done: ataAceita,
      pending: !!ataLink && !ataAceita,
      link: ataLink && !ataAceita ? `${window.location.origin}/aceite-documento/${ataLink.token}` : undefined,
      downloadHtml: ataAceita && ataLink ? (ataLink.html_assinado || ataLink.html_documento) : null,
      downloadNome: 'Ata-Kickoff-Assinada.html',
    },
    {
      id: 'empresa',
      label: 'Cadastro da Empresa',
      sublabel: 'Dados básicos para configuração do sistema',
      done: !!cliente.cnpj,
      pending: false,
      downloadHtml: null,
      downloadNome: '',
    },
    {
      id: 'colaboradores',
      label: 'Estrutura Organizacional',
      sublabel: 'Colaboradores, departamentos e funções',
      done: false,
      pending: false,
      downloadHtml: null,
      downloadNome: '',
    },
    {
      id: 'diagnostico',
      label: 'Diagnóstico Inicial',
      sublabel: maturidade.modulo,
      done: false,
      pending: false,
      downloadHtml: null,
      downloadNome: '',
    },
  ];

  const concluidos = checklistItems.filter(c => c.done).length;
  const progresso = Math.round((concluidos / checklistItems.length) * 100);
  const proximoPasso = checklistItems.find(c => !c.done);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/3">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Seguramente</p>
              <p className="text-xs text-muted-foreground">Portal de Implantação</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{cliente.nome_empresa}</p>
            <p className="text-xs text-muted-foreground">{cliente.poc_nome}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold">Jornada de Implantação</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Acompanhe o progresso da sua implantação</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{progresso}%</p>
              <p className="text-xs text-muted-foreground">concluído</p>
            </div>
          </div>
          <FaseProgress fase={cliente.fase} />
          <div className="mt-5">
            <Progress value={progresso} className="h-2" />
          </div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border border-primary/15 rounded-2xl p-5"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold">
                Bem-vindo ao Seguramente{cliente.poc_nome ? `, ${cliente.poc_nome.split(' ')[0]}` : ''}! 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Vamos configurar a <strong>{cliente.nome_empresa}</strong> para que o sistema possa gerar os primeiros indicadores organizacionais.
                Siga o assistente de implantação abaixo.
              </p>
              {proximoPasso && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <span className="text-primary font-medium">Próximo: {proximoPasso.label}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Checklist de Implantação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {checklistItems.map(item => (
                  <div key={item.id}>
                    <ChecklistItem
                      label={item.label}
                      sublabel={item.sublabel}
                      done={item.done}
                      pending={item.pending}
                      link={item.link}
                      onClick={!item.done && ['empresa', 'colaboradores', 'diagnostico'].includes(item.id) ? () => setStepAtivo(item.id) : undefined}
                    />
                    {item.done && item.downloadHtml && (
                      <button
                        onClick={() => downloadDoc(item.downloadHtml!, item.downloadNome)}
                        className="ml-7 mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="w-3 h-3" /> Baixar documento assinado
                      </button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-primary/10 bg-primary/3">
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perfil da Empresa</p>
                <div className="flex items-center gap-2">
                  {[1,2,3].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= maturidade.nivel ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}`} />
                  ))}
                  <span className={`text-sm font-bold ${maturidade.cor}`}>{maturidade.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{maturidade.descricao}</p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Assistente de Implantação
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <AnimatePresence mode="wait">
                  {!stepAtivo && (
                    <motion.div
                      key="welcome"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {[
                        {
                          id: 'contrato',
                          icon: <FileText className="w-5 h-5" />,
                          title: cliente.tipo_cliente === 'pagante' ? 'Contrato de Licença de Uso' : 'Contrato Programa Validador',
                          desc: contratoAssinado ? 'Contrato assinado por todas as partes.' : 'Assinatura digital do contrato com todos os anexos jurídicos.',
                          done: contratoAssinado,
                          action: contratoAtivo && !contratoAssinado ? () => window.open(`${window.location.origin}/contrato-assinatura/${contratoAtivo.token}`, '_blank') : undefined,
                          actionLabel: 'Assinar agora',
                          downloadHtml: contratoAssinado && contratoAtivo?.html_assinado ? contratoAtivo.html_assinado : null,
                          downloadNome: 'Contrato-Programa-Validador-Assinado.html',
                        },
                        {
                          id: 'ata',
                          icon: <CheckCheck className="w-5 h-5" />,
                          title: 'Ata de Kickoff',
                          desc: ataAceita ? 'Ata assinada por todas as partes.' : ataLink ? 'Aguardando sua assinatura.' : 'Será disponibilizada pela equipe Seguramente.',
                          done: ataAceita,
                          action: ataLink && !ataAceita ? () => window.open(`${window.location.origin}/aceite-documento/${ataLink.token}`, '_blank') : undefined,
                          actionLabel: 'Assinar agora',
                          downloadHtml: ataAceita && ataLink ? (ataLink.html_assinado || ataLink.html_documento) : null,
                          downloadNome: 'Ata-Kickoff-Assinada.html',
                        },
                        {
                          id: 'empresa',
                          icon: <Building2 className="w-5 h-5" />,
                          title: 'Passo 1 — Cadastro da Empresa',
                          desc: 'Configure os dados básicos da sua empresa no sistema.',
                          done: !!cliente.cnpj,
                          action: () => setStepAtivo('empresa'),
                          actionLabel: 'Configurar',
                          downloadHtml: null,
                          downloadNome: '',
                        },
                        {
                          id: 'colaboradores',
                          icon: <Users className="w-5 h-5" />,
                          title: 'Passo 2 — Estrutura Organizacional',
                          desc: 'Importe ou cadastre colaboradores, departamentos e funções.',
                          done: false,
                          action: () => setStepAtivo('colaboradores'),
                          actionLabel: 'Configurar',
                          downloadHtml: null,
                          downloadNome: '',
                        },
                        {
                          id: 'diagnostico',
                          icon: <BarChart3 className="w-5 h-5" />,
                          title: 'Passo 3 — Diagnóstico Inicial',
                          desc: `Inicie o ${maturidade.modulo} para gerar os primeiros indicadores.`,
                          done: false,
                          action: () => setStepAtivo('diagnostico'),
                          actionLabel: 'Iniciar',
                          downloadHtml: null,
                          downloadNome: '',
                        },
                      ].map((step) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                            step.done
                              ? 'bg-primary/5 border-primary/20'
                              : 'bg-background border-border hover:border-primary/30 hover:bg-muted/20'
                          }`}
                        >
                          <div className={`p-2.5 rounded-lg shrink-0 ${step.done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {step.done ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${step.done ? 'text-muted-foreground' : ''}`}>{step.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                          </div>
                          <div className="shrink-0 flex flex-col gap-1 items-end">
                            {!step.done && step.action && (
                              <Button size="sm" onClick={step.action}>
                                {step.actionLabel} <ChevronRight className="w-3 h-3 ml-1" />
                              </Button>
                            )}
                            {step.done && step.downloadHtml && (
                              <Button size="sm" variant="outline" onClick={() => downloadDoc(step.downloadHtml!, step.downloadNome)}>
                                <Download className="w-3 h-3 mr-1" /> Baixar
                              </Button>
                            )}
                            {step.done && !step.downloadHtml && <CheckCircle2 className="w-5 h-5 text-primary" />}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {stepAtivo === 'empresa' && (
                    <motion.div key="empresa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <button onClick={() => setStepAtivo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                        ← Voltar ao assistente
                      </button>
                      <StepEmpresa cliente={cliente} onConcluir={() => { setStepAtivo(null); }} />
                    </motion.div>
                  )}

                  {stepAtivo === 'colaboradores' && (
                    <motion.div key="colaboradores" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <StepColaboradores cliente={cliente} onConcluir={() => setStepAtivo(null)} onBack={() => setStepAtivo(null)} />
                    </motion.div>
                  )}

                  {stepAtivo === 'diagnostico' && (
                    <motion.div key="diagnostico" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <button onClick={() => setStepAtivo(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
                        ← Voltar ao assistente
                      </button>
                      <StepDiagnostico cliente={cliente} onConcluir={async () => {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user) {
                            const { data: profile } = await supabase
                              .from('profiles')
                              .select('tenant_id')
                              .eq('user_id', user.id)
                              .maybeSingle();
                            if (profile?.tenant_id) {
                              const { data: empresas } = await supabase
                                .from('empresa_cadastro')
                                .select('id')
                                .eq('tenant_id', profile.tenant_id)
                                .eq('ativo', true)
                                .order('created_at', { ascending: true })
                                .limit(1);
                              if (empresas && empresas.length > 0) {
                                localStorage.setItem(`empresa_ativa_${profile.tenant_id}`, empresas[0].id);
                              }
                            }
                          }
                        } catch (e) {
                          // ignore
                        }
                        navigate('/');
                      }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Entre em contato com a equipe Seguramente.
            {cliente.poc_email && <> · <a href={`mailto:${cliente.poc_email}`} className="underline">{cliente.poc_email}</a></>}
          </p>
        </div>
      </div>
    </div>
  );
}
