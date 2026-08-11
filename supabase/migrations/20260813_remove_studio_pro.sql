-- Remove o tier studio_pro — o Studio (repreçado pra R$119/mês) passa a
-- cobrir tudo que era exclusivo do Studio Pro, então não há mais motivo pra
-- manter os dois lados a lado.

-- Migra quem estava no studio_pro para studio
UPDATE prestadoras SET plano = 'studio' WHERE plano = 'studio_pro';

-- Atualiza a constraint
ALTER TABLE prestadoras
  DROP CONSTRAINT IF EXISTS prestadoras_plano_check;
ALTER TABLE prestadoras
  ADD CONSTRAINT prestadoras_plano_check
  CHECK (plano IN ('start', 'pro', 'studio'));

-- Atualiza mp_checkouts também
ALTER TABLE mp_checkouts
  DROP CONSTRAINT IF EXISTS mp_checkouts_plano_check;
ALTER TABLE mp_checkouts
  ADD CONSTRAINT mp_checkouts_plano_check
  CHECK (plano IN ('start', 'pro', 'studio'));
