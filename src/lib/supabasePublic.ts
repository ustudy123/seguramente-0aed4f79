/**
 * Cliente Supabase para operações públicas (sem autenticação)
 * Usado para o questionário psicossocial que é respondido via link público
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[supabasePublic] VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios. " +
    "Verifique o arquivo .env do ambiente."
  );
}

// Cliente sem persistência de sessão - sempre anônimo
export const supabasePublic = createClient<Database>(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
