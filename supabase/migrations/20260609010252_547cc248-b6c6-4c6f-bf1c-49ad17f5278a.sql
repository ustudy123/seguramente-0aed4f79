ALTER TABLE public.ponto_marcacoes REPLICA IDENTITY FULL;
ALTER TABLE public.ponto_diario REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ponto_marcacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ponto_diario;