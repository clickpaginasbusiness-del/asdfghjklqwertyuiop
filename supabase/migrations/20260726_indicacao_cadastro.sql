-- Recompensa de indicação em dois estágios: estágio 1 (+7 dias) quando a
-- indicada cria a conta, estágio 2 (+30 dias, já existente) quando ela
-- assina um plano.
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS indicacao_cadastro_processada boolean DEFAULT false;

-- Permite notificar o painel ("Sua indicada X criou uma conta!") quando a
-- recompensa de estágio 1 é concedida.
ALTER TABLE notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo IN ('agendamento', 'cancelamento', 'indicacao'));
