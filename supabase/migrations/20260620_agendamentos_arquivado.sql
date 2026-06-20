-- "Excluir todos cancelados" — soft-delete via flag em vez de DELETE real, para que
-- os agendamentos cancelados continuem contando nos relatórios históricos
-- (taxa de cancelamento, receita por período, etc.) mesmo depois de saírem da
-- lista de agendamentos ativos.
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agendamentos_prestadora_arquivado
  ON agendamentos (prestadora_id, arquivado);
