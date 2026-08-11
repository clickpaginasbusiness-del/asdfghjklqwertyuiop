CREATE TABLE IF NOT EXISTS retrospectivas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL,
  dados jsonb NOT NULL,
  -- dados contém:
  -- total_agendamentos, servico_mais_pedido (nome),
  -- dia_semana_mais_movimentado, cliente_mais_agendou (primeiro nome/iniciais),
  -- total_mes_anterior (null se primeiro mês),
  -- variacao_percentual (null se primeiro mês),
  -- profissional_destaque (null se só 1 profissional),
  -- tem_dados (false se zero agendamentos)
  created_at timestamptz DEFAULT now(),
  UNIQUE(prestadora_id, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_retrospectivas_prestadora
  ON retrospectivas (prestadora_id, ano, mes DESC);

ALTER TABLE retrospectivas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestadora ve proprias retrospectivas"
ON retrospectivas FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = retrospectivas.prestadora_id AND user_id = auth.uid())
);
