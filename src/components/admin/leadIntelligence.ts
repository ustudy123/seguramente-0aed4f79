/**
 * Inteligência Comercial de Leads da Landing
 * Deriva insights acionáveis dos dados de diagnóstico para o time comercial.
 */

export interface LeadIntel {
  // Classificação ICP
  icp: "ideal" | "bom" | "fora" | "indefinido";
  icpLabel: string;
  icpReason: string;
  // Estimativa de ticket (R$/mês)
  ticketMin: number;
  ticketMax: number;
  // Potencial anual
  arrPotencial: number;
  // Temperatura comercial (0-100)
  temperatura: number;
  temperaturaLabel: "Frio" | "Morno" | "Quente" | "Em Chamas";
  temperaturaClass: string;
  // Próxima ação recomendada
  proximaAcao: string;
  proximaAcaoUrgencia: "imediata" | "24h" | "3dias" | "nutricao";
  // Pontos fortes / fracos por dimensão
  pontosFracos: { dim: string; pct: number; modulo: string }[];
  pontosFortes: { dim: string; pct: number }[];
  // Módulos a ofertar (priorizado)
  modulosRecomendados: { nome: string; motivo: string; prioridade: number }[];
  // Script de abordagem
  ganchoAbordagem: string;
  // Risco trabalhista detectado
  riscoTrabalhista: string[];
}

const MODULO_POR_DIMENSAO: Record<string, string> = {
  epi: "Gestão de EPI (NR-06)",
  jornada: "Ponto Eletrônico + Análise de Jornada",
  pessoas: "Gestão de Pessoas + PDI",
  auditoria: "Auditoria & Compliance SST",
  documentacao: "Gestão Documental + Hub Contábil",
  psicossocial: "Avaliação Psicossocial (NR-1)",
};

const FAIXA_FUNCIONARIOS: Record<string, { min: number; ticketBase: number; label: string }> = {
  "1_19": { min: 10, ticketBase: 350, label: "Micro" },
  "20_99": { min: 50, ticketBase: 1200, label: "Pequena" },
  "100_499": { min: 250, ticketBase: 4500, label: "Média" },
  "500_999": { min: 700, ticketBase: 9000, label: "Média-Grande" },
  "1000_mais": { min: 1500, ticketBase: 22000, label: "Grande" },
};

const SETOR_ICP: Record<string, "ideal" | "bom" | "fora"> = {
  industria: "ideal",
  "industria_fabrica": "ideal",
  construcao: "ideal",
  logistica: "ideal",
  transporte: "ideal",
  saude: "bom",
  servicos: "bom",
  comercio: "bom",
  varejo: "bom",
  tecnologia: "fora",
  ti: "fora",
};

