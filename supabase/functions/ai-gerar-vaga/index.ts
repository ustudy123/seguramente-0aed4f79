import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      tipo, cargoId, cargoNome, cargoDescricao, responsabilidade,
      // Vaga fields
      contato, localTrabalho, tipoContrato, jornada, faixaSalarial,
      requisitosImprescindiveis, requisitosDesejaveis, beneficios, prazoInscricao,
      // Proposta fields
      nomeEmpresa, nomeCandidato, salarioBase, dataInicio, horarioTrabalho,
      beneficiosOferecidos, periodoExperiencia, observacoes,
    } = body;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    // Fetch context data from DB
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch atividades & competências
    let atividadesTexto = "";
    let competenciasTexto = "";
    
    if (cargoId) {
      const { data: atividades } = await supabase
        .from("funcao_atividades")
        .select("nome, descricao, frequencia, complexidade, classificacao")
        .eq("cargo_id", cargoId);
      
      if (atividades?.length) {
        atividadesTexto = atividades.map((a: any) => 
          `- ${a.nome}${a.descricao ? ` (${a.descricao})` : ""} [${a.frequencia}, ${a.complexidade}]`
        ).join("\n");
      }

      const { data: competencias } = await supabase
        .from("funcao_competencias")
        .select("nome, tipo, descricao")
        .eq("cargo_id", cargoId);

      if (competencias?.length) {
        competenciasTexto = competencias.map((c: any) =>
          `- ${c.nome} (${c.tipo})${c.descricao ? `: ${c.descricao}` : ""}`
        ).join("\n");
      }
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (tipo === "proposta") {
      systemPrompt = `Você é um especialista em RH e gestão de pessoas. Gere propostas de oportunidade de emprego profissionais, atrativas e completas. Use linguagem formal mas acolhedora. Retorne apenas o texto da proposta, pronto para envio ao candidato.`;
      
      userPrompt = `Gere uma Proposta de Oportunidade de Emprego com os seguintes dados:

CARGO: ${cargoNome}
${cargoDescricao ? `DESCRIÇÃO DO CARGO: ${cargoDescricao}` : ""}
${responsabilidade ? `RESPONSABILIDADE: ${responsabilidade}` : ""}
${nomeEmpresa ? `EMPRESA: ${nomeEmpresa}` : ""}
${nomeCandidato ? `CANDIDATO: ${nomeCandidato}` : ""}
${salarioBase ? `SALÁRIO BASE: ${salarioBase}` : ""}
${tipoContrato ? `TIPO DE CONTRATO: ${tipoContrato}` : ""}
${dataInicio ? `DATA PREVISTA DE INÍCIO: ${dataInicio}` : ""}
${horarioTrabalho ? `HORÁRIO DE TRABALHO: ${horarioTrabalho}` : ""}
${periodoExperiencia ? `PERÍODO DE EXPERIÊNCIA: ${periodoExperiencia} dias` : ""}
${localTrabalho ? `LOCAL DE TRABALHO: ${localTrabalho}` : ""}
${beneficiosOferecidos ? `BENEFÍCIOS: ${beneficiosOferecidos}` : ""}
${observacoes ? `OBSERVAÇÕES: ${observacoes}` : ""}

${atividadesTexto ? `ATIVIDADES DA FUNÇÃO:\n${atividadesTexto}` : ""}
${competenciasTexto ? `COMPETÊNCIAS REQUERIDAS:\n${competenciasTexto}` : ""}

A proposta deve conter:
1. Saudação ao candidato (usar nome se fornecido)
2. Apresentação da oportunidade
3. Descrição do cargo e principais responsabilidades
4. Condições de trabalho (contrato, horário, local)
5. Remuneração e benefícios
6. Período de experiência
7. Próximos passos e prazo para resposta
8. Encerramento cordial

Formate de maneira profissional e pronta para envio.`;
    } else {
      systemPrompt = `Você é um especialista em recrutamento e seleção. Gere anúncios de vagas profissionais, atrativos e completos. Use linguagem inclusiva e atrativa. Retorne apenas o texto do anúncio, pronto para publicação.`;
      
      userPrompt = `Gere um anúncio de vaga de emprego com os seguintes dados:

CARGO: ${cargoNome}
${cargoDescricao ? `DESCRIÇÃO DO CARGO: ${cargoDescricao}` : ""}
${responsabilidade ? `RESPONSABILIDADE DA FUNÇÃO: ${responsabilidade}` : ""}
${contato ? `CONTATO PARA ENVIO DE CURRÍCULO: ${contato}` : ""}
${localTrabalho ? `LOCAL: ${localTrabalho}` : ""}
${tipoContrato ? `TIPO DE CONTRATO: ${tipoContrato?.toUpperCase()}` : ""}
${jornada ? `JORNADA: ${jornada}` : ""}
${faixaSalarial ? `FAIXA SALARIAL: ${faixaSalarial}` : ""}
${prazoInscricao ? `PRAZO DE INSCRIÇÃO: ${prazoInscricao}` : ""}
${requisitosImprescindiveis ? `REQUISITOS IMPRESCINDÍVEIS:\n${requisitosImprescindiveis}` : ""}
${requisitosDesejaveis ? `REQUISITOS DESEJÁVEIS:\n${requisitosDesejaveis}` : ""}
${beneficios ? `BENEFÍCIOS:\n${beneficios}` : ""}

${atividadesTexto ? `ATIVIDADES DA FUNÇÃO:\n${atividadesTexto}` : ""}
${competenciasTexto ? `COMPETÊNCIAS REQUERIDAS:\n${competenciasTexto}` : ""}

O anúncio deve conter:
1. Título atrativo
2. Sobre a vaga
3. Principais atividades e responsabilidades
4. Requisitos imprescindíveis e desejáveis
5. Competências necessárias
6. Condições de trabalho
7. Benefícios (se informados)
8. Como se candidatar

Formate de maneira profissional e pronta para publicação.`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ anuncio: result, proposta: result, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
