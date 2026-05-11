ALTER TABLE public.ponto_escalas
  ADD COLUMN IF NOT EXISTS compensacoes_mensais jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ponto_escalas.compensacoes_mensais IS
  'Lista de compensações mensais para equalizar carga horária semanal. Ex: [{"ordinal_mes":"1","dia_semana":"sabado","entrada":"08:00","saida":"12:00","intervalo":0,"descricao":"1º sábado do mês"}]';

COMMENT ON COLUMN public.ponto_escalas.dias_config IS
  'Configuração por dia da semana com até 4 marcações. Ex: {"segunda":{"trabalha":true,"tem_almoco":true,"entrada":"08:00","inicio_almoco":"12:00","fim_almoco":"13:00","saida":"17:00"}}';