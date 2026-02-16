import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageSquare,
  Send,
  Gift,
  Smile,
  Calendar,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FeriasItem {
  id: number;
  colaborador: string;
  departamento: string;
  dataInicio: string;
  dataFim: string;
  diasSolicitados: number;
  status: "pendente" | "aprovado" | "recusado";
}

interface FeriasCulturaProps {
  ferias: FeriasItem[];
}

interface MensagemPreFerias {
  colaborador: string;
  dataInicio: string;
  dataFim: string;
  mensagem: string;
  enviada: boolean;
  enviadaEm?: string;
}

interface CheckinRetorno {
  colaborador: string;
  dataRetorno: string;
  status: "pendente" | "enviado" | "respondido";
  respostas?: {
    descansou: string;
    energia: string;
    comentario?: string;
  };
}

const TEMPLATES_PRE_FERIAS = [
  "Boas férias, {nome}! 🌴 Que esse período seja de muito descanso e renovação. Você merece!",
  "{nome}, suas férias chegaram! 🎉 Aproveite cada momento — a equipe estará aqui na sua volta.",
  "Hora de recarregar as energias, {nome}! ☀️ Desejamos dias incríveis de descanso e alegria.",
  "{nome}, férias merecidas! 🏖️ Desligue-se, descanse e volte com toda a energia. Bom descanso!",
];

const PERGUNTAS_CHECKIN = [
  { id: "descansou", pergunta: "Conseguiu descansar durante as férias?", opcoes: ["Sim, muito!", "Razoavelmente", "Não muito"] },
  { id: "energia", pergunta: "Como está seu nível de energia para voltar?", opcoes: ["Alta ⚡", "Normal 😊", "Baixa 😴"] },
];

