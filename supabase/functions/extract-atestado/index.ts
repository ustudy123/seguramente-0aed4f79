import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedData {
  colaborador_nome?: string;
  colaborador_cpf?: string;
  profissional_nome?: string;
  profissional_registro?: string;
  profissional_uf?: string;
  profissional_rqe?: string;
  profissional_telefone?: string;
  profissional_email?: string;
  profissional_endereco?: string;
  data_emissao?: string;
  dias_afastamento?: number;
  horas_afastamento?: number;
  unidade_afastamento?: 'dias' | 'horas';
  data_inicio_afastamento?: string;
  data_fim_afastamento?: string;
  contem_cid?: boolean;
  cid_codigo?: string;
  cid_autorizado?: boolean;
  observacoes?: string;
}

const systemPrompt = `Você é um sistema especializado em extrair informações de atestados médicos brasileiros.

Extraia TODAS as informações presentes no documento, seguindo a estrutura da Resolução CFM.

Campos obrigatórios a identificar:
1. Nome do médico e CRM/UF (ex: "CRM 12345/SP" ou "CRM-SP 12345")
2. Tempo de dispensa (dias ou horas)
3. RQE (Registro de Qualificação de Especialista), se houver
4. Nome e CPF do paciente
5. CID, se presente (verifique se há autorização do paciente)
6. Data de emissão
7. Contatos do médico (telefone e/ou email)
8. Endereço do médico

Retorne APENAS um objeto JSON válido com a seguinte estrutura:
{
  "colaborador_nome": "Nome do paciente",
  "colaborador_cpf": "CPF formatado ou null",
  "profissional_nome": "Nome do médico",
  "profissional_registro": "Número do CRM (apenas números)",
  "profissional_uf": "UF do CRM (ex: SP, RJ)",
  "profissional_rqe": "Número RQE ou null",
  "profissional_telefone": "Telefone ou null",
  "profissional_email": "Email ou null",
  "profissional_endereco": "Endereço completo ou null",
  "data_emissao": "YYYY-MM-DD",
  "dias_afastamento": número ou null,
  "horas_afastamento": número ou null,
  "unidade_afastamento": "dias" ou "horas",
  "data_inicio_afastamento": "YYYY-MM-DD ou null",
  "data_fim_afastamento": "YYYY-MM-DD ou null",
  "contem_cid": true ou false,
  "cid_codigo": "Código CID ou null",
  "cid_autorizado": true ou false (se menciona autorização do paciente),
  "observacoes": "Outras informações relevantes"
}

IMPORTANTE:
- Retorne SOMENTE o JSON, sem markdown ou explicações
- Use null para campos não encontrados
- Converta datas para formato YYYY-MM-DD
- Separe CRM e UF corretamente
- Se o período for em horas, coloque em horas_afastamento e unidade_afastamento="horas"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      throw new Error("Nenhum arquivo enviado");
    }

    const mimeType = file.type || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      throw new Error("Formato de arquivo não suportado. Use PDF ou imagem (PNG, JPG).");
    }

    if (isPdf) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "PDF não suportado para extração automática",
          message: "Para usar a extração automática com IA, por favor tire uma foto do atestado ou converta o PDF para imagem (JPG/PNG)."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Para imagens, usar OpenAI
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    console.log("Enviando imagem para OpenAI...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: "Extraia as informações deste atestado médico:" },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:${mimeType};base64,${base64}` 
                } 
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const result = await response.json();
    const content_response = result.choices[0]?.message?.content;

    if (!content_response) {
      throw new Error("Resposta vazia da IA");
    }

    console.log("Resposta da IA:", content_response);

    // Tentar parsear o JSON
    let extractedData: ExtractedData;
    try {
      const cleanJson = content_response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Erro ao parsear JSON:", parseError);
      throw new Error("Não foi possível extrair os dados do documento. Tente com uma imagem mais nítida.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        message: "Dados extraídos com sucesso. Revise as informações antes de salvar."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na extração:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        message: "Não foi possível extrair os dados automaticamente. Preencha manualmente."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
