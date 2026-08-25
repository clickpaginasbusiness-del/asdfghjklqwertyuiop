-- Detalhamento de crédito por serviço (relatório da prestadora e "meus
-- créditos" da cliente): planos_usos passa a registrar qual serviço cada
-- uso consumiu, não só o saldo agregado em planos_assinaturas.
ALTER TABLE planos_usos ADD COLUMN IF NOT EXISTS servico_id uuid REFERENCES servicos(id) ON DELETE SET NULL;

-- Backfill: usos automáticos (vinculados a um agendamento) já têm o serviço
-- disponível via o agendamento — usos manuais antigos (sem agendamento_id)
-- ficam sem servico_id, não há como recuperar essa informação retroativamente.
UPDATE planos_usos pu SET servico_id = a.servico_id
FROM agendamentos a
WHERE pu.agendamento_id = a.id AND pu.servico_id IS NULL;
