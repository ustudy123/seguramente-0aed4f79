// =====================================================================
// qa-cobertura-e2e — devolve, para a GUARDA da esteira, os casos de teste
// DOCUMENTADOS de nível 'e2e' e a ponte que liga cada um a um it() do
// Cypress (tabela qa_cobertura_e2e: spec + título do it()).
//
// Serve à regra da casa: "todo teste de tela existe porque um caso e2e foi
// documentado antes". O script scripts/verificar-cobertura-e2e.mjs consome
// isto e reprova a esteira se achar teste Cypress sem caso documentado.
//
// Só leitura. Fechada pelo mesmo token combinado da esteira (QA_E2E_TOKEN,
// header x-qa-token) — as tabelas de QA são superadmin-only por RLS, e a
// esteira não tem sessão de superadmin; o service role lê aqui dentro, sem
// a chave nunca sair do ambiente da função. Sem o token configurado, recusa.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QA_E2E_TOKEN = (Deno.env.get("QA_E2E_TOKEN") ?? "").trim();

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-qa-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Portão: token combinado (mesmo de qa-registrar-e2e). Fecha por padrão.
  if (!QA_E2E_TOKEN) {
    return json({ error: "QA_E2E_TOKEN não configurado neste projeto." }, 503);
  }
  if ((req.headers.get("x-qa-token") ?? "").trim() !== QA_E2E_TOKEN) {
    return json({ error: "Token inválido." }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Selects simples + join em memória (evita depender de FK embedding do
  // PostgREST). São tabelas pequenas.
  const [casosRes, cobRes, modsRes] = await Promise.all([
    admin.from("qa_casos_teste").select("codigo, titulo, status, modulo_id, nivel").eq("nivel", "e2e"),
    admin.from("qa_cobertura_e2e").select("codigo, spec, teste, ativo").eq("ativo", true),
    admin.from("qa_modulos").select("id, path"),
  ]);

  if (casosRes.error || cobRes.error || modsRes.error) {
    return json(
      {
        error: "Falha ao ler a documentação de QA.",
        detalhe: casosRes.error?.message || cobRes.error?.message || modsRes.error?.message,
      },
      500,
    );
  }

  const pathPorModulo = new Map((modsRes.data ?? []).map((m) => [m.id as string, m.path as string]));
  const cobPorCodigo = new Map((cobRes.data ?? []).map((c) => [c.codigo as string, c]));

  // Casos e2e COM ponte (o teste de tela que os cobre) e SEM ponte (ainda a implementar).
  const cobertura: Array<{ codigo: string; spec: string; teste: string; status: string; modulo: string }> = [];
  const casosSemCobertura: Array<{ codigo: string; titulo: string; status: string; modulo: string }> = [];

  for (const caso of casosRes.data ?? []) {
    const modulo = pathPorModulo.get(caso.modulo_id as string) ?? "";
    const ponte = cobPorCodigo.get(caso.codigo as string);
    if (ponte) {
      cobertura.push({
        codigo: caso.codigo as string,
        spec: ponte.spec as string,
        teste: ponte.teste as string,
        status: caso.status as string,
        modulo,
      });
    } else {
      casosSemCobertura.push({
        codigo: caso.codigo as string,
        titulo: caso.titulo as string,
        status: caso.status as string,
        modulo,
      });
    }
  }

  // Pontes órfãs: apontam para um código que não é (mais) um caso e2e.
  const codigosE2e = new Set((casosRes.data ?? []).map((c) => c.codigo as string));
  const pontesOrfas = (cobRes.data ?? [])
    .filter((c) => !codigosE2e.has(c.codigo as string))
    .map((c) => ({ codigo: c.codigo as string, spec: c.spec as string, teste: c.teste as string }));

  return json({
    gerado_em: new Date().toISOString(),
    total_casos_e2e: (casosRes.data ?? []).length,
    cobertura, // caso e2e -> (spec, teste do it())
    casos_sem_cobertura: casosSemCobertura, // documentado, falta o teste
    pontes_orfas: pontesOrfas, // ponte para código que não é caso e2e
  });
});
