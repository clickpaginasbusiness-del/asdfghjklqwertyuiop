-- Livro caixa simplificado da prestadora (aba "Financeiro" em /painel/relatorios).
-- valor positivo = entrada, negativo = saída.

CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  categoria text NOT NULL DEFAULT 'Outro'
    CHECK (categoria IN ('Aluguel', 'Salario', 'Equipamento', 'Material', 'Outro')),
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_prestadora
  ON lancamentos_financeiros (prestadora_id, data);

ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

-- Prestadora gerencia diretamente os próprios lançamentos (mesmo padrão de
-- servicos/profissionais/galeria — CRUD direto do painel, sem rota de API).
DROP POLICY IF EXISTS "Prestadora gerencia proprios lancamentos_financeiros" ON lancamentos_financeiros;
CREATE POLICY "Prestadora gerencia proprios lancamentos_financeiros" ON lancamentos_financeiros FOR ALL USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = lancamentos_financeiros.prestadora_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Service role manage lancamentos_financeiros" ON lancamentos_financeiros;
CREATE POLICY "Service role manage lancamentos_financeiros" ON lancamentos_financeiros FOR ALL USING (
  auth.role() = 'service_role'
);
