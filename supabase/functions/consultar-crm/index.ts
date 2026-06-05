import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { crm, uf } = await req.json();

    if (!crm) {
      throw new Error("CRM não informado");
    }

    console.log(`Buscando CRM: ${crm} UF: ${uf}`);

    // Aqui poderíamos integrar com APIs pagas como ConsultaCRM, Infosimples, etc.
    // Exemplo de integração (requer chave de API):
    // const CONSULTACRM_KEY = Deno.env.get("CONSULTACRM_KEY");
    // if (CONSULTACRM_KEY) {
    //   const response = await fetch(`https://www.consultacrm.com.br/api/index.php?tipo=crm&uf=${uf}&q=${crm}&chave=${CONSULTACRM_KEY}`);
    //   const data = await response.json();
    //   return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // }

    // Por enquanto, como não há uma API pública gratuita e estável sem token,
    // retornamos que o médico não foi encontrado na base externa, 
    // mas o frontend já tentou buscar no histórico local antes de chamar esta função.
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Médico não encontrado no histórico local. Verifique os dados no documento." 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na consulta:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
