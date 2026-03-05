import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nomeCompleto, email, whatsapp, tipoPessoa, documento, tenantNome, tenantSlug, empresaDados } = await req.json();

    if (!nomeCompleto || !email || !tenantNome) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if email already exists in programa_validador_clientes
    const { data: existing } = await supabaseAdmin
      .from("programa_validador_clientes")
      .select("id")
      .eq("poc_email", email)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Este e-mail já possui um pré-cadastro. Nossa equipe entrará em contato em breve." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enderecoCompleto = empresaDados
      ? [
          empresaDados.logradouro,
          empresaDados.numero,
          empresaDados.complemento,
          empresaDados.bairro,
          empresaDados.municipio,
          empresaDados.uf,
          empresaDados.cep ? `CEP ${empresaDados.cep}` : null,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

    const cidadeForo = empresaDados?.municipio
      ? `${empresaDados.municipio}${empresaDados?.uf ? `/${empresaDados.uf}` : ""}`
      : null;

    // Normalizar porte para valores aceitos pelo check constraint
    const normalizarPorte = (porte: string | null): string | null => {
      if (!porte) return null;
      const p = porte.toLowerCase();
      if (p.includes("micro")) return "micro";
      if (p.includes("pequen")) return "pequena";
      if (p.includes("medi")) return "media";
      if (p.includes("grand")) return "grande";
      return null;
    };

    // Insert into programa_validador_clientes com dados completos do pré-cadastro
    const { error } = await supabaseAdmin
      .from("programa_validador_clientes")
      .insert({
        nome_empresa: tenantNome,
        cnpj: documento || null,
        poc_nome: nomeCompleto,
        poc_email: email,
        poc_telefone: whatsapp || empresaDados?.telefone || null,
        representante: nomeCompleto,
        tipo_cliente: "pagante",
        fase: "prospeccao",
        segmento:
          empresaDados?.cnaeDescricao ||
          (tipoPessoa === "pj" ? "Pessoa Jurídica" : "Pessoa Física"),
        tamanho_empresa: normalizarPorte(empresaDados?.porte),
        endereco: enderecoCompleto,
        cidade_foro: cidadeForo,
        observacoes: [
          "Cadastro público via /register",
          `Tipo: ${tipoPessoa === "pj" ? "PJ" : "PF"}`,
          `Documento: ${documento || "não informado"}`,
          `Slug: ${tenantSlug || "não informado"}`,
          whatsapp ? `WhatsApp: ${whatsapp}` : null,
          empresaDados?.nomeFantasia ? `Nome fantasia: ${empresaDados.nomeFantasia}` : null,
          empresaDados?.razaoSocial ? `Razão social: ${empresaDados.razaoSocial}` : null,
          empresaDados?.emailEmpresa ? `E-mail empresa: ${empresaDados.emailEmpresa}` : null,
          empresaDados?.cnaeFiscal ? `CNAE: ${empresaDados.cnaeFiscal}` : null,
          empresaDados?.cnaeDescricao ? `Atividade principal: ${empresaDados.cnaeDescricao}` : null,
          empresaDados?.porte ? `Porte: ${empresaDados.porte}` : null,
          empresaDados?.naturezaJuridica ? `Natureza jurídica: ${empresaDados.naturezaJuridica}` : null,
          empresaDados?.cnaesSecundarios?.length
            ? `CNAEs secundários: ${empresaDados.cnaesSecundarios.map((c: { codigo: number; descricao: string }) => `${c.codigo} - ${c.descricao}`).join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
      });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Erro ao salvar pré-cadastro" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Pre-register error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
