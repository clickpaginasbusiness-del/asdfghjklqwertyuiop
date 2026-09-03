-- Recorrência de lançamentos financeiros (aluguel mensal, fornecedor a cada
-- 10 dias, etc.) + lançamento com período (uma linha representando um
-- intervalo, ex. "faturamento de 12/08 a 30/08").
--
-- A regra da recorrência é uma tabela separada de lancamentos_financeiros de
-- propósito: cada ocorrência (inclusive a primeira) é uma linha normal em
-- lancamentos_financeiros referenciando a regra. Isso permite "editar só
-- esta ocorrência" sem vazar pra geração futura, e "cancelar recorrência"
-- sem ambiguidade com "excluir uma ocorrência".

CREATE TABLE IF NOT EXISTS lancamentos_recorrencias (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  categoria text NOT NULL DEFAULT 'Outro'
    CHECK (categoria IN ('Aluguel', 'Salario', 'Equipamento', 'Material', 'Outro')),
  intervalo_dias integer NOT NULL CHECK (intervalo_dias > 0),
  data_inicio date NOT NULL,
  ate date NOT NULL CHECK (ate >= data_inicio),
  duracao_dias integer CHECK (duracao_dias IS NULL OR duracao_dias >= 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_recorrencias_ativas
  ON lancamentos_recorrencias (prestadora_id) WHERE ativo;

ALTER TABLE lancamentos_recorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prestadora gerencia proprias lancamentos_recorrencias" ON lancamentos_recorrencias;
CREATE POLICY "Prestadora gerencia proprias lancamentos_recorrencias" ON lancamentos_recorrencias FOR ALL USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = lancamentos_recorrencias.prestadora_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Service role manage lancamentos_recorrencias" ON lancamentos_recorrencias;
CREATE POLICY "Service role manage lancamentos_recorrencias" ON lancamentos_recorrencias FOR ALL USING (
  auth.role() = 'service_role'
);

ALTER TABLE lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS recorrencia_id uuid REFERENCES lancamentos_recorrencias(id) ON DELETE CASCADE;

ALTER TABLE lancamentos_financeiros
  DROP CONSTRAINT IF EXISTS lancamentos_financeiros_data_fim_check;
ALTER TABLE lancamentos_financeiros
  ADD CONSTRAINT lancamentos_financeiros_data_fim_check CHECK (data_fim IS NULL OR data_fim >= data);

CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_recorrencia
  ON lancamentos_financeiros (recorrencia_id);
