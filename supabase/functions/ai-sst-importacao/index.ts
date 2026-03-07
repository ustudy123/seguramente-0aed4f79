import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, documento_texto, documento_tipo, documento_nome } = await req.json();

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    // ── Ação: classificar documento ──────────────────────────────────────────
    if (action === "classificar") {
      const amostra = (documento_texto || "").substring(0, 3000);
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Você é um especialista em documentos de SST (Saúde e Segurança do Trabalho) brasileiro.
Analise o trecho de texto fornecido e classifique o tipo de documento.

Tipos possíveis:
- PGR (Programa de Gerenciamento de Riscos)
- PCMSO (Programa de Controle Médico de Saúde Ocupacional)
- LTCAT (Laudo Técnico das Condições Ambientais de Trabalho)
- PPP (Perfil Profissiográfico Previdenciário)
- APR (Análise Preliminar de Risco)
- NR12 (Análise de Risco NR12)
- AEP (Análise Ergonômica Preliminar)
- AET (Análise Ergonômica do Trabalho)
- LAUDO_INSALUBRIDADE (Laudo de Insalubridade)
- LAUDO_PERICULOSIDADE (Laudo de Periculosidade)
- AVALIACAO_AMBIENTAL (Avaliação Ambiental / Higiene Ocupacional)
- RELATORIO_MEDICOES (Relatório de Medições)
- RELATORIO_AUDITORIA (Relatório de Auditoria SST)
- PARECER_TECNICO (Parecer Técnico)
- OUTROS

Responda SOMENTE em JSON com o seguinte formato:
{
  "tipo": "PGR",
  "confianca": 92,
  "justificativa": "Texto contém 'Programa de Gerenciamento de Riscos' e seções típicas de inventário de riscos"
}`,
            },
            { role: "user", content: `Classifique este documento SST:\n\n${amostra}` },
          ],
        }),
      });
      const data = await resp.json();
      const content = JSON.parse(data.choices[0].message.content);
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ação: extrair dados estruturados ─────────────────────────────────────
    if (action === "extrair") {
      // Para PGR usamos mais texto pois o inventário tende a ser extenso
      const maxChars = (documento_tipo || "").includes("PGR") ? 28000 : 18000;
      const texto = (documento_texto || "").substring(0, maxChars);
      const tipo = documento_tipo || "DOCUMENTO_SST";

      // Prompt especializado por tipo de documento
      const systemPrompt = buildExtractionPrompt(tipo);

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Extraia TODOS os dados deste documento SST do tipo ${tipo}. Seja exaustivo no inventário de riscos — extraia CADA LINHA da tabela de riscos encontrada:\n\n${texto}`,
            },
          ],
        }),
      });

      const data = await resp.json();
      const content = JSON.parse(data.choices[0].message.content);

      // Calcular score de qualidade automaticamente
      const calcScore = (obj: any): number => {
        if (!obj) return 0;
        const vals = Object.values(obj);
        const filled = vals.filter((v) => v !== null && v !== "" && v !== undefined);
        return Math.round((filled.length / vals.length) * 100);
      };

      if (content.score_qualidade) {
        const dg = content.dados_gerais || {};
        const dgScore = calcScore(Object.fromEntries(Object.entries(dg).map(([k, v]: any) => [k, v?.valor])));
        const invScore = (content.inventario_riscos?.length || 0) > 0 ? Math.min(100, (content.inventario_riscos.length / 5) * 100) : 0;
        const paScore = (content.plano_acao?.length || 0) > 0 ? Math.min(100, (content.plano_acao.length / 3) * 100) : 0;
        const respScore = (content.responsaveis_tecnicos?.length || 0) > 0 ? 100 : 0;
        const geral = Math.round((dgScore + invScore + paScore + respScore) / 4);
        content.score_qualidade = {
          geral,
          dados_gerais: dgScore,
          inventario: Math.round(invScore),
          plano_acao: Math.round(paScore),
          responsaveis: respScore,
        };
      }

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-sst-importacao error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Prompt especializado por tipo de documento ──────────────────────────────
function buildExtractionPrompt(tipo: string): string {
  const base = `Você é um especialista sênior em SST (Saúde e Segurança do Trabalho) brasileiro com domínio em NR-01, NR-09, NR-15, NR-17, eSocial e legislação previdenciária.

REGRAS FUNDAMENTAIS (CRÍTICAS):
1. NUNCA invente dados. Se não encontrar claramente no texto, use null.
2. Extraia EXATAMENTE o que está escrito, sem parafrasear ou generalizar.
3. Classifique confiança: "alta" = dado explícito e claro | "media" = inferido com segurança | "baixa" = incerto/parcial.
4. Seja EXAUSTIVO — não pule nenhum item de tabelas e listas.

Retorne JSON com esta estrutura EXATA (todos os campos obrigatórios, use [] para listas vazias, null para campos não encontrados):
{
  "dados_gerais": {
    "empresa": {"valor": null, "confianca": "baixa"},
    "cnpj": {"valor": null, "confianca": "baixa"},
    "cnae": {"valor": null, "confianca": "baixa"},
    "grau_risco": {"valor": null, "confianca": "baixa"},
    "data_emissao": {"valor": null, "confianca": "baixa"},
    "data_vigencia": {"valor": null, "confianca": "baixa"},
    "versao": {"valor": null, "confianca": "baixa"}
  },
  "estrutura_organizacional": {
    "unidades": [],
    "setores": [],
    "departamentos": []
  },
  "funcoes_atividades": [],
  "inventario_riscos": [],
  "plano_acao": [],
  "responsaveis_tecnicos": [],
  "pendencias": [],
  "score_qualidade": {"geral": 0, "dados_gerais": 0, "inventario": 0, "plano_acao": 0, "responsaveis": 0}
}`;

  if (tipo === "PGR") {
    return base + `

INSTRUÇÕES ESPECÍFICAS PARA PGR (Programa de Gerenciamento de Riscos - NR-01):

## INVENTÁRIO DE RISCOS — PRIORIDADE MÁXIMA
O inventário de riscos é a seção mais importante do PGR. Procure por:
- Tabelas com colunas como: Setor, Função/Cargo, Agente de Risco, Fonte Geradora, Tipo de Risco, GHO (Grupo Homogêneo de Exposição), Intensidade, Frequência, Probabilidade, Severidade, Nível de Ação, Medidas de Controle, Responsável
- Seções nomeadas como: "Inventário de Riscos", "Identificação de Perigos e Riscos", "Avaliação de Riscos", "Matriz de Riscos", "Quadro de Riscos", "GHO"

Para CADA risco encontrado, preencha:
- "setor": nome do setor/área (ex: "Produção", "Administrativo", "Almoxarifado")
- "funcao": cargo ou função exposta (ex: "Operador de Máquinas", "Auxiliar Administrativo")
- "risco": nome completo do agente de risco (ex: "Ruído", "Calor", "Poeira de Sílica", "Esforço Repetitivo")
- "tipo_risco": classifique como "fisico", "quimico", "biologico", "ergonomico", "acidente" ou "psicossocial"
- "fonte_geradora": origem do risco (ex: "Compressor de ar", "Forno industrial", "Trabalho repetitivo com mouse")
- "intensidade": nível ou valor medido (ex: "85 dB(A)", "Alta", "Acima do LE")
- "tempo_exposicao": duração (ex: "8h/dia", "Intermitente", "4h diárias")
- "metodologia": método de avaliação (ex: "NHO-01", "ACGIH", "Matriz 5x5", "NR-09")
- "danos": possíveis danos à saúde (ex: "Perda auditiva induzida por ruído (PAIR)", "LER/DORT")
- "controles_existentes": lista de medidas já adotadas (ex: ["Protetor auricular", "Ventilação forçada"])
- "confianca": nível de confiança da extração

TIPOS DE RISCO — mapeamento obrigatório:
- Físicos: Ruído, Calor, Frio, Vibração, Radiação, Iluminação, Pressão
- Químicos: Poeiras, Fumos, Névoas, Gases, Vapores, Substâncias químicas
- Biológicos: Vírus, Bactérias, Fungos, Parasitas
- Ergonômicos: Postura, Esforço físico, Repetitividade, Trabalho noturno, Monotonia
- Acidentes: Máquinas sem proteção, Eletricidade, Incêndio, Queda, Corte

Extraia TODOS os riscos — não limite. Se houver 50 riscos na tabela, retorne todos os 50.`;
  }

  if (tipo === "PCMSO") {
    return base + `

INSTRUÇÕES ESPECÍFICAS PARA PCMSO:
- Extraia todos os exames médicos por cargo/função
- Identifique periodicidade dos exames (admissional, periódico, retorno, demissional)
- Registre os exames complementares obrigatórios por agente de risco
- Identifique o Médico Coordenador (nome, CRM, UF) como responsável técnico principal`;
  }

  if (tipo === "LTCAT") {
    return base + `

INSTRUÇÕES ESPECÍFICAS PARA LTCAT:
- Foco em agentes nocivos que ensejam aposentadoria especial (NR-15, Decreto 3048/99)
- Extraia concentrações/intensidades com valores numéricos precisos
- Identifique metodologias de medição (laudos de medição referenciados)
- Classifique cada agente em relação aos limites de tolerância (acima/abaixo/igual ao LT)`;
  }

  return base + `

Para este tipo de documento (${tipo}), extraia todas as informações disponíveis seguindo a estrutura padrão.`;
}

