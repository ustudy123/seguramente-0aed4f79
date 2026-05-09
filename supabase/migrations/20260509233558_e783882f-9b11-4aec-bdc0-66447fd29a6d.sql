
CREATE OR REPLACE FUNCTION public.sync_landing_lead_to_crm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.leads (nome, email, telefone, empresa, cargo, origem, status, landing_lead_id, notas)
  VALUES (
    NEW.nome,
    NEW.email,
    NEW.telefone,
    NEW.empresa,
    NEW.cargo,
    'landing_page'::lead_origem,
    'novo'::lead_status,
    NEW.id,
    CASE
      WHEN NEW.perfil_diagnostico IS NOT NULL
      THEN 'Diagnóstico: ' || NEW.perfil_diagnostico || ' (Score ' || COALESCE(NEW.pontuacao_diagnostico::text, '-') || ') · Setor: ' || COALESCE(NEW.setor, '-') || ' · Funcionários: ' || COALESCE(NEW.num_funcionarios, '-')
      ELSE 'Origem: ' || COALESCE(NEW.landing_page_origem, 'landing')
    END
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_landing_lead_to_crm ON public.landing_leads;
CREATE TRIGGER trg_sync_landing_lead_to_crm
  AFTER INSERT ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_landing_lead_to_crm();

-- Backfill landing_leads existentes que ainda não foram para o CRM
INSERT INTO public.leads (nome, email, telefone, empresa, cargo, origem, status, landing_lead_id, notas, created_at)
SELECT
  ll.nome,
  ll.email,
  ll.telefone,
  ll.empresa,
  ll.cargo,
  'landing_page'::lead_origem,
  'novo'::lead_status,
  ll.id,
  CASE WHEN ll.perfil_diagnostico IS NOT NULL
    THEN 'Diagnóstico: ' || ll.perfil_diagnostico || ' (Score ' || COALESCE(ll.pontuacao_diagnostico::text, '-') || ') · Setor: ' || COALESCE(ll.setor, '-') || ' · Funcionários: ' || COALESCE(ll.num_funcionarios, '-')
    ELSE 'Origem: ' || COALESCE(ll.landing_page_origem, 'landing')
  END,
  ll.created_at
FROM public.landing_leads ll
LEFT JOIN public.leads l ON l.landing_lead_id = ll.id
WHERE l.id IS NULL;
