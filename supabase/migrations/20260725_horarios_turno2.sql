-- Segundo turno por dia (ex: intervalo de almoço) — opcional, além do
-- turno 1 já existente (hora_abertura / hora_fechamento).
ALTER TABLE horarios_funcionamento
  ADD COLUMN IF NOT EXISTS turno2_inicio time,
  ADD COLUMN IF NOT EXISTS turno2_fim time;
