import { useState } from "react";
import { motion } from "framer-motion";
import { X, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle, XCircle, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  onClose: () => void;
  onComplete: (resultado: { respostas: Record<string, number>; pontuacao: number; nivel: string }) => void;
}

const perguntas = [
  {
    id: "q1",
    texto: "Sua empresa já mapeou os riscos psicossociais conforme a NR-01 atualizada?",
    opcoes: [
      { label: "Sim, totalmente mapeado", valor: 0 },
      { label: "Parcialmente", valor: 1 },
      { label: "Não, ainda não fizemos", valor: 3 },
      { label: "Não sei o que é isso", valor: 4 },
    ],
  },
  {
    id: "q2",
    texto: "Como está o índice de afastamentos por saúde mental (burnout, ansiedade, depressão) na sua empresa?",
    opcoes: [
      { label: "Não temos casos", valor: 0 },
      { label: "Poucos casos isolados", valor: 1 },
      { label: "Temos casos frequentes", valor: 3 },
      { label: "Não monitoramos isso", valor: 4 },
    ],
  },
  {
    id: "q3",
    texto: "Existe algum canal para denúncia de assédio moral ou sexual na empresa?",
    opcoes: [
      { label: "Sim, formal e ativo", valor: 0 },
      { label: "Existe mas pouco usado", valor: 1 },
      { label: "Não existe", valor: 3 },
    ],
  },
  {
    id: "q4",
    texto: "Qual o turnover (rotatividade) da sua empresa nos últimos 12 meses?",
    opcoes: [
      { label: "Abaixo de 10%", valor: 0 },
      { label: "Entre 10% e 25%", valor: 1 },
      { label: "Entre 25% e 40%", valor: 3 },
      { label: "Acima de 40%", valor: 4 },
    ],
  },
  {
    id: "q5",
    texto: "A empresa realiza avaliações de clima organizacional periodicamente?",
    opcoes: [
      { label: "Sim, pelo menos anualmente", valor: 0 },
      { label: "Já fizemos uma vez", valor: 1 },
      { label: "Nunca realizamos", valor: 3 },
    ],
  },
  {
    id: "q6",
    texto: "Sua empresa possui PGR (Programa de Gerenciamento de Riscos) atualizado com fatores psicossociais?",
    opcoes: [
      { label: "Sim, atualizado", valor: 0 },
      { label: "Temos PGR mas sem psicossocial", valor: 2 },
      { label: "PGR desatualizado", valor: 3 },
      { label: "Não temos PGR", valor: 4 },
    ],
  },
  {
    id: "q7",
    texto: "Quantos processos trabalhistas a empresa recebeu nos últimos 2 anos?",
    opcoes: [
      { label: "Nenhum", valor: 0 },
      { label: "1 a 3", valor: 1 },
      { label: "4 a 10", valor: 3 },
      { label: "Mais de 10", valor: 4 },
    ],
  },
];

export function LandingDiagnostico({ onClose, onComplete }: Props) {
  const [etapa, setEtapa] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [mostrarResultado, setMostrarResultado] = useState(false);

  const perguntaAtual = perguntas[etapa];
  const totalRespondido = Object.keys(respostas).length;

  const handleResposta = (valor: number) => {
    const novasRespostas = { ...respostas, [perguntaAtual.id]: valor };
    setRespostas(novasRespostas);

    if (etapa < perguntas.length - 1) {
      setTimeout(() => setEtapa(etapa + 1), 300);
    } else {
      setMostrarResultado(true);
    }
  };

  const pontuacao = Object.values(respostas).reduce((a, b) => a + b, 0);
  const maxPontos = perguntas.length * 4;
  const percentual = Math.round((pontuacao / maxPontos) * 100);
  const nivel = percentual >= 60 ? "critico" : percentual >= 30 ? "atencao" : "adequado";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#16161d] border border-gray-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Diagnóstico Rápido NR-01</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {!mostrarResultado ? (
            <>
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Pergunta {etapa + 1} de {perguntas.length}</span>
                  <span>{Math.round(((etapa + 1) / perguntas.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${((etapa + 1) / perguntas.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pergunta */}
              <motion.div key={etapa} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <p className="text-lg font-semibold text-white mb-6">{perguntaAtual.texto}</p>
                <div className="space-y-3">
                  {perguntaAtual.opcoes.map((opcao, i) => (
                    <button
                      key={i}
                      onClick={() => handleResposta(opcao.valor)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        respostas[perguntaAtual.id] === opcao.valor
                          ? "border-blue-500 bg-blue-500/10 text-white"
                          : "border-gray-700 bg-[#0d0d14] text-gray-300 hover:border-gray-600 hover:bg-[#111118]"
                      }`}
                    >
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </motion.div>

              {etapa > 0 && (
                <Button variant="ghost" onClick={() => setEtapa(etapa - 1)} className="mt-4 text-gray-500">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
              )}
            </>
          ) : (
            /* Resultado */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="text-center mb-6">
                {nivel === "critico" ? (
                  <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-10 h-10 text-red-500" />
                  </div>
                ) : nivel === "atencao" ? (
                  <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-10 h-10 text-yellow-500" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                )}

                <h3 className="text-2xl font-black text-white mb-2">
                  {nivel === "critico" && "🚨 Sua empresa está em RISCO CRÍTICO"}
                  {nivel === "atencao" && "⚠️ Sua empresa precisa de ATENÇÃO"}
                  {nivel === "adequado" && "✅ Sua empresa está no caminho certo"}
                </h3>

                <Badge className={`mb-4 ${
                  nivel === "critico" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                  nivel === "atencao" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                  "bg-green-500/20 text-green-400 border-green-500/30"
                }`}>
                  Pontuação de risco: {pontuacao}/{maxPontos} ({percentual}%)
                </Badge>
              </div>

              <div className="bg-[#0d0d14] rounded-xl p-4 mb-6 text-sm text-gray-400">
                {nivel === "critico" && (
                  <p>
                    <strong className="text-red-400">Atenção imediata necessária.</strong> Sua empresa apresenta vulnerabilidades graves 
                    que podem resultar em multas de até R$ 50.000 por infração, processos trabalhistas e interdições. 
                    A NR-01 exige mapeamento de riscos psicossociais — e sua empresa ainda não está adequada.
                  </p>
                )}
                {nivel === "atencao" && (
                  <p>
                    <strong className="text-yellow-400">Existem pontos que precisam de correção.</strong> Sua empresa tem algumas 
                    proteções, mas gaps importantes podem gerar problemas com a fiscalização. A boa notícia: ainda dá tempo de corrigir antes da próxima visita do MTE.
                  </p>
                )}
                {nivel === "adequado" && (
                  <p>
                    <strong className="text-green-400">Bom trabalho!</strong> Sua empresa demonstra maturidade em gestão de riscos. 
                    Com o YourEyes, você pode automatizar e aprofundar ainda mais seus controles, garantindo 100% de compliance.
                  </p>
                )}
              </div>

              <Button
                size="lg"
                onClick={() => onComplete({ respostas, pontuacao, nivel })}
                className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white py-6 text-lg rounded-xl"
              >
                {nivel === "critico" ? "QUERO PROTEGER MINHA EMPRESA AGORA" : "QUERO CONHECER O YourEyes"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
