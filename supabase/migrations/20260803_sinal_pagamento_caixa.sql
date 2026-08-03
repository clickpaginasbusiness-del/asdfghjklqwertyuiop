-- Sinal e Pagamento pelo App: configuração de pagamento online por serviço,
-- agendamento "temporário" (aguardando pagamento) e caixa da prestadora
-- (saldo de sinais/pagamentos recebidos via app, líquido da taxa da
-- plataforma, liberado 7 dias após o pagamento) — separado do caixa de
-- comissões de parceiras (parceiras_comissoes/parceiras_saques).

-- 1. Configuração de pagamento online por serviço.
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS aceitar_pagamento_online boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sinal_tipo text
    CHECK (sinal_tipo IN ('fixo', 'percentual')),
  ADD COLUMN IF NOT EXISTS sinal_valor numeric(10,2),
  ADD COLUMN IF NOT EXISTS sinal_obrigatorio boolean DEFAULT false;

-- 2. Agendamento "temporário": criado antes do pagamento (segura os dados
-- da reserva), só vira 'confirmado' quando o webhook do MP confirma o
-- pagamento (ver /api/agendamentos/criar-pendente e /api/mp/webhook).
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('confirmado', 'cancelado', 'concluido', 'aguardando_pagamento'));

-- 3. Caixa da prestadora.
CREATE TABLE IF NOT EXISTS caixa_prestadora (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sinal', 'pagamento_servico', 'saque')),
  valor numeric(10,2) NOT NULL,
  valor_bruto numeric(10,2) NOT NULL,
  taxa_percentual numeric(5,2) NOT NULL DEFAULT 7.00,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'disponivel', 'sacado', 'reembolsado')),
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE SET NULL,
  mp_payment_id text,
  disponivel_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_prestadora
  ON caixa_prestadora (prestadora_id, status);

ALTER TABLE caixa_prestadora ENABLE ROW LEVEL SECURITY;
-- Leitura: prestadora só vê os próprios registros. Escrita sempre via
-- service role (webhook do MP / cron / rota de saque), mesmo padrão de
-- mp_checkouts e parceiras_comissoes — sem policy de insert/update aqui.
CREATE POLICY "Prestadora ve proprio caixa" ON caixa_prestadora FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = caixa_prestadora.prestadora_id AND user_id = auth.uid())
);

-- 4. Saques do caixa — mesmo padrão de parceiras_saques, tabela separada
-- porque é um saldo diferente (pagamentos de agendamento via app, não
-- comissão de indicação).
CREATE TABLE IF NOT EXISTS caixa_saques (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  valor numeric(10,2) NOT NULL,
  pix_chave text NOT NULL,
  status text NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado', 'pago')),
  solicitado_em timestamptz DEFAULT now(),
  pago_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caixa_saques
  ON caixa_saques (prestadora_id);

ALTER TABLE caixa_saques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestadora ve proprios saques do caixa" ON caixa_saques FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = caixa_saques.prestadora_id AND user_id = auth.uid())
);
