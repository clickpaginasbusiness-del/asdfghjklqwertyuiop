-- Notas/preferências da cliente e data de nascimento (aniversariantes da
-- semana no dashboard) + comissão percentual por profissional (relatório
-- financeiro).

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS notas text;

ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS comissao_percentual numeric(5,2) DEFAULT 0;
