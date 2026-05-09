import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  Clock,
  Shield,
  AlertCircle,
  Loader2,
  FileText,
  Sparkles,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { calcularIndicadores } from "@/hooks/usePsicossocial";
import { QuestionarioResponder } from "@/components/avaliacoes/psicossocial/QuestionarioResponder";
import { VerificacaoCPF } from "@/components/avaliacoes/psicossocial/VerificacaoCPF";
import {
  type CampanhaPsicossocial,
  type InstrumentoPsicossocial,
  BLOCOS_DINAMICOS,
} from "@/types/psicossocial";
import { toast } from "sonner";
import logoYourEyes from "@/assets/logo-youreyes.svg";
import { getDimensoesByInstrumento } from "@/data/instrumentos";
import { supabasePublic } from "@/lib/supabasePublic";

type EtapaQuestionario = 'consentimento' | 'verificacao_telefone' | 'questionario' | 'concluido';

const VERSAO_TERMO_ATUAL = 'v1.0';

const POLITICA_LGPD_OBRIGATORIA = `Suas respostas serão utilizadas exclusivamente para fins de diagnóstico organizacional e melhoria das condições de trabalho. Este questionário é anônimo e não permite identificação individual. Os dados serão tratados de forma agregada, em conformidade com a LGPD, e não serão utilizados para decisões punitivas.`;

/** RN-002: Registra o consentimento explícito do respondente */
async function registrarConsentimento(
  campanhaId: string,
  tenantId: string,
  sessionHash: string
) {
  try {
    // Obter IP externo (best-effort)
    let ipAddress = 'desconhecido';
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      }
    } catch { /* fallback */ }

    await supabasePublic
      .from('psicossocial_consentimentos')
      .insert({
        campanha_id: campanhaId,
        tenant_id: tenantId,
        aceite_anonimato: true,
        identificacao_voluntaria: false,
        ip_address: ipAddress,
        user_agent: navigator.userAgent,
        versao_termo: VERSAO_TERMO_ATUAL,
        session_hash: sessionHash,
      });
  } catch (err) {
    console.warn('Erro ao registrar consentimento (não bloqueante):', err);
  }
}

function getInstrumentoLabel(instrumento?: string) {
  switch (instrumento) {
    case 'copsoq': return 'COPSOQ III — 13 dimensões psicossociais';
    case 'hse': return 'HSE Management Standards — 7 padrões';
    case 'proart': return 'PROART — Protocolo de Avaliação de Riscos';
    case 'sipro': return 'SIPRO — Índice YourEyes de Risco Psicossocial';
    default: return 'Questionário Psicossocial';
  }
}

function getTotalPerguntas(instrumento?: string, blocosDinamicos?: string[]) {
  const valid = ['copsoq', 'hse', 'proart', 'sipro', 'ambos'] as const;
  type V = typeof valid[number];
  const key: V = valid.includes(instrumento as V) ? instrumento as V : 'sipro';
  const dims = getDimensoesByInstrumento(key);
  const base = dims.reduce((acc, d) => acc + d.perguntas.length, 0);
  if (key === 'sipro' && blocosDinamicos && blocosDinamicos.length > 0) {
    const extra = BLOCOS_DINAMICOS
      .filter(b => blocosDinamicos.includes(b.id))
      .reduce((acc, b) => acc + b.perguntas.length, 0);
    return base + extra;
  }
  return base;
}

interface Props {
  tokenTipo?: 'publico' | 'participacao';
}