export function FeriasCultura({ ferias }: FeriasCulturaProps) {
  const [mensagens, setMensagens] = useState<MensagemPreFerias[]>([]);
  const [checkins, setCheckins] = useState<CheckinRetorno[]>([]);
  const [editingMsg, setEditingMsg] = useState<string | null>(null);
  const [customMsg, setCustomMsg] = useState("");

  const hoje = new Date();

  // Férias aprovadas que iniciam nos próximos 7 dias (pré-férias)
  const proximas = useMemo(() => {
    return ferias.filter((f) => {
      if (f.status !== "aprovado") return false;
      const inicio = new Date(f.dataInicio);
      const diff = (inicio.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });
  }, [ferias]);

  // Colaboradores retornando nos próximos 3 dias ou que retornaram nos últimos 3 dias
  const retornos = useMemo(() => {
    return ferias.filter((f) => {
      if (f.status !== "aprovado") return false;
      const fim = new Date(f.dataFim);
      const diff = (hoje.getTime() - fim.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= -3 && diff <= 3;
    });
  }, [ferias]);

  const getMensagemEnviada = (colaborador: string) =>
    mensagens.find((m) => m.colaborador === colaborador && m.enviada);

  const getCheckin = (colaborador: string) =>
    checkins.find((c) => c.colaborador === colaborador);

  const handleEnviarMensagem = (item: FeriasItem, mensagem: string) => {
    setMensagens((prev) => [
      ...prev.filter((m) => m.colaborador !== item.colaborador),
      {
        colaborador: item.colaborador,
        dataInicio: item.dataInicio,
        dataFim: item.dataFim,
        mensagem,
        enviada: true,
        enviadaEm: new Date().toISOString(),
      },
    ]);
    setEditingMsg(null);
    setCustomMsg("");
    toast.success(`Mensagem pré-férias enviada para ${item.colaborador.split(" ")[0]}! 🌴`);
  };

  const handleEnviarCheckin = (item: FeriasItem) => {
    setCheckins((prev) => [
      ...prev.filter((c) => c.colaborador !== item.colaborador),
      {
        colaborador: item.colaborador,
        dataRetorno: item.dataFim,
        status: "enviado",
      },
    ]);
    toast.success(`Check-in de retorno enviado para ${item.colaborador.split(" ")[0]}! 💬`);
  };

  const getTemplate = (nome: string) => {
    const template = TEMPLATES_PRE_FERIAS[Math.floor(Math.random() * TEMPLATES_PRE_FERIAS.length)];
    return template.replace("{nome}", nome.split(" ")[0]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Heart className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Cultura & Férias</h2>
          <p className="text-xs text-muted-foreground">
            Cada despedida é um gesto de cuidado. Cada retorno, uma oportunidade de acolhimento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PRÉ-FÉRIAS */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PartyPopper className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Mensagens Pré-Férias</h3>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {proximas.length} saindo em breve
            </Badge>
          </div>

          <div className="divide-y divide-border">
            {proximas.length === 0 ? (
              <div className="p-8 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum colaborador saindo de férias nos próximos 7 dias
                </p>
              </div>
            ) : (
              proximas.map((item) => {
                const enviada = getMensagemEnviada(item.colaborador);
                const isEditing = editingMsg === item.colaborador;
                const diasAte = Math.ceil(
                  (new Date(item.dataInicio).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                            {item.colaborador.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.colaborador}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.departamento} · Férias em {diasAte === 0 ? "hoje" : `${diasAte} dia(s)`}
                          </p>
                        </div>
                      </div>
                      {enviada ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Enviada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>

                    {enviada ? (
                      <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground italic">
                        "{enviada.mensagem}"
                        <p className="mt-1 text-[10px] not-italic">
                          Enviada em {new Date(enviada.enviadaEm!).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {isEditing ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                          >
                            <Textarea
                              value={customMsg}
                              onChange={(e) => setCustomMsg(e.target.value)}
                              placeholder="Escreva sua mensagem personalizada..."
                              className="text-sm min-h-[80px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleEnviarMensagem(item, customMsg)}
                                disabled={!customMsg.trim()}
                              >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                Enviar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingMsg(null);
                                  setCustomMsg("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => {
                                const template = getTemplate(item.colaborador);
                                handleEnviarMensagem(item, template);
                              }}
                            >
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              Enviar Sugestão
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                setEditingMsg(item.colaborador);
                                setCustomMsg(getTemplate(item.colaborador));
                              }}
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              Personalizar
                            </Button>
                          </div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CHECK-IN DE RETORNO */}
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Check-in de Retorno</h3>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {retornos.length} retornando
            </Badge>
          </div>

          <div className="divide-y divide-border">
            {retornos.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum colaborador retornando nos próximos dias
                </p>
              </div>
            ) : (
              retornos.map((item) => {
                const checkin = getCheckin(item.colaborador);
                const dataRetorno = new Date(item.dataFim);
                const diffDias = Math.ceil(
                  (dataRetorno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
                );
                const retornoLabel =
                  diffDias === 0
                    ? "Retorna hoje"
                    : diffDias > 0
                    ? `Retorna em ${diffDias} dia(s)`
                    : `Retornou há ${Math.abs(diffDias)} dia(s)`;

                return (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                            {item.colaborador.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.colaborador}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.departamento} · {retornoLabel}
                          </p>
                        </div>
                      </div>
                      {checkin?.status === "respondido" ? (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Respondido
                        </Badge>
                      ) : checkin?.status === "enviado" ? (
                        <Badge className="bg-info/10 text-info border-info/20 text-[10px]">
                          <Send className="w-3 h-3 mr-1" />
                          Enviado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>

                    {checkin?.status === "respondido" && checkin.respostas ? (
                      <div className="bg-success/5 border border-success/20 rounded-lg p-3 space-y-2">
                        {PERGUNTAS_CHECKIN.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{p.pergunta}</span>
                            <span className="font-medium text-foreground">
                              {(checkin.respostas as any)?.[p.id] || "—"}
                            </span>
                          </div>
                        ))}
                        {checkin.respostas.comentario && (
                          <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-success/10">
                            "{checkin.respostas.comentario}"
                          </p>
                        )}
                      </div>
                    ) : checkin?.status === "enviado" ? (
                      <div className="bg-info/5 border border-info/10 rounded-lg p-3 text-xs text-muted-foreground">
                        <Send className="w-3.5 h-3.5 inline mr-1 text-info" />
                        Check-in enviado — aguardando resposta do colaborador
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Perguntas do check-in de bem-estar:
                          </p>
                          <ul className="space-y-1">
                            {PERGUNTAS_CHECKIN.map((p) => (
                              <li key={p.id} className="text-xs text-foreground flex items-center gap-1.5">
                                <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                                {p.pergunta}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleEnviarCheckin(item)}
                        >
                          <Send className="w-3.5 h-3.5 mr-1" />
                          Enviar Check-in de Bem-Estar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-3">
        <Gift className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como funciona a integração com Cultura?</p>
          <p>
            <strong>Pré-Férias:</strong> 7 dias antes, o sistema sugere enviar uma mensagem personalizada de despedida — 
            com template ou texto livre — reforçando o cuidado da empresa.
          </p>
          <p>
            <strong>Retorno:</strong> No dia do retorno (±3 dias), um check-in de bem-estar é enviado ao colaborador 
            com perguntas sobre descanso e energia, alimentando os indicadores de saúde organizacional (INR™ e Radares).
          </p>
        </div>
      </div>
    </motion.div>
  );
}
