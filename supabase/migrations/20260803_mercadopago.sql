-- Migração completa do sistema de pagamentos: Stripe → Mercado Pago.
-- Sem assinantes reais em produção ainda (confirmado antes de migrar) —
-- corte limpo, sem necessidade de preservar dados de assinaturas Stripe.

-- 1. Troca as colunas de Stripe em prestadoras pelas equivalentes do MP.
-- mp_metodo_pagamento/mp_ciclo guardam o que era implícito no price ID do
-- Stripe. mp_periodo_fim é a data até quando o acesso pago vale — pra
-- assinatura via cartão (preapproval) é atualizada a cada pagamento
-- confirmado no webhook; pra pix/débito mensal (pagamento avulso recorrente,
-- sem objeto de assinatura no MP) é quem guia o cron de renovação/suspensão.
-- mp_pagamento_pendente_id é o pagamento avulso do ciclo atual aguardando
-- confirmação (pix/débito mensal ou qualquer método anual).
ALTER TABLE prestadoras
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  ADD COLUMN IF NOT EXISTS mp_customer_id text,
  ADD COLUMN IF NOT EXISTS mp_subscription_id text,
  ADD COLUMN IF NOT EXISTS mp_metodo_pagamento text
    CHECK (mp_metodo_pagamento IN ('cartao', 'pix', 'debito')),
  ADD COLUMN IF NOT EXISTS mp_ciclo text
    CHECK (mp_ciclo IN ('mensal', 'anual')),
  ADD COLUMN IF NOT EXISTS mp_periodo_fim timestamptz,
  ADD COLUMN IF NOT EXISTS mp_pagamento_pendente_id text,
  ADD COLUMN IF NOT EXISTS cancelamento_agendado boolean NOT NULL DEFAULT false;

-- 2. parceiras_comissoes referenciava a fatura do Stripe para idempotência
-- (uma comissão por fatura paga) — troca pelo id do pagamento no MP, que
-- cumpre o mesmo papel (MP não tem conceito de "fatura").
ALTER TABLE parceiras_comissoes RENAME COLUMN stripe_invoice_id TO mp_payment_id;

-- 3. Cupons de desconto — substituem os Coupon objects do Stripe (o MP não
-- tem esse conceito nativo). Validados e aplicados direto no nosso banco:
-- calcula o valor com desconto e cria a cobrança no MP já com esse valor.
CREATE TABLE IF NOT EXISTS cupons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo text NOT NULL UNIQUE,
  percentual smallint CHECK (percentual BETWEEN 1 AND 100),
  valor_fixo numeric(10,2),
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz,
  max_usos integer,
  usos integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CHECK (percentual IS NOT NULL OR valor_fixo IS NOT NULL)
);

ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
-- Sem policy — só o service role (rotas de API) lê/escreve, mesmo padrão já
-- usado em missoes_descontos/parceiras_comissoes.

-- 4. Config genérica chave-valor — guarda os IDs dos preapproval_plan
-- criados no Mercado Pago (Básico Mensal, Pro Mensal) na primeira execução.
-- Necessário porque uma rota serverless não consegue persistir variável de
-- ambiente em runtime; os planos anuais não entram aqui pois não usam
-- preapproval_plan (são pagamento avulso via Checkout Pro, preço fixo em
-- código — ver src/lib/mercadopago.ts).
CREATE TABLE IF NOT EXISTS app_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- Sem policy — só o service role acessa.

-- 5. Correlação checkout → webhook. O MP não garante que metadata enviada na
-- criação de uma Preference/preapproval_plan volte de forma confiável no
-- payment/preapproval do webhook — em vez de depender disso, cada checkout
-- (inicial ou renovação gerada pelo cron) grava aqui o que precisa saber pra
-- ativar o plano certo. `mp_referencia` é o external_reference (Preference,
-- pagamento avulso) ou o id do preapproval_plan (assinatura recorrente por
-- cartão) — nesse segundo caso só quando é um plano criado sob medida
-- (cupom/trial), já que o plano compartilhado é reusado entre várias
-- prestadoras e não serve como chave por-checkout (ver mercadopago.ts).
CREATE TABLE IF NOT EXISTS mp_checkouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  plano text NOT NULL CHECK (plano IN ('basico', 'pro')),
  ciclo text NOT NULL CHECK (ciclo IN ('mensal', 'anual')),
  metodo text NOT NULL CHECK (metodo IN ('cartao', 'pix', 'debito')),
  valor numeric(10,2) NOT NULL,
  mp_referencia text NOT NULL,
  consumido boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_checkouts_referencia ON mp_checkouts (mp_referencia) WHERE consumido = false;

ALTER TABLE mp_checkouts ENABLE ROW LEVEL SECURITY;
-- Sem policy — só o service role acessa.

-- 6. Idempotência do webhook de pagamentos — o MP pode reentregar a mesma
-- notificação mais de uma vez (documentado, mesma ressalva que já existia
-- pro Stripe). Sem isso, um `payment` reentregue extenderia
-- mp_periodo_fim/geraria comissão de parceira em dobro.
CREATE TABLE IF NOT EXISTS mp_eventos_processados (
  payment_id text PRIMARY KEY,
  processed_at timestamptz DEFAULT now()
);

-- 7. Notificação no sininho quando a cobrança mensal avulsa (Pix/débito) fica
-- disponível ou quando a assinatura é suspensa por falta de pagamento.
ALTER TABLE notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_tipo_check
  CHECK (tipo IN ('agendamento', 'cancelamento', 'indicacao', 'missao', 'pagamento'));

ALTER TABLE mp_eventos_processados ENABLE ROW LEVEL SECURITY;
-- Sem policy — só o service role acessa.
