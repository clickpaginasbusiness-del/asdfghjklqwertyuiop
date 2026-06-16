-- Adiciona coluna para sinalizar downgrade Pro → Básico recente
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS downgrade_aviso boolean NOT NULL DEFAULT false;
