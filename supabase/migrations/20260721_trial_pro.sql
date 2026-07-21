-- Trial gratuito de 7 dias do Plano Pro para quem está no Básico
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS trial_pro_usado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_pro_fim timestamptz;
