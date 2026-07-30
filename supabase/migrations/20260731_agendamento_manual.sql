-- Agendamento manual pelo painel da prestadora: cliente pode ser uma cliente
-- manual (sem conta real, cadastrada na hora pela prestadora) e o agendamento
-- fica marcado como criado manualmente (não conta para missões/objetivos).

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cliente_manual boolean NOT NULL DEFAULT false;

-- Telefone passa a ser opcional só para clientes manuais (a UNIQUE em telefone
-- continua funcionando normalmente — Postgres trata múltiplos NULL como
-- distintos, então várias clientes manuais sem telefone podem coexistir).
ALTER TABLE clientes
  ALTER COLUMN telefone DROP NOT NULL;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS agendamento_manual boolean NOT NULL DEFAULT false;
