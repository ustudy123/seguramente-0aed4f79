/**
 * Cliente Supabase para operações públicas (sem autenticação)
 * Usado para o questionário psicossocial que é respondido via link público
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://diayjpsrcerycycyaxst.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYXlqcHNyY2VyeWN5Y3lheHN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjg3NTEsImV4cCI6MjA4MzMwNDc1MX0.5DUjPQQB-CKdiuERL3LBUX4g2yzDy_L5b-M8FQS-Dxo";

// Cliente sem persistência de sessão - sempre anônimo
export const supabasePublic = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
