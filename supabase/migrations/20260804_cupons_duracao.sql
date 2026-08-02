-- Duração do desconto de cupons (quantas cobranças recebem o desconto) e
-- rastreio de uso por prestadora, pra saber quando parar de aplicar.

ALTER TABLE cupons
  ADD COLUMN IF NOT EXISTS duracao_cobracas integer DEFAULT 1;
-- 1    = desconto só na primeira cobrança (padrão)
-- null = desconto em todas as cobranças (vitalício)
-- N    = desconto nas primeiras N cobranças, depois cobra o valor cheio

CREATE TABLE IF NOT EXISTS cupons_usos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cupom_id uuid REFERENCES cupons(id) ON DELETE CASCADE,
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE,
  cobracas_aplicadas integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cupom_id, prestadora_id)
);

CREATE INDEX IF NOT EXISTS idx_cupons_usos_prestadora ON cupons_usos (prestadora_id);

ALTER TABLE cupons_usos ENABLE ROW LEVEL SECURITY;
-- Sem policy — só o service role acessa (mesmo padrão de cupons/mp_checkouts).
