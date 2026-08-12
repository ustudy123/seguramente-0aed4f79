// =====================================================================
// qa-registrar-e2e — recebe o resultado de uma corrida do Cypress e o
// grava no historico de QA, para que os casos de nivel 'e2e' deixem de
// aparecer eternamente como "nao implementado" no painel.
//
// Por que existe uma funcao no meio do caminho, em vez de o Cypress
// escrever direto: as tabelas de QA sao fechadas por RLS (superadmin e
// mais ninguem). Escrever direto exigiria a service role key dentro da
// esteira, e uma chave dessas em log de CI e um problema permanente.
// Aqui a chave nunca sai do ambiente da Edge Function.
//
// O portao e um token combinado (QA_E2E_TOKEN). Sem ele configurado, a
// funcao recusa tudo: preferimos a esteira reclamando a um endpoint
// aberto aceitando resultado de QA de qualquer origem.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QA_E2E_TOKEN = Deno.env.get("QA_E2E_TOKEN") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-qa-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResultadoDeTela {
  spec: string;
  teste: string;
  situacao: "passou" | "falhou" | "pulado";
  duracao_ms?: number;
  erro?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // Portao. Fecha por padrao: token ausente na configuracao == recusa.
  if (!QA_E2E_TOKEN) {
    return json(
      { error: "QA_E2E_TOKEN nao configurado neste projeto. Gravacao recusada." },
      503,
    );
  }
  if (req.headers.get("x-qa-token") !== QA_E2E_TOKEN) {
    return json({ error: "Token invalido." }, 401);
  }

  let payload: {
    origem?: string;
    resultados?: ResultadoDeTela[];
    // 2ª forma: anexar UM print a uma execução já criada.
    execucao_id?: string;
    spec?: string;
    teste?: string;
    evidencia_png?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo nao e JSON valido." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Modo 2: anexar um print a uma execução existente ──
  // Corpo pequeno (uma imagem), para não estourar o gateway. É por isso
  // que os prints vêm um a um, e não junto dos resultados.
  if (payload.execucao_id && payload.evidencia_png) {
    const { data, error } = await admin.rpc("qa_anexar_print_e2e", {
      p_execucao_id: payload.execucao_id,
      p_spec: payload.spec ?? "",
      p_teste: payload.teste ?? "",
      p_evidencia_png: payload.evidencia_png,
    });
    if (error) {
      console.error("Falha ao anexar print:", error);
      return json({ error: error.message }, 500);
    }
    return json({ anexado: data === true });
  }

  // ── Modo 1: gravar a corrida (resultados, SEM base64 — leve) ──
  if (!Array.isArray(payload?.resultados)) {
    return json({ error: 'Esperava { "resultados": [...] } ou um print.' }, 400);
  }

  const { data, error } = await admin.rpc("qa_registrar_bateria_e2e", {
    p_payload: { origem: payload.origem ?? "nao informada", resultados: payload.resultados },
  });

  if (error) {
    console.error("Falha ao gravar a corrida do Cypress:", error);
    return json({ error: error.message }, 500);
  }

  return json({ execucao_id: data, testes_recebidos: payload.resultados.length });
});
