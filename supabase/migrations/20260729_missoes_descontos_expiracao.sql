-- Descontos de missões expiram no início do mês seguinte se não forem
-- aplicados na fatura — evita que descontos acumulem indefinidamente.
ALTER TABLE missoes_descontos
  ADD COLUMN IF NOT EXISTS expira_em timestamptz;