export default function QuestionarioPsicossocial({ tokenTipo = 'publico' }: Props) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const startTime = useRef(Date.now());
  const sessionHash = useRef(crypto.randomUUID().replace(/-/g, ''));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campanha, setCampanha] = useState<CampanhaPsicossocial | null>(null);
  const [etapa, setEtapa] = useState<EtapaQuestionario>('consentimento');
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [aceiteLGPD, setAceiteLGPD] = useState(false);
  const [telefoneHash, setTelefoneHash] = useState<string | null>(null);
  // Metadados demográficos (vêm do token de participação, nunca do token público)
  const [metaDemografico, setMetaDemografico] = useState<{
    setor?: string; cargo?: string; unidade?: string; turno?: string;
  }>({});

  // Funções públicas inlined (não dependem de EmpresaAtivaProvider)
  const buscarCampanhaPorTokenPublico = async (tk: string): Promise<CampanhaPsicossocial | null> => {
    const { data, error: rpcErr } = await supabasePublic
      .rpc('buscar_campanha_por_token_publico', { p_token: tk });
    if (rpcErr || !data || (data as any[]).length === 0) return null;
    const row = (data as any[])[0];
    return {
      id: row.campanha_id,
      tenant_id: row.tenant_id,
      nome: row.campanha_nome,
      descricao: row.campanha_descricao,
      status: row.campanha_status,
      tipo: 'regular',
      instrumento: (row.campanha_instrumento || 'sipro') as InstrumentoPsicossocial,
      data_inicio: row.campanha_data_inicio,
      data_fim: row.campanha_data_fim,
      anonimo: row.campanha_anonimo,
      mensagem_institucional: row.campanha_mensagem_institucional,
      politica_uso_dados: row.campanha_politica_uso_dados,
      blocos_dinamicos: row.campanha_blocos_dinamicos,
      created_at: '',
      updated_at: '',
    } as CampanhaPsicossocial;
  };

  const salvarRespostaAnonimaCampanha = async (
    tokenPublico: string,
    camp: CampanhaPsicossocial,
    resps: Record<string, number>,
    tempoSeg: number,
  ): Promise<void> => {
    const inst = (camp.instrumento || 'sipro') as InstrumentoPsicossocial;
    const blocos = (camp.blocos_dinamicos as string[] | undefined) ?? [];
    const indicadores = calcularIndicadores(resps, inst, blocos);
    const { error: rpcErr } = await supabasePublic
      .rpc('salvar_resposta_anonima_campanha', {
        p_token_publico: tokenPublico,
        p_respostas: JSON.parse(JSON.stringify(resps)),
        p_indicadores: JSON.parse(JSON.stringify(indicadores)),
        p_tempo_segundos: tempoSeg,
        p_user_agent: navigator.userAgent,
      });
    if (rpcErr) throw rpcErr;
  };

  useEffect(() => {
    const loadCampanha = async () => {
      if (!token) {
        setError("Token não fornecido");
        setLoading(false);
        return;
      }

      try {
        if (tokenTipo === 'participacao') {
          // Token individual: valida via RPC específica (bloqueia reuso)
          const { data, error: rpcError } = await supabasePublic
            .rpc('validar_token_participacao', { p_token: token });

          if (rpcError) throw rpcError;

          const result = data as {
            valido: boolean; erro?: string;
            campanha_id: string; campanha_nome: string; campanha_descricao: string;
            campanha_status: string; instrumento: string;
            data_inicio: string; data_fim: string;
            mensagem_institucional?: string; politica_uso_dados?: string;
            setor?: string; cargo?: string; unidade?: string; turno?: string;
          };

          if (!result?.valido) {
            setError(result?.erro || "Link inválido");
            setLoading(false);
            return;
          }

          setCampanha({
            id: result.campanha_id,
            tenant_id: '',
            nome: result.campanha_nome,
            descricao: result.campanha_descricao,
            status: result.campanha_status as CampanhaPsicossocial['status'],
            tipo: 'regular',
            instrumento: (result.instrumento || 'sipro') as InstrumentoPsicossocial,
            data_inicio: result.data_inicio,
            data_fim: result.data_fim,
            anonimo: true,
            mensagem_institucional: result.mensagem_institucional,
            politica_uso_dados: result.politica_uso_dados,
            created_at: '',
            updated_at: '',
          });

          setMetaDemografico({
            setor: result.setor,
            cargo: result.cargo,
            unidade: result.unidade,
            turno: result.turno,
          });
        } else {
          // Token público geral (link anônimo da campanha)
          const data = await buscarCampanhaPorTokenPublico(token);
          if (!data) {
            setError("Link inválido ou expirado");
            setLoading(false);
            return;
          }
          const hoje = new Date().toISOString().split('T')[0];
          if (data.status !== 'ativa' || data.data_inicio > hoje) {
            setError("Esta campanha não está ativa no momento ou ainda não iniciou.");
            setLoading(false);
            return;
          }
          setCampanha(data);
        }
        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar questionário:", err);
        setError("Erro ao carregar o questionário");
        setLoading(false);
      }
    };

    loadCampanha();
  }, [token, tokenTipo]);

  const blocosDinamicosAtivos = (campanha?.blocos_dinamicos as string[] | undefined) ?? [];
  const instrumento = (campanha?.instrumento || 'sipro') as InstrumentoPsicossocial;
  const totalPerguntas = getTotalPerguntas(instrumento, blocosDinamicosAtivos);
  const tempoEstimado = Math.ceil(totalPerguntas * 0.4);

  const handleRespostaChange = (perguntaId: string, valor: number) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
  };

  const handleSubmit = async () => {
    if (!campanha || !token) {
      toast.error("Erro interno. Tente recarregar a página.");
      return;
    }

    setSubmitting(true);
    try {
      const tempoSegundos = Math.floor((Date.now() - startTime.current) / 1000);

      if (tokenTipo === 'participacao') {
        // Usa o token de participação individual
        const blocosDinamicos = (campanha.blocos_dinamicos as string[] | undefined) ?? [];
        const indicadores = calcularIndicadores(respostas, instrumento, blocosDinamicos);
        const { data, error: rpcError } = await supabasePublic
          .rpc('salvar_resposta_por_token_participacao', {
            p_token: token,
            p_respostas: JSON.parse(JSON.stringify(respostas)),
            p_indicadores: JSON.parse(JSON.stringify(indicadores)),
            p_tempo_segundos: tempoSegundos,
            p_user_agent: navigator.userAgent,
          });

        if (rpcError) throw rpcError;

        const result = data as { sucesso: boolean; erro?: string };
        if (!result?.sucesso) throw new Error(result?.erro || 'Erro ao salvar resposta');
      } else {
        // Usa o token público geral
        await salvarRespostaAnonimaCampanha(token, campanha, respostas, tempoSegundos);
      }


      // Após submissão bem-sucedida, registra telefone como usado (se houver verificação OTP)
      if (telefoneHash && campanha?.id) {
        try {
          const projectId = (import.meta.env.VITE_SUPABASE_URL || 'https://diayjpsrcerycycyaxst.supabase.co')
            .replace('https://', '').split('.')[0];
          const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
          await fetch(`https://${projectId}.supabase.co/functions/v1/psicossocial-whatsapp-otp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              action: 'confirmar_uso',
              campanha_id: campanha.id,
              telefone_hash_direto: telefoneHash,
            }),
          });
        } catch (e) {
          console.warn('Falha ao registrar telefone usado (não bloqueante):', e);
        }
      }

      setEtapa('concluido');
    } catch (err) {
      console.error("Erro ao enviar respostas:", err);
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const message = anyErr?.message || "Erro ao enviar respostas. Tente novamente.";
      const extra = [anyErr?.code, anyErr?.details, anyErr?.hint].filter(Boolean).join(" • ");
      toast.error(extra ? `${message} (${extra})` : message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <Brain className="h-16 w-16 text-violet-400" />
            <Loader2 className="h-5 w-5 animate-spin text-violet-600 absolute -bottom-1 -right-1" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando questionário...</p>
        </div>
      </div>
    );
  }

  // ─── Erro ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h2 className="text-xl font-semibold mb-1">Não foi possível carregar</h2>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Consentimento (LGPD) ──────────────────────────────────
  if (etapa === 'consentimento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full"
          >
            <Card className="shadow-xl border-0 ring-1 ring-black/5">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Avaliação Psicossocial</CardTitle>
                <CardDescription className="text-base font-medium">{campanha?.nome}</CardDescription>
                <p className="text-xs text-muted-foreground mt-1">{getInstrumentoLabel(instrumento)}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Garantia de Anonimato */}
                <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <Shield className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-800 text-sm">Questionário 100% Anônimo</p>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      {tokenTipo === 'participacao'
                        ? "Seu link garante participação única. Suas respostas são armazenadas sem qualquer vinculação ao seu nome ou CPF."
                        : "Este questionário não permite identificação individual. Seu nome, CPF ou qualquer dado pessoal não serão vinculados às respostas."
                      }
                    </p>
                  </div>
                </div>

                {/* Política LGPD */}
                <div className="bg-muted/50 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Termo de Consentimento e Política de Uso dos Dados (LGPD)</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {campanha?.politica_uso_dados || POLITICA_LGPD_OBRIGATORIA}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Versão do termo: {VERSAO_TERMO_ATUAL}
                  </p>
                </div>

                {/* RN-002: Aceite explícito obrigatório */}
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={aceiteLGPD}
                    onChange={(e) => setAceiteLGPD(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-muted-foreground accent-purple-600"
                  />
                  <span className="text-sm text-foreground leading-relaxed">
                    Li e concordo com a <strong>Política de Uso dos Dados</strong> acima. Compreendo que minhas respostas serão tratadas de forma anônima e agregada, não sendo utilizadas para decisões punitivas.
                  </span>
                </label>

                {/* Detalhes */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{tempoEstimado} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span>{totalPerguntas} questões</span>
                  </div>
                </div>

                <Button
                  onClick={async () => {
                    // RN-002: Registrar consentimento antes de prosseguir
                    if (campanha) {
                      await registrarConsentimento(
                        campanha.id,
                        campanha.tenant_id,
                        sessionHash.current
                      );
                    }
                    setEtapa('verificacao_telefone');
                  }}
                  disabled={!aceiteLGPD}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md disabled:opacity-50"
                  size="lg"
                >
                  {aceiteLGPD ? 'Iniciar Questionário' : 'Aceite o termo para continuar'}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Seu aceite será registrado com timestamp, versão do termo e dados técnicos (IP/navegador) para fins de conformidade LGPD.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ─── Verificação por Telefone (WhatsApp OTP) ──────────────
  if (etapa === 'verificacao_telefone') {
    return (
      <VerificacaoTelefone
        campanhaId={campanha!.id}
        campanhaNome={campanha!.nome}
        onVerificado={(hash) => { setTelefoneHash(hash); setEtapa('questionario'); }}
      />
    );
  }

  // ─── Conclusão ─────────────────────────────────────────────
  if (etapa === 'concluido') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="max-w-md w-full"
        >
          <Card className="shadow-xl border-0 ring-1 ring-black/5">
            <CardContent className="pt-10 pb-10 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Obrigado!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                  Suas respostas foram registradas de forma totalmente anônima e serão utilizadas exclusivamente para diagnóstico organizacional e melhoria das condições de trabalho.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm bg-emerald-50 rounded-lg p-3">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Respostas anônimas registradas com sucesso</span>
              </div>

              {/* Mensagem sobre Ouvidoria */}
              <div className="border rounded-xl p-4 bg-blue-50/60 border-blue-200 text-left space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
                  <p className="text-sm font-semibold text-blue-800">Precisa relatar algo específico?</p>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Caso deseje relatar uma situação específica, registrar uma manifestação ou solicitar apoio, utilize o canal de <strong>Ouvidoria</strong> da empresa — um espaço seguro e independente deste questionário.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  onClick={() => navigate('/ouvidoria')}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <MessageSquare className="h-4 w-4" />
                  Ir para Ouvidoria
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.close()}
                  className="w-full"
                >
                  Fechar página
                </Button>
              </div>

              <img
                src={logoYourEyes}
                alt="YourEyes"
                className="h-7 mx-auto opacity-40 mt-2"
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Questionário (etapa principal) ────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b z-20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">YourEyes</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">Anônimo</span>
          </div>
        </div>
      </header>

      {/* Questionário */}
      <main className="max-w-2xl mx-auto p-4 py-6">
        <QuestionarioResponder
          instrumento={instrumento}
          respostas={respostas}
          onRespostaChange={handleRespostaChange}
          onConcluir={handleSubmit}
          nomeCampanha={campanha?.nome}
          blocosDinamicos={blocosDinamicosAtivos}
        />

        {submitting && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="shadow-2xl p-6 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm font-medium">Enviando respostas...</p>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
