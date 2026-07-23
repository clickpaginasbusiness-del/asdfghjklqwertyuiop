-- Indicador de online no painel admin: last_seen_at é atualizado a cada
-- carregamento do painel (rota /api/ping) e usado para marcar quem esteve
-- ativo nos últimos 5 minutos.
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