export function computeLeadIntel(lead: any): LeadIntel {
  const diag = lead.diagnostico_resultado || {};
  const dims = diag.dimensoes || {};
  const resp = diag.respostas || {};
  const score = Number(lead.pontuacao_diagnostico ?? diag.score ?? 0);
  const perfil = (lead.perfil_diagnostico || diag.perfil || "").toLowerCase();
  const numFunc = (lead.num_funcionarios || "").toLowerCase();
  const setor = (lead.setor || "").toLowerCase().replace(/[\s/-]+/g, "_");

  // -------- ICP --------
  const faixa = Object.entries(FAIXA_FUNCIONARIOS).find(([k]) => numFunc.includes(k.split("_")[0])) || null;
  let icpSetor: "ideal" | "bom" | "fora" | "indefinido" = "indefinido";
  for (const [k, v] of Object.entries(SETOR_ICP)) {
    if (setor.includes(k)) { icpSetor = v; break; }
  }
  let icp: LeadIntel["icp"] = "indefinido";
  let icpReason = "";
  if (faixa && icpSetor !== "indefinido") {
    if (icpSetor === "ideal" && faixa[1].ticketBase >= 1200) {
      icp = "ideal"; icpReason = `${faixa[1].label} porte em setor-alvo (${setor || "—"})`;
    } else if (icpSetor === "fora") {
      icp = "fora"; icpReason = `Setor ${setor} fora do foco SST`;
    } else if (faixa[1].ticketBase < 1200) {
      icp = "bom"; icpReason = `Porte pequeno — venda transacional`;
    } else {
      icp = "bom"; icpReason = `Setor compatível, porte adequado`;
    }
  } else if (faixa) {
    icp = faixa[1].ticketBase >= 1200 ? "bom" : "fora";
    icpReason = "Setor não declarado";
  }
  const icpLabel = { ideal: "ICP Ideal", bom: "ICP Bom", fora: "Fora do ICP", indefinido: "Indefinido" }[icp];

  // -------- Ticket --------
  const base = faixa?.[1].ticketBase ?? 800;
  const ticketMin = Math.round(base * 0.8);
  const ticketMax = Math.round(base * 1.5);
  const arrPotencial = ticketMax * 12;

  // -------- Temperatura --------
  let temperatura = score;
  if (perfil === "critico") temperatura = Math.min(100, temperatura + 25);
  else if (perfil === "quente") temperatura = Math.min(100, temperatura + 15);
  if (icp === "ideal") temperatura = Math.min(100, temperatura + 10);
  if (icp === "fora") temperatura = Math.max(0, temperatura - 30);

  let temperaturaLabel: LeadIntel["temperaturaLabel"] = "Frio";
  let temperaturaClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (temperatura >= 80) { temperaturaLabel = "Em Chamas"; temperaturaClass = "bg-destructive/10 text-destructive border-destructive/20"; }
  else if (temperatura >= 60) { temperaturaLabel = "Quente"; temperaturaClass = "bg-orange-500/10 text-orange-600 border-orange-500/20"; }
  else if (temperatura >= 40) { temperaturaLabel = "Morno"; temperaturaClass = "bg-amber-500/10 text-amber-600 border-amber-500/20"; }

  // -------- Próxima ação --------
  let proximaAcao = "Adicionar à cadência de nutrição por e-mail";
  let proximaAcaoUrgencia: LeadIntel["proximaAcaoUrgencia"] = "nutricao";
  if (temperatura >= 80) { proximaAcao = "Ligar AGORA — risco de perder timing"; proximaAcaoUrgencia = "imediata"; }
  else if (temperatura >= 60) { proximaAcao = "Contato em até 24h via WhatsApp + demo agendada"; proximaAcaoUrgencia = "24h"; }
  else if (temperatura >= 40) { proximaAcao = "E-mail consultivo em 3 dias com case do setor"; proximaAcaoUrgencia = "3dias"; }

  // -------- Pontos fracos / fortes por dimensão --------
  const dimArr = Object.entries(dims).map(([k, v]: [string, any]) => {
    const pct = v.max ? Math.round((v.soma / v.max) * 100) : 0;
    return { dim: k, pct, modulo: MODULO_POR_DIMENSAO[k] || k };
  });
  const pontosFracos = dimArr.filter(d => d.pct < 50).sort((a, b) => a.pct - b.pct).slice(0, 3);
  const pontosFortes = dimArr.filter(d => d.pct >= 70).sort((a, b) => b.pct - a.pct).slice(0, 2);

  // -------- Módulos recomendados --------
  const modulosRecomendados = pontosFracos.map((p, i) => ({
    nome: p.modulo,
    motivo: `${p.dim} em ${p.pct}% — gap crítico`,
    prioridade: i + 1,
  }));

  // -------- Risco trabalhista --------
  const riscoTrabalhista: string[] = [];
  if ((dims.documentacao?.soma ?? 99) / (dims.documentacao?.max || 1) < 0.3)
    riscoTrabalhista.push("Documentação SST <30% — alto risco fiscalização MTE");
  if (resp.aso === "nao") riscoTrabalhista.push("Sem controle de ASO — passivo PCMSO");
  if (resp.act === "nao") riscoTrabalhista.push("Sem ACT/Convenção mapeada");
  if (resp.ppra === "nao" || resp.pgr === "nao") riscoTrabalhista.push("Sem PGR — multa NR-1");
  if ((dims.psicossocial?.soma ?? 99) / (dims.psicossocial?.max || 1) < 0.4)
    riscoTrabalhista.push("Riscos psicossociais não mapeados — NR-1 (vigente 2025)");

  // -------- Gancho de abordagem --------
  const empresa = lead.empresa || "sua empresa";
  const nome = (lead.nome || "").split(" ")[0];
  let ganchoAbordagem = `Olá ${nome}, vi que ${empresa} tem ${numFunc || "alguns"} colaboradores.`;
  if (pontosFracos[0]) {
    ganchoAbordagem += ` No diagnóstico, identifiquei que a dimensão ${pontosFracos[0].dim} está em ${pontosFracos[0].pct}% — isso costuma gerar passivo trabalhista em empresas do seu porte.`;
  }
  if (riscoTrabalhista[0]) {
    ganchoAbordagem += ` Especificamente, ${riscoTrabalhista[0].toLowerCase()}.`;
  }
  ganchoAbordagem += ` Posso te mostrar em 15 min como o Seguramente resolve isso? Que tal ${proximaAcaoUrgencia === "imediata" ? "ainda hoje" : "amanhã"}?`;

  return {
    icp, icpLabel, icpReason,
    ticketMin, ticketMax, arrPotencial,
    temperatura, temperaturaLabel, temperaturaClass,
    proximaAcao, proximaAcaoUrgencia,
    pontosFracos, pontosFortes,
    modulosRecomendados,
    ganchoAbordagem,
    riscoTrabalhista,
  };
}

export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function whatsappLink(telefone: string | null | undefined, mensagem: string) {
  if (!telefone) return null;
  const num = telefone.replace(/\D/g, "");
  const full = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(mensagem)}`;
}

export function mailtoLink(email: string, assunto: string, corpo: string) {
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
