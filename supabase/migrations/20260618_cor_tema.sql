-- Cor de personalização da página pública (exclusivo Plano Pro)
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS cor_tema text NOT NULL DEFAULT 'rosa';
