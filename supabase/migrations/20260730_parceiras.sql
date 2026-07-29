-- Sistema de Parceiras/Afiliadas: comissão recorrente por indicação.

-- 1. Campos de parceira em prestadoras.
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS e_parceira boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parceira_desde timestamptz,
  ADD COLUMN IF NOT EXISTS parceira_comissao_percentual smallint DEFAULT 20,
  ADD COLUMN IF NOT EXISTS parceira_periodo_30_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS parceira_pix text;

-- 2. Comissões geradas a cada fatura paga por uma indicada.
CREATE TABLE IF NOT EXISTS parceiras_comissoes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parceira_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE,
  indicada_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL,
  valor_assinatura numeric(10,2) NOT NULL,
  percentual smallint NOT NULL,
  valor_comissao numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'disponivel', 'pago', 'cancelado')),
  disponivel_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parceiras_comissoes_parceira
  ON parceiras_comissoes (parceira_id, status);

-- NÃO fazia parte do pedido original, mas é importante: o webhook do Stripe
-- pode reentregar o mesmo evento `invoice.paid` mais de uma vez (é o
-- comportamento documentado do Stripe) — sem essa constraint, uma
-- reentrega duplicaria a comissão e pagaria a parceira em dobro pela mesma
-- fatura. A rota do webhook também checa isso antes de inserir, mas o
-- índice único é quem garante de verdade, mesmo em entregas concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parceiras_comissoes_invoice_unico
  ON parceiras_comissoes (stripe_invoice_id);

-- 3. Saques solicitados pelas parceiras.
CREATE TABLE IF NOT EXISTS parceiras_saques (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  parceira_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL,
  pix_chave text NOT NULL,
  status text NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado', 'pago')),
  solicitado_em timestamptz DEFAULT now(),
  pago_em timestamptz,
  whatsapp_telefone text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parceiras_saques_parceira
  ON parceiras_saques (parceira_id, status);

-- RLS — leitura própria; toda escrita passa pelo service role nas rotas de
-- API (mesmo padrão já usado nas tabelas de missões).
ALTER TABLE parceiras_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiras_saques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parceira ve suas proprias comissoes" ON parceiras_comissoes;
CREATE POLICY "Parceira ve suas proprias comissoes" ON parceiras_comissoes FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = parceiras_comissoes.parceira_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Parceira ve seus proprios saques" ON parceiras_saques;
CREATE POLICY "Parceira ve seus proprios saques" ON parceiras_saques FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = parceiras_saques.parceira_id AND user_id = auth.uid())
);
