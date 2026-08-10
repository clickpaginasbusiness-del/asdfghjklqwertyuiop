-- Sistema de Planos de Assinatura para clientes das prestadoras.
-- Cada prestadora pode criar planos (ex: "4 cortes por mês"), clientes
-- assinam via Mercado Pago (preapproval recorrente, mesmo mecanismo já
-- usado pra assinatura da prestadora com o BelleBook), e créditos são
-- consumidos ao agendar. Dinheiro segue o MESMO caminho de sinal/pagamento
-- de agendamento já existente: cai no caixa_prestadora (líquido da taxa da
-- plataforma), não numa conta MP separada da prestadora — ver
-- src/lib/caixa.ts e a migration 20260803_sinal_pagamento_caixa.sql.

-- 1. Planos criados pela prestadora.
CREATE TABLE IF NOT EXISTS planos_prestadora (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL,
  intervalo text NOT NULL DEFAULT 'mensal'
    CHECK (intervalo IN ('mensal', 'bimensal', 'trimestral', 'semestral', 'anual')),
  desconto_tipo text NOT NULL DEFAULT 'percentual'
    CHECK (desconto_tipo IN ('percentual', 'fixo')),
  desconto_valor numeric(10,2) NOT NULL DEFAULT 0,
  creditos_acumulam boolean NOT NULL DEFAULT false,
  limite_vagas integer,
  ativo boolean NOT NULL DEFAULT true,
  -- id do preapproval_plan criado no Mercado Pago pra esse plano — criado na
  -- primeira assinatura (lazy, mesmo padrão de getOrCreatePlanoMensal em
  -- src/lib/mercadopago.ts) e reaproveitado por todas as clientes que
  -- assinam esse mesmo plano depois.
  mp_preapproval_plan_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_prestadora ON planos_prestadora (prestadora_id, ativo);

ALTER TABLE planos_prestadora ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestadora ve proprios planos" ON planos_prestadora FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = planos_prestadora.prestadora_id AND user_id = auth.uid())
);
-- Leitura pública: página /n/[slug] precisa listar planos ativos pra
-- qualquer visitante (sem sessão) decidir se assina. Escrita (criar/editar
-- plano) sempre via API route com o client autenticado da prestadora, ou
-- service role no caso do webhook/cron — sem policy de insert/update aqui,
-- mesmo padrão de mp_checkouts.
CREATE POLICY "Planos ativos sao publicos" ON planos_prestadora FOR SELECT USING (ativo = true);

-- 2. Serviços incluídos em cada plano (opcional).
CREATE TABLE IF NOT EXISTS planos_servicos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  plano_id uuid REFERENCES planos_prestadora(id) ON DELETE CASCADE NOT NULL,
  servico_id uuid REFERENCES servicos(id) ON DELETE CASCADE NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  UNIQUE(plano_id, servico_id)
);

ALTER TABLE planos_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestadora ve servicos dos proprios planos" ON planos_servicos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM planos_prestadora pp
    JOIN prestadoras p ON p.id = pp.prestadora_id
    WHERE pp.id = planos_servicos.plano_id AND p.user_id = auth.uid()
  )
);
CREATE POLICY "Servicos de planos ativos sao publicos" ON planos_servicos FOR SELECT USING (
  EXISTS (SELECT 1 FROM planos_prestadora WHERE id = planos_servicos.plano_id AND ativo = true)
);

-- 3. Assinaturas das clientes.
CREATE TABLE IF NOT EXISTS planos_assinaturas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  plano_id uuid REFERENCES planos_prestadora(id) ON DELETE CASCADE NOT NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  prestadora_id uuid REFERENCES prestadoras(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'cancelada', 'suspensa')),
  mp_subscription_id text,
  mp_metodo text CHECK (mp_metodo IN ('cartao', 'pix')),
  creditos_restantes integer NOT NULL DEFAULT 0,
  creditos_totais integer NOT NULL DEFAULT 0,
  periodo_inicio timestamptz NOT NULL DEFAULT now(),
  periodo_fim timestamptz,
  cancelado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plano_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_planos_assinaturas_prestadora ON planos_assinaturas (prestadora_id, status);
CREATE INDEX IF NOT EXISTS idx_planos_assinaturas_cliente ON planos_assinaturas (cliente_id, status);

ALTER TABLE planos_assinaturas ENABLE ROW LEVEL SECURITY;
-- Só a prestadora lê via RLS (client-side Supabase). A área "Meus planos" da
-- cliente NÃO usa Supabase Auth (clientes se autenticam por token próprio —
-- ver /api/clientes/auth/*), então o acesso dela é sempre via API route com
-- service role validando o token, nunca direto pelo client + RLS.
CREATE POLICY "Prestadora ve proprias assinaturas de clientes" ON planos_assinaturas FOR SELECT USING (
  EXISTS (SELECT 1 FROM prestadoras WHERE id = planos_assinaturas.prestadora_id AND user_id = auth.uid())
);

-- 4. Histórico de uso dos créditos.
CREATE TABLE IF NOT EXISTS planos_usos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assinatura_id uuid REFERENCES planos_assinaturas(id) ON DELETE CASCADE NOT NULL,
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'automatico'
    CHECK (tipo IN ('automatico', 'manual')),
  descricao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_usos_assinatura ON planos_usos (assinatura_id);

ALTER TABLE planos_usos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prestadora ve usos das proprias assinaturas" ON planos_usos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM planos_assinaturas pa
    JOIN prestadoras p ON p.id = pa.prestadora_id
    WHERE pa.id = planos_usos.assinatura_id AND p.user_id = auth.uid()
  )
);

-- 5. Caixa da prestadora precisa aceitar receita de plano de assinatura —
-- mesmo mecanismo de sinal/pagamento_servico (ver src/lib/caixa.ts), só que
-- sem agendamento_id (é uma cobrança recorrente, não ligada a um
-- agendamento específico) e com um novo campo pra rastrear de qual
-- assinatura veio, usado no relatório "receita gerada" por plano.
ALTER TABLE caixa_prestadora DROP CONSTRAINT IF EXISTS caixa_prestadora_tipo_check;
ALTER TABLE caixa_prestadora ADD CONSTRAINT caixa_prestadora_tipo_check
  CHECK (tipo IN ('sinal', 'pagamento_servico', 'saque', 'plano_assinatura'));

ALTER TABLE caixa_prestadora
  ADD COLUMN IF NOT EXISTS plano_assinatura_id uuid REFERENCES planos_assinaturas(id) ON DELETE SET NULL;

-- 6. Agendamentos precisam saber se usaram crédito de um plano — fonte única
-- pro badge "Plano [nome]" nos cards (agendamentos/calendário/painel) e pro
-- desconto aplicado no sinal quando o serviço exige pagamento online.
-- Setado na criação (livre ou temporária aguardando pagamento); o crédito
-- só é de fato debitado quando o agendamento é confirmado (na hora, pro
-- fluxo grátis, ou pelo webhook do MP, pro fluxo com sinal).
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS plano_assinatura_id uuid REFERENCES planos_assinaturas(id) ON DELETE SET NULL;
