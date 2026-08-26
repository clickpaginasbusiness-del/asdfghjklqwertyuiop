-- Tela de gestão de créditos da prestadora passa a permitir editar o número
-- de créditos restantes diretamente (em vez de só "descontar 1 uso"). Novo
-- tipo 'ajuste' distingue esses registros dos usos automáticos (agendamento
-- pago) e dos manuais antigos (desconto de 1 uso, ação removida) no
-- histórico — entradas antigas com tipo 'manual' continuam válidas.
ALTER TABLE planos_usos DROP CONSTRAINT IF EXISTS planos_usos_tipo_check;
ALTER TABLE planos_usos ADD CONSTRAINT planos_usos_tipo_check
  CHECK (tipo IN ('automatico', 'manual', 'ajuste'));
